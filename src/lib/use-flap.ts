"use client";

import { useReadContracts } from "wagmi";
import { appChain } from "@/lib/chain";
import { FLAP_LAUNCHER_FACTORY, FLAP_PORTAL, FLAP_VAULT_FACTORY, portalAbi } from "@/lib/flap";

/**
 * Whether Flap has enabled our launcher and vault factories on its testnet Portal (both are needed to launch).
 * undefined while loading.
 */
export function useFlapEnabled(): boolean | undefined {
  const { data } = useReadContracts({
    allowFailure: true,
    contracts: [
      { chainId: appChain.id, address: FLAP_PORTAL, abi: portalAbi, functionName: "launcherFactoryMultiplier", args: [FLAP_LAUNCHER_FACTORY] },
      { chainId: appChain.id, address: FLAP_PORTAL, abi: portalAbi, functionName: "vaultFactoryMultiplier", args: [FLAP_VAULT_FACTORY] },
    ],
    query: { refetchInterval: 60_000 },
  });
  if (!data) return undefined;
  return data.every((r) => r.status === "success" && (r.result as readonly [boolean, number])[0]);
}
