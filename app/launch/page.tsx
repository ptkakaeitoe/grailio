import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LaunchFlow } from "@/components/launch/launch-flow";
import { PageShell } from "@/components/page-shell";
import { IS_TESTNET } from "@/lib/network";

export const metadata: Metadata = { title: "Launch — grailio", description: "Launch a coin with its stock pack, or publish a pack collection without a coin." };

/** Testnet only: launch a coin and its pack (the mainnet build has no launch page). */
export default function LaunchPage() {
  if (!IS_TESTNET) notFound();
  return (
    <PageShell>
      <LaunchFlow />
    </PageShell>
  );
}
