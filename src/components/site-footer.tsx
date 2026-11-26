import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { cleanLink } from "@/components/clean-ui";
import { REPO_URL } from "@/lib/site";
import { DemoFooterControls } from "@/components/demo-footer-controls";
import { NetworkSwitch } from "@/components/network-switch";

/** Site footer: wordmark, page links, source and the Testnet / Mainnet switch. Phones have the tab bar, so they only get the demo controls (with the switch). */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1600px] px-[var(--gutter)] desk:mt-32">
      {/* Three columns like the header, so the links sit in the true centre whatever the widths either side. */}
      <div className="hidden grid-cols-[1fr_auto_1fr] items-center gap-8 pt-6 pb-10 desk:grid">
        <Link href="/" className="wordmark justify-self-start text-2xl">grailio</Link>
        <nav aria-label="Footer navigation" className="flex flex-wrap justify-center gap-x-[34px] gap-y-2">
          <Link href="/app/packs" className={cleanLink}>packs</Link>
          <Link href="/app/trade" className={cleanLink}>trade</Link>
          <Link href="/launch" className={cleanLink}>launch</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={cleanLink}>source <ArrowUpRightIcon weight="bold" /></a>
        </nav>
        <div className="justify-self-end"><NetworkSwitch /></div>
      </div>
      <DemoFooterControls />
    </footer>
  );
}
