import type { Metadata } from "next";
import { PageHeading } from "@/components/clean-ui";
import { Studio } from "@/components/studio";

export const metadata: Metadata = { title: "Pack Studio", description: "Design the stock pack your memecoin's trading fees will fill." };

export default function StudioPage() {
  return (
    <div className="page">
      <PageHeading
        label="pack studio"
        title="Design your pack."
        subtitle="Every trade fills it."
        intro="Choose the stocks, the look and the rarity tiers before the memecoin launches. Trading fees buy the basket and holders get the packs."
      />
      <Studio />
    </div>
  );
}
