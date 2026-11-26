import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { cleanLink } from "@/components/clean-ui";
import { REPO_URL } from "@/lib/site";
import { DemoFooterControls } from "@/components/demo-footer-controls";
import { NetworkSwitch } from "@/components/network-switch";

/** Site footer: wordmark, page links, source and the Testnet / Mainnet switch. Phones have the tab bar, so they only get the demo controls (with the switch). */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1440px] px-[var(--gutter)] desk:mt-32 desk:border-t desk:border-border">
      <div className="hidden flex-wrap items-center justify-between gap-8 pt-6 pb-10 desk:flex">
        <Link href="/" className="wordmark text-2xl">grailio</Link>
        <nav aria-label="Footer navigation" className="order-3 flex w-full flex-wrap gap-x-[22px] gap-y-2 desk:order-none desk:w-auto desk:gap-x-[34px]">
          <Link href="/app/packs" className={cleanLink}>packs</Link>
          <Link href="/app/trade" className={cleanLink}>trade</Link>
          <Link href="/launch" className={cleanLink}>launch</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={cleanLink}>source <ArrowUpRightIcon weight="bold" /></a>
        </nav>
        <NetworkSwitch />
      </div>
      <DemoFooterControls />
    </footer>
  );
}
