import type { Metadata } from "next";
import { LaunchFlow } from "@/components/launch-flow";

export const metadata: Metadata = { title: "Launch a coin", description: "Launch a coin with its stock pack: pick its stocks, risk and launchpad." };

export default function LaunchPage() {
  return (
    <div className="page">
      <h1 className="pt-6 pb-6 text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:pt-10 desk:pb-8 desk:text-[40px]">Launch a coin</h1>
      <LaunchFlow />
    </div>
  );
}
