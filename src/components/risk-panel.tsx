"use client";

import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { DROP_PCT, displayTitle, type RiskCheck, type RiskDecision } from "@/lib/risk";
import { usd } from "@/lib/format";
import { cn } from "@/components/clean-ui";

/*
 * The vault's Cournot risk check on a coin's pack page: the exact question, the market Cournot matched, its
 * probability, what that decided (which tiers stay on sale) and Cournot's evidence as returned.
 * Page views only read the saved check; "Run risk check" makes the live call.
 */

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const when = (ms: number) => new Date(ms).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Renders Cournot's evidence without changing it: objects as label/value rows, arrays as lists. */
function Evidence({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value == null || value === "") return <span className="text-muted">—</span>;
  if (typeof value === "string") {
    const link = value.match(/^https?:\/\/\S+$/);
    return link ? <a href={value} target="_blank" rel="noreferrer" className="break-all underline underline-offset-2">{value}</a> : <span className="break-words">{value}</span>;
  }
  if (typeof value === "number") return <span className="num">{value >= 0 && value <= 1 && !Number.isInteger(value) ? `${value} (${pct(value)})` : value.toLocaleString()}</span>;
  if (typeof value === "boolean") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <ul className={cn("flex flex-col gap-2", depth > 0 && "mt-1")}>
        {value.map((v, i) => <li key={i} className="min-w-0 rounded-md bg-surface-muted px-3 py-2"><Evidence value={v} depth={depth + 1} /></li>)}
      </ul>
    );
  }
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5 phone:grid-cols-[minmax(90px,auto)_1fr]">
      {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted max-phone:mt-1 max-phone:first:mt-0">{k.replace(/_/g, " ")}</dt>
          <dd className="min-w-0"><Evidence value={v} depth={depth + 1} /></dd>
        </div>
      ))}
    </dl>
  );
}

export function RiskPanel({ coin, onDecision }: { coin: string; onDecision: (d: RiskDecision | null) => void }) {
  const [check, setCheck] = useState<RiskCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/risk/${coin}`).then((r) => r.json()).then((d) => { if (live) setCheck(d.check ?? null); })
      .catch(() => { if (live) setError("Couldn't load the last risk check."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [coin]);

  useEffect(() => { onDecision(check?.decision ?? null); }, [check, onDecision]);

  async function run() {
    setRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/risk/${coin}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "The risk check failed.");
      setCheck(d.check);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The risk check failed.");
    } finally {
      setRunning(false);
    }
  }

  const paused = check && (!check.decision.highOpen || !check.decision.mediumOpen);
  const pausedNames = check ? [!check.decision.mediumOpen && "Medium", !check.decision.highOpen && "High"].filter(Boolean).join(" and ") : "";

  return (
    <section className="mb-5 rounded-md border border-border desk:mb-6" aria-label="Risk check">
      {/* The button drops under the text when the row is too narrow (phones), so the copy keeps its width. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3 px-4 py-3.5">
        {check && paused ? <ShieldAlert className="mt-1 size-4 shrink-0 text-warn" /> : <ShieldCheck className="mt-1 size-4 shrink-0 text-muted" />}
        <div className="min-w-0 flex-1 basis-[220px]">
          <p className="text-base">
            {loading ? "Loading risk check…"
              : !check ? "No risk check yet"
              : paused ? `${pausedNames} paused by the risk check`
              : "Risk check: all tiers on sale"}
          </p>
          {check && (
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
              Cournot: <span className="num text-black">{pct(check.chanceOfDrop)}</span> chance of a {Math.round(DROP_PCT * 100)}% drop in {check.stock.ticker} · {when(check.checkedAt)}
            </p>
          )}
        </div>
        <button type="button" onClick={run} disabled={running || loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-border-strong px-3.5 text-sm transition-colors hover:border-black disabled:cursor-not-allowed disabled:opacity-50 max-phone:ml-7 desk:min-h-9 desk:px-3 desk:text-[13px]">
          <RefreshCw className={cn("size-3.5", running && "animate-spin")} /> {running ? "Checking…" : check ? "Re-check" : "Run risk check"}
        </button>
      </div>

      {error && <p className="border-t border-border px-4 py-3 text-[13px] break-words text-down" role="alert">{error}</p>}

      {check && (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            className="flex min-h-11 w-full items-center justify-between border-t border-border px-4 py-2.5 text-left text-[13px] text-muted transition-colors hover:text-black">
            Claim, market and evidence <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
          {open && (
            <div className="flex flex-col gap-4 border-t border-border px-4 py-4 text-[13px] leading-relaxed break-words">
              <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2 phone:grid-cols-[110px_minmax(0,1fr)]">
                <dt className="text-muted">Question sent</dt><dd>{check.claim}</dd>
                <dt className="text-muted">Atlas price</dt><dd className="num">{usd(check.stock.price)} ({check.stock.name})</dd>
                <dt className="text-muted">Market</dt><dd>{displayTitle(check.market.title)}</dd>
                <dt className="text-muted">Cournot (YES)</dt><dd className="num">{pct(check.probabilityYes)}</dd>
                <dt className="text-muted">Chance of drop</dt>
                <dd>
                  <span className="num">{pct(check.chanceOfDrop)}</span>
                  <span className="text-muted"> · added by this app: {check.badIfYes ? "YES means the stock fell to the level" : "NO means the stock closed under the level"}</span>
                </dd>
                <dt className="text-muted">Decision</dt>
                <dd>Medium {check.decision.mediumOpen ? "on sale" : "paused"} · High {check.decision.highOpen ? "on sale" : "paused"} · Low always on sale</dd>
                {check.billing && <><dt className="text-muted">Cournot call</dt><dd>{check.billing}</dd></>}
              </dl>
              <div>
                <p className="mb-2 font-medium">Cournot assessment</p>
                {Object.keys(check.result).length ? <Evidence value={check.result} /> : <p>Probability <span className="num">{check.probabilityYes} ({pct(check.probabilityYes)})</span>. No other assessment fields were saved for this check.</p>}
              </div>
              <div>
                <p className="mb-2 font-medium">Cournot evidence</p>
                {check.basis && (typeof check.basis !== "object" || Object.keys(check.basis).length) ? <Evidence value={check.basis} /> : <p className="text-muted">Cournot returned no external evidence for this market.</p>}
              </div>
              <p className="text-[12px] text-muted">Cournot&apos;s output is an assessment of market pricing, not investment advice.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
