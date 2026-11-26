import type { Metadata } from "next";
import { CollectionPanel } from "@/components/collection-panel";

export const metadata: Metadata = { title: "Collection", description: "Your cards: flip for details, redeem to burn a card for the bStocks inside." };

export default function CollectionPage() {
  return (
    <div className="page pt-10 desk:pt-14">
      <h1 className="display mb-8 text-[clamp(36px,4.5vw,56px)]">Collection</h1>
      <CollectionPanel />
    </div>
  );
}
