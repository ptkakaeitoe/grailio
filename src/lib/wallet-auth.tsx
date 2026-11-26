"use client";

import { PrivyProvider, useExportWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { WagmiProvider as PrivyWagmiProvider, useSetActiveWallet } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { WagmiProvider, useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { appChain } from "@/lib/chain";
import { injectedWagmiConfig, privyAppId, privyWagmiConfig } from "@/lib/wagmi";
import { showToast } from "@/lib/toast";
import { txErrorMessage } from "@/lib/tx-error";

/**
 * One way to sign in and out, whatever powers it (Privy, or a browser wallet
 * when NEXT_PUBLIC_PRIVY_APP_ID isn't set). Components call this instead of a wallet library.
 */
export type WalletAuth = {
  /** "privy" with an app ID; "injected" (browser wallet only) without one. */
  mode: "privy" | "injected";
  /** False until the login system has loaded. */
  ready: boolean;
  /** Something can sign in: always with Privy; with a browser wallet only when one is installed. */
  available: boolean;
  /** Still loading, or signed in but the wallet isn't attached yet: don't offer "sign in" meanwhile. */
  restoring?: boolean;
  /** Opens sign-in; with a browser wallet, `walletId` picks which installed wallet connects. */
  login: (walletId?: string) => void;
  /** Browser wallets found in this browser (EIP-6963), one row each in Connect. Empty with Privy. */
  wallets?: { id: string; name: string; icon?: string }[];
  logout: () => Promise<void>;
  /** True for wallets made by Privy for email/social sign-ins. */
  embedded: boolean;
  /**
   * Privy-made wallets only: opens Privy's export pop-up to copy the private
   * key into another wallet. The key stays in Privy's own secure frame; the app never sees it.
   */
  exportWallet?: () => Promise<void>;
};

const WalletAuthContext = createContext<WalletAuth>({ mode: "injected", ready: false, available: false, login: () => {}, logout: async () => {}, embedded: false });
export const useWalletAuth = () => useContext(WalletAuthContext);

function PrivyAuth({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, logout, user, connectWallet } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  // True from Sign out until Privy has finished, so auto-reconnect doesn't re-attach the wallet meanwhile.
  const signingOut = useRef(false);
  // The wallet to use: the account's main wallet if it's connected here, else the Privy-made one, else any.
  const primary = user?.wallet?.address?.toLowerCase();
  const preferred = wallets.find((w) => w.address.toLowerCase() === primary) ?? wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  // Signed in to Privy but no wallet in wagmi (e.g. after a reload): make one active, or the
  // app shows "connect" while Privy refuses a second login ("user is already logged in").
  useEffect(() => {
    if (ready && authenticated && walletsReady && !isConnected && preferred && !signingOut.current) void setActiveWallet(preferred).catch(() => {});
  }, [ready, authenticated, walletsReady, isConnected, preferred, setActiveWallet]);
  const { exportWallet } = useExportWallet();
  const embeddedAddress = user?.wallet?.walletClientType === "privy" ? user.wallet.address : null;
  const embedded = Boolean(embeddedAddress);
  // A brand-new account is signed in a few seconds before Privy finishes making its wallet.
  const restoring = !ready || (authenticated && !isConnected);
  const value = useMemo<WalletAuth>(() => ({
    mode: "privy",
    ready,
    available: true,
    restoring,
    // Already signed in: reconnect the wallet instead of logging in again.
    login: () => {
      if (!authenticated) login();
      else if (preferred) void setActiveWallet(preferred).catch(() => {});
      else connectWallet();
    },
    // Instant sign-out: drop the wallet from the app now, let Privy finish in the background.
    logout: async () => {
      signingOut.current = true;
      disconnect();
      try {
        await logout();
      } finally {
        signingOut.current = false;
      }
    },
    embedded,
    exportWallet: embeddedAddress ? () => exportWallet({ address: embeddedAddress }) : undefined,
  }), [ready, restoring, authenticated, login, preferred, setActiveWallet, connectWallet, disconnect, logout, embedded, exportWallet, embeddedAddress]);
  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

/** Whether the browser has an injected wallet (window.ethereum). False on the server and during hydration. */
/** Re-checks when a wallet announces itself late (MetaMask's ethereum#initialized, EIP-6963) and once shortly after load. */
const watchInjected = (cb: () => void) => {
  window.addEventListener("ethereum#initialized", cb);
  window.addEventListener("eip6963:announceProvider", cb);
  const t = window.setTimeout(cb, 1500);
  return () => { window.removeEventListener("ethereum#initialized", cb); window.removeEventListener("eip6963:announceProvider", cb); window.clearTimeout(t); };
};
const hasInjected = () => typeof window !== "undefined" && "ethereum" in window && Boolean((window as { ethereum?: unknown }).ethereum);

function InjectedAuth({ children }: { children: ReactNode }) {
  const { connectAsync, connectors, isPending } = useConnect();
  const { switchChainAsync } = useSwitchChain();
  const { disconnectAsync } = useDisconnect();
  const available = useSyncExternalStore(watchInjected, hasInjected, () => false);
  // Each wallet that announced itself (EIP-6963: MetaMask, Rabby, Phantom…) is its own connector; the generic
  // "Injected" one (whatever owns window.ethereum) is only used when none announced.
  const announced = connectors.filter((c) => c.type === "injected" && c.id !== "injected");
  const value = useMemo<WalletAuth>(() => ({
    mode: "injected",
    ready: !isPending,
    available: available || announced.length > 0,
    restoring: isPending,
    wallets: announced.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
    // Connect first, then move to BSC testnet: asking for the chain while connecting makes the whole connect fail
    // in wallets that don't have the chain added yet. Switching adds it (wallet_addEthereumChain) when it's missing,
    // and if that's refused the header offers "Switch network". Errors show as a toast instead of failing silently.
    login: (walletId?: string) => {
      const connector = (walletId && connectors.find((c) => c.id === walletId)) || announced[0] || (hasInjected() ? connectors.find((c) => c.id === "injected") : undefined);
      if (!connector) { showToast({ kind: "error", title: "No browser wallet found", detail: "Install MetaMask or Rabby, or try the demo." }); return; }
      void (async () => {
        try {
          const res = await connectAsync({ connector });
          if (res.chainId !== appChain.id) await switchChainAsync({ chainId: appChain.id }).catch(() => undefined);
        } catch (e) {
          showToast({ kind: "error", title: `Couldn't connect ${connector.name}`, detail: txErrorMessage(e, "The wallet didn't connect.") });
        }
      })();
    },
    logout: async () => { await disconnectAsync(); },
    embedded: false,
  }), [isPending, available, announced, connectors, connectAsync, switchChainAsync, disconnectAsync]);
  return <WalletAuthContext.Provider value={value}>{children}</WalletAuthContext.Provider>;
}

/** Wallet, query and login providers for the whole app. */
export function WalletProviders({ children }: { children: ReactNode }) {
  // One client per browser session; creating it in state keeps it from being shared across requests during SSR.
  const [queryClient] = useState(() => new QueryClient());

  // No Privy app ID: never mount Privy (it throws without one). Browser wallets still work.
  if (!privyAppId) {
    return (
      <WagmiProvider config={injectedWagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <InjectedAuth>{children}</InjectedAuth>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#000000",
          landingHeader: "Sign in to Grailio",
          loginMessage: "Use your email or Google account and we’ll make a wallet for you, or connect the wallet you already have.",
          showWalletLoginFirst: false,
          walletList: ["detected_ethereum_wallets", "metamask", "coinbase_wallet", "rainbow", "wallet_connect"],
        },
        // The app shows its own confirm screens before anything is signed, so Privy's sign/approve pop-ups are hidden.
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
        defaultChain: appChain,
        supportedChains: [appChain],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <PrivyWagmiProvider config={privyWagmiConfig}>
          <PrivyAuth>{children}</PrivyAuth>
        </PrivyWagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
