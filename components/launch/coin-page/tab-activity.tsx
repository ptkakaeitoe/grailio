"use client";

import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { useEffect, useState } from "react";

import { ago } from "./tab-format";
import type { CoinPack } from "./types";

/** Recent buys, opens and launches for this coin, newest first. */
export function TabActivity({ pack }: { pack: CoinPack }) {
  // Clock starts at 0 and is set after mount, so the server render never reads the time.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  const items = [...pack.activity].sort((a, b) => b.at - a.at);

  if (items.length === 0) {
    return <p className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center text-sm text-muted">No activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((i) => {
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{i.label}</span>
              {i.detail && <span className="block truncate text-[13px] text-muted">{i.detail}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted tabular-nums">
              {now ? ago(i.at, now) : ""}
              {i.href && <ArrowUpRightIcon weight="bold" className="size-3" aria-hidden="true" />}
            </span>
          </>
        );
        return (
          <li key={i.id}>
            {i.href ? (
              <a href={i.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 py-3 hover:underline hover:underline-offset-4">{body}</a>
            ) : (
              <div className="flex items-center gap-3 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
