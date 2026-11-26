import type { Metadata } from "next";
import { LaunchFlow } from "@/components/launch-flow";

export const metadata: Metadata = { title: "Launch", description: "Launch a coin with its stock pack, or publish a classic pack collection without a coin: pick its stocks and design its pack and cards." };

export default function LaunchPage() {
  return (
    <div className="page">
      <LaunchFlow />
    </div>
  );
}
