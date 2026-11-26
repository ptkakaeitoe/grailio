import type { Metadata } from "next";
import { LaunchFlow } from "@/components/launch-flow";

export const metadata: Metadata = { title: "Launch a coin", description: "Launch a coin with its stock pack: pick its stocks, design its pack and cards, and choose a launchpad." };

export default function LaunchPage() {
  return (
    <div className="page">
      <LaunchFlow />
    </div>
  );
}
