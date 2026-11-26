import Link from "next/link";
import { ArrowUpRightIcon } from "@phosphor-icons/react/ssr";
import { cleanLink, cn } from "@/components/clean-ui";
import { REPO_URL } from "@/lib/site";
import { DemoFooterControls } from "@/components/demo-footer-controls";

/** Site footer (ported from collectX): wordmark, page links, network, source and credit. */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1440px] border-t border-border px-[var(--gutter)] desk:mt-32">
      <div className="flex flex-wrap items-center justify-between gap-6 pt-6 pb-6 desk:gap-8">
        <Link href="/" className="wordmark text-2xl">bsctemp</Link>
        <nav aria-label="Footer navigation" className="order-3 flex w-full flex-wrap gap-x-[22px] gap-y-2 desk:order-none desk:w-auto desk:gap-x-[34px]">
          <Link href="/app/packs" className={cleanLink}>packs</Link>
          <Link href="/app/stocks" className={cleanLink}>stocks</Link>
          <Link href="/studio" className={cleanLink}>pack studio</Link>
          <Link href="/launch" className={cleanLink}>launch</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className={cleanLink}>source <ArrowUpRightIcon weight="bold" /></a>
        </nav>
        <a href="https://testnet.bscscan.com" target="_blank" rel="noreferrer" className={cleanLink}>bnb chain · testnet <ArrowUpRightIcon weight="bold" /></a>
      </div>
      {/* Credit: the studio's X profile (@Blurrylogics), as in collectX. */}
      <p className="flex items-center gap-2.5 pb-10 text-sm text-muted">
        built by
        <a href="https://x.com/Blurrylogics" target="_blank" rel="noreferrer" className={cn(cleanLink, "text-sm")}>
          <svg viewBox="0 0 1221 512" className="h-3 w-auto shrink-0" aria-hidden="true">
            <circle cx="256" cy="256" r="256" fill="#d0d0d0" />
            <rect x="709" width="512" height="512" fill="#2665ea" />
          </svg>
          blurrylogics <ArrowUpRightIcon weight="bold" />
        </a>
      </p>
      <DemoFooterControls />
    </footer>
  );
}
