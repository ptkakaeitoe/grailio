import { useId, type CSSProperties } from "react";
import { cn } from "@/components/clean-ui";
import { coinArt, seedTone, shade, type Emblem, type Pattern } from "@/lib/coin-art";

/*
 * Generated coin art (lib/coin-art): an emblem on the coin's tone with a soft gradient and pattern. Used wherever a
 * coin used to show its first letter. An uploaded image still wins.
 */

/** The emblem glyph alone, drawn in currentColor on a 0..100 box (also used on sealed packs). */
export function EmblemGlyph({ emblem, tilt = 0 }: { emblem: Emblem; tilt?: number }) {
  const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (emblem) {
    case "planet":
      return (
        <g>
          <circle cx="50" cy="50" r="20" fill="currentColor" />
          <ellipse cx="50" cy="50" rx="36" ry="11" {...stroke} transform={`rotate(${-20 + tilt / 3} 50 50)`} />
          <circle cx="78" cy="26" r="4" fill="currentColor" />
        </g>
      );
    case "flame":
      return <path d="M50 14c6 14 22 22 22 42a22 22 0 0 1-44 0c0-11 6-17 10-22 1 7 4 11 8 12-1-12 1-22 4-32Z" fill="currentColor" />;
    case "wave":
      return (
        <g {...stroke}>
          <path d="M14 40c9-9 18-9 27 0s18 9 27 0 14-7 18-4" />
          <path d="M14 56c9-9 18-9 27 0s18 9 27 0 14-7 18-4" />
          <path d="M14 72c9-9 18-9 27 0s18 9 27 0 14-7 18-4" opacity=".6" />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M18 70 22 32l16 16 12-22 12 22 16-16 4 38Z" fill="currentColor" />
          <rect x="18" y="74" width="64" height="8" rx="2" fill="currentColor" />
        </g>
      );
    case "gem":
      return (
        <g>
          <path d="M30 26h40l14 16-34 38-34-38Z" fill="currentColor" />
          <path d="M16 42h68M38 26l12 54 12-54" fill="none" stroke="var(--coin-bg, #000)" strokeWidth="3" opacity=".45" />
        </g>
      );
    case "moon":
      return (
        <g>
          <path d="M62 16a34 34 0 1 0 22 52 28 28 0 1 1-22-52Z" fill="currentColor" />
          <circle cx="74" cy="30" r="3" fill="currentColor" />
        </g>
      );
    case "bolt":
      return <path d="M56 12 24 56h22l-6 32 34-46H52Z" fill="currentColor" />;
    case "leaf":
      return (
        <g>
          <path d="M24 76C24 40 46 20 80 20c0 36-20 58-56 56Z" fill="currentColor" />
          <path d="M26 74 62 38" fill="none" stroke="var(--coin-bg, #000)" strokeWidth="4" strokeLinecap="round" opacity=".45" />
        </g>
      );
    case "rocket":
      return (
        <g>
          <path d="M50 12c14 10 18 26 16 44H34c-2-18 2-34 16-44Z" fill="currentColor" />
          <path d="M34 50 22 64l14 2M66 50l12 14-14 2" fill="currentColor" />
          <circle cx="50" cy="36" r="6" fill="var(--coin-bg, #000)" opacity=".5" />
          <path d="M44 64c0 8 3 14 6 20 3-6 6-12 6-20" fill="currentColor" opacity=".7" />
        </g>
      );
    case "paw":
      return (
        <g fill="currentColor">
          <ellipse cx="50" cy="64" rx="18" ry="15" />
          <ellipse cx="28" cy="44" rx="7" ry="9" />
          <ellipse cx="42" cy="30" rx="7" ry="9" />
          <ellipse cx="58" cy="30" rx="7" ry="9" />
          <ellipse cx="72" cy="44" rx="7" ry="9" />
        </g>
      );
    case "star":
      return <path d="m50 14 10 24 26 2-20 17 7 25-23-14-23 14 7-25-20-17 26-2Z" fill="currentColor" />;
    case "eye":
      return (
        <g>
          <path d="M12 50c10-16 24-24 38-24s28 8 38 24c-10 16-24 24-38 24S22 66 12 50Z" fill="currentColor" />
          <circle cx="50" cy="50" r="12" fill="var(--coin-bg, #000)" opacity=".55" />
          <circle cx="54" cy="46" r="4" fill="currentColor" />
        </g>
      );
  }
}

function PatternFill({ id, pattern, tilt }: { id: string; pattern: Pattern; tilt: number }) {
  return (
    <pattern id={id} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={`rotate(${tilt})`}>
      {pattern === "dots" && <circle cx="3" cy="3" r="1.4" fill="#fff" />}
      {pattern === "rings" && <circle cx="6" cy="6" r="4" fill="none" stroke="#fff" strokeWidth="0.8" />}
      {pattern === "stripes" && <rect width="4" height="12" fill="#fff" />}
      {pattern === "grid" && <path d="M0 0h12v12" fill="none" stroke="#fff" strokeWidth="0.8" />}
    </pattern>
  );
}

/**
 * A coin's avatar: its uploaded image, or a generated emblem badge. `seed` should be stable (slug or name);
 * `style` (e.g. a custom pack cover) replaces the generated background but keeps the emblem. Size and rounding
 * come from `className`.
 */
export function CoinAvatar({ seed, tone, image, className, style }: { seed: string; tone?: string; image?: string | null; className?: string; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, "");
  if (image) {
    return (
      <span className={cn("grid shrink-0 place-items-center overflow-hidden", className)} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- small data URL saved with the coin */}
        <img src={image} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const art = coinArt(seed);
  const base = tone && /^#[0-9a-f]{6}$/i.test(tone) ? tone : tone || seedTone(seed);
  const hex = base.startsWith("#");
  // Near-black tones (the default #111) get a lift so the gradient still reads.
  const light = hex ? shade(base, 0.28) : base;
  const dark = hex ? shade(base, -0.35) : base;
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden text-[#fff]", className)} style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" style={{ ["--coin-bg" as string]: dark }}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={light} />
            <stop offset="1" stopColor={dark} />
          </linearGradient>
          <PatternFill id={`p${uid}`} pattern={art.pattern} tilt={art.tilt} />
          <radialGradient id={`s${uid}`} cx="0.3" cy="0.25" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity=".28" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {!style && <rect width="100" height="100" fill={`url(#g${uid})`} />}
        <rect width="100" height="100" fill={`url(#p${uid})`} opacity=".1" />
        <rect width="100" height="100" fill={`url(#s${uid})`} />
        <g transform="translate(20 20) scale(0.6)" style={{ filter: "drop-shadow(0 2px 2px rgb(0 0 0 / .3))" }}>
          <EmblemGlyph emblem={art.emblem} tilt={art.tilt} />
        </g>
      </svg>
    </span>
  );
}

/** A coin's ticker as a small pill with its tone (no "$" prefix). */
export function TickerBadge({ ticker, tone, className }: { ticker: string; tone?: string; className?: string }) {
  if (!ticker) return null;
  return (
    <span className={cn("num inline-flex max-w-full items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] leading-none tracking-wide uppercase", className)}>
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: tone && tone !== "#111111" ? tone : "currentColor" }} />
      <span className="truncate">{ticker}</span>
    </span>
  );
}
