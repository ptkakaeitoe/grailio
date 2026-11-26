"use client";

import { useEffect, useRef, useState } from "react";

export type ChartPoint = { t: number; p: number };

const H = 260;
const PAD = { top: 12, right: 64, bottom: 24, left: 0 };

const priceLabel = (p: number) =>
  p >= 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : p >= 1 ? `$${p.toFixed(2)}` : `$${p.toPrecision(3)}`;
const timeLabel = (t: number, span: number) =>
  new Date(t).toLocaleString("en-US", span > 2 * 86_400_000 ? { month: "short", day: "numeric" } : { hour: "numeric", minute: "2-digit" });

/**
 * A price chart: area line with price gridlines on the right, start / end times below, a dashed line at the last
 * price, and a crosshair that shows the price and time under the pointer (touch too).
 */
export function PriceChart({ points, up, height = H }: { points: ChartPoint[]; up: boolean; height?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real width, so text keeps its size and the pointer maps 1:1.
  const [W, setW] = useState(640);
  const drawn = points.length >= 2;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawn]);
  if (!drawn) return <div ref={box} />;

  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const ps = points.map((x) => x.p);
  let lo = Math.min(...ps), hi = Math.max(...ps);
  if (hi === lo) { hi *= 1.01; lo *= 0.99; }
  const span = hi - lo;
  const t0 = points[0].t, t1 = points.at(-1)!.t, tspan = t1 - t0 || 1;
  const x = (t: number) => PAD.left + ((t - t0) / tspan) * innerW;
  const y = (p: number) => PAD.top + (1 - (p - lo) / span) * innerH;
  const line = points.map((pt, i) => `${i ? "L" : "M"}${x(pt.t).toFixed(1)},${y(pt.p).toFixed(1)}`).join(" ");
  const color = up ? "var(--up)" : "var(--down)";
  const grid = [0, 1, 2, 3].map((i) => lo + (span * i) / 3);
  const last = points.at(-1)!;
  const h = hover === null ? null : points[hover];

  function move(clientX: number) {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const t = t0 + ((((clientX - box.left) / box.width) * W - PAD.left) / innerW) * tspan;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  }

  return (
    <div ref={box} className="relative">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none select-none"
        style={{ height }}
        role="img"
        aria-label={`Price chart, ${priceLabel(points[0].p)} to ${priceLabel(last.p)}`}
        onPointerMove={(e) => move(e.clientX)}
        onPointerDown={(e) => move(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            <text x={W - 4} y={y(g) + 4} textAnchor="end" className="fill-[var(--muted)] text-[11px] tabular-nums">{priceLabel(g)}</text>
          </g>
        ))}
        <path d={`${line} L${x(t1)},${PAD.top + innerH} L${x(t0)},${PAD.top + innerH} Z`} fill={color} opacity={0.1} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={PAD.left} x2={PAD.left + innerW} y1={y(last.p)} y2={y(last.p)} stroke={color} strokeDasharray="4 4" opacity={0.6} vectorEffect="non-scaling-stroke" />
        <text x={PAD.left} y={height - 6} className="fill-[var(--muted)] text-[11px]">{timeLabel(t0, tspan)}</text>
        <text x={PAD.left + innerW} y={height - 6} textAnchor="end" className="fill-[var(--muted)] text-[11px]">{timeLabel(t1, tspan)}</text>
        {h && (
          <g>
            <line x1={x(h.t)} x2={x(h.t)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ink-soft, currentColor)" opacity={0.4} vectorEffect="non-scaling-stroke" />
            <circle cx={x(h.t)} cy={y(h.p)} r={4} fill={color} />
          </g>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-1 left-1 rounded-md border border-border bg-white px-2 py-1 text-[12px] tabular-nums shadow-sm">
          {priceLabel(h.p)} <span className="text-muted">· {new Date(h.t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </div>
      )}
    </div>
  );
}
