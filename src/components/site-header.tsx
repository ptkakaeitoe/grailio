"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, LineChart, Package, Paintbrush, Plus, X } from "lucide-react";
import { cleanLink, cn } from "@/components/clean-ui";
import { HeaderWallet } from "@/components/wallet-entry";
import { exitDemo, useDemo } from "@/lib/demo";

/*
 * Graily's app chrome, mobile first. Phones: a slim top bar (wordmark, wallet) and an app-style tab bar at the
 * bottom with Launch as the centre button. From 801px: graily's top bar with the lowercase nav in the middle.
 */

const NAV = [
  { label: "Packs", href: "/app/packs", icon: Package },
  { label: "Collection", href: "/app/collection", icon: LayoutGrid },
  { label: "Launch", href: "/launch", icon: Plus },
  { label: "Stocks", href: "/app/stocks", icon: LineChart },
  { label: "Studio", href: "/studio", icon: Paintbrush },
] as const;

const isCurrent = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Demo on: a chip with the demo balance that leaves demo when tapped (graily's "demo ×"). */
function DemoChip() {
  const demo = useDemo();
  if (!demo.active) return null;
  return (
    <button type="button" onClick={exitDemo} aria-label="Exit demo mode"
      className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border-strong px-2.5 text-sm lowercase transition-colors hover:border-black">
      demo <span className="num text-muted max-phone:hidden">{demo.bnb.toFixed(3)} bnb</span> <X className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const demo = useDemo();
  return (
    <header className="sticky top-0 z-40 border-b border-hair bg-[rgb(17_17_17/.82)] pt-[env(safe-area-inset-top)] backdrop-blur-[14px]">
      <div className="mx-auto flex h-[var(--header-h)] max-w-[1600px] items-center gap-4 px-[var(--gutter)] desk:grid desk:grid-cols-[1fr_auto_1fr] desk:gap-6">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2 desk:justify-self-start">
          <span className="wordmark text-[24px] desk:text-[26px]">bsctemp</span>
          <span className="rounded-[3px] bg-black px-1.5 py-[3px] font-mono text-[10px] leading-none font-medium tracking-[0.08em] text-white uppercase">testnet</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-5 desk:flex wide:gap-[34px]">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={cleanLink} aria-current={isCurrent(path, item.href) ? "page" : undefined}>
              {item.label.toLowerCase()}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-3 desk:justify-self-end">
          <DemoChip />
          {!demo.active && <HeaderWallet />}
        </div>
      </div>
    </header>
  );
}

/** Phones only: the app's tab bar, in thumb reach. Launch is the raised centre button. */
export function BottomTabs() {
  const path = usePathname();
  return (
    <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-40 border-t border-hair bg-[rgb(17_17_17/.9)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[14px] desk:hidden">
      <ul className="mx-auto grid h-[var(--tabbar-h)] max-w-[560px] grid-cols-5">
        {NAV.map(({ label, href, icon: Icon }) => {
          const current = isCurrent(path, href);
          const center = href === "/launch";
          return (
            <li key={href} className="grid">
              <Link href={href} aria-current={current ? "page" : undefined}
                className={cn("flex flex-col items-center justify-center gap-1 text-[11px] transition-colors", current ? "text-ink" : "text-ink-faint hover:text-ink")}>
                {center ? (
                  <span className={cn("grid size-11 place-items-center rounded-full transition-colors", current ? "bg-ink text-bg" : "bg-ink text-bg")} aria-hidden="true"><Icon className="size-5" /></span>
                ) : (
                  <Icon className="size-[22px]" aria-hidden="true" />
                )}
                <span className={center ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
