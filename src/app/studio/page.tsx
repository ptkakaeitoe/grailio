import type { Metadata } from "next";
import { Studio } from "@/components/studio";

export const metadata: Metadata = { title: "Pack Studio", description: "Design a stock pack and publish it to the marketplace." };

export default function StudioPage() {
  return (
    <div className="page">
      <h1 className="pt-6 pb-6 text-[32px] leading-[1.1] font-normal tracking-[-0.02em] desk:pt-10 desk:pb-8 desk:text-[40px]">Pack studio</h1>
      <Studio />
    </div>
  );
}
