import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cleanChip, cleanField, cn } from "@/components/clean-ui";

/** The Trade tabs' chips: quick views, Filter and Refresh. */
export const toolbarChip = cn(cleanChip, "min-h-11 shrink-0 px-4 desk:min-h-9 desk:px-3");

/** A small grey status line for the list (counts, freshness), dot-separated by the caller. */
export function ToolbarStatus({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted tabular-nums", className)}>{children}</p>;
}

/**
 * The one toolbar every Trade tab uses: quick views on the left, the status line, then search (and any extra actions,
 * like Filter and Refresh) on the right. Below 1201px the status line drops under the row; phones stack the views above
 * the search.
 */
export function TradeToolbar<V extends string>({
  views,
  view,
  onView,
  status,
  query,
  onQuery,
  placeholder,
  searchLabel,
  upper = false,
  actions,
}: {
  views: readonly (readonly [V, string])[];
  view: V;
  onView: (view: V) => void;
  status: ReactNode;
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  searchLabel: string;
  /** Show what's typed in capitals (tickers). */
  upper?: boolean;
  actions?: ReactNode;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 desk:flex-row desk:items-center desk:gap-6">
        <div className="flex shrink-0 gap-1.5" role="group" aria-label="View">
          {views.map(([id, label]) => (
            <button key={id} type="button" className={cn(toolbarChip, "desk:min-h-10 desk:px-4")} aria-pressed={view === id} onClick={() => onView(id)}>{label}</button>
          ))}
        </div>
        <ToolbarStatus className="hidden min-w-0 flex-1 wide:flex">{status}</ToolbarStatus>
        <div className="flex items-center gap-2 desk:ml-auto desk:w-[min(420px,50%)] wide:ml-0">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
            <input
              className={cn(cleanField, "num pl-10 text-sm placeholder:normal-case placeholder:text-muted desk:h-10", upper && "uppercase")}
              placeholder={placeholder}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              aria-label={searchLabel}
            />
          </label>
          {actions}
        </div>
      </div>
      <ToolbarStatus className="-mt-2 wide:hidden">{status}</ToolbarStatus>
    </>
  );
}

/** The bordered table frame shared by the bStocks and Tokens lists (from 801px). */
export const tradeTable = {
  frame: "hidden overflow-hidden rounded-md border border-border desk:block",
  table: "w-full text-sm",
  head: "bg-surface-muted text-left text-[12px] text-muted",
  th: "px-4 py-2.5 font-normal",
  row: "relative border-t border-border transition-colors hover:bg-surface-muted",
  td: "px-4 py-3",
  /** Make the row's main link cover the whole row. */
  rowLink: "after:absolute after:inset-0 after:content-['']",
};

/** The phone list frame shared by the bStocks and Tokens lists (below 801px). */
export const tradeList = {
  frame: "border-y border-border desk:hidden",
  item: "border-b border-border last:border-b-0",
  link: "flex min-h-16 items-center gap-3 py-3 transition-colors hover:bg-surface-muted",
};
