"use client";

import { WalletProviders } from "@/lib/wallet-auth";

/** Client-side providers for the whole app: Privy (or a browser wallet), wagmi and react-query. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}
