"use client";

import { useState } from "react";

import { cleanChip, cn } from "@/components/clean-ui";

import { TabActivity } from "./tab-activity";
import { TabDemoDrawer } from "./tab-demo-drawer";
import { TabPool } from "./tab-pool";
import { TabStaking } from "./tab-staking";
import type { CoinPack } from "./types";

type Tab = "pool" | "staking" | "activity";
const TABS: [Tab, string][] = [["pool", "Pool"], ["staking", "Staking"], ["activity", "Activity"]];

/** Under the pack and buy panel: the coin's stock pool, card staking and recent activity, plus demo controls in demo mode. */
export function CoinTabs({ pack }: { pack: CoinPack }) {
  const [tab, setTab] = useState<Tab>("pool");
  return (
    <section className="mt-12 border-t border-border pt-8 desk:mt-16" aria-label="Pool, staking and activity">
      <div className="flex gap-1.5" role="tablist" aria-label="Coin details">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={cn(cleanChip, "min-h-10 px-4 aria-selected:border-black aria-selected:bg-black aria-selected:text-white")} onClick={() => setTab(id)}>
            {label}
            {id === "staking" && pack.staking && pack.staking.staked.length > 0 && <span className="ml-1.5 tabular-nums opacity-70">{pack.staking.staked.length}</span>}
          </button>
        ))}
      </div>
      <div className="mt-6" role="tabpanel">
        {tab === "pool" && <TabPool pack={pack} />}
        {tab === "staking" && <TabStaking pack={pack} />}
        {tab === "activity" && <TabActivity pack={pack} />}
      </div>
      {pack.demo && <TabDemoDrawer demo={pack.demo} />}
    </section>
  );
}
