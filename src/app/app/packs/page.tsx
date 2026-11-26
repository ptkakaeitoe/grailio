import type { Metadata } from "next";
import { PackMarket } from "@/components/pack-market";

export const metadata: Metadata = { title: "Packs", description: "Pack marketplace: every coin launches with its own packs." };

export default function PacksMarketPage() {
  return <PackMarket />;
}
