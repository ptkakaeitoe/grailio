import { useId } from "react";

/** One hue: oranges from light to deep, with a near-black cartoon outline. */
const INK = "#1a0d05";
const ORANGE = { light: "#ffb35e", face: "#ff8c1a", ring: "#ff7d0f", deep: "#e0600a", edge: "#c75009" };

/** The face is an ellipse (a coin turned about a third of the way); the rim shows to its right. */
const FACE = { cx: 90, cy: 120, rx: 60, ry: 100 };
const DEPTH = 22;

/** Ridges across the visible rim, from the face's right edge back to the rim's. */
const RIDGES = Array.from({ length: 17 }, (_, i) => {
  const t = -0.88 + (i * 1.76) / 16;
  const x = FACE.cx + FACE.rx * Math.sqrt(1 - t * t);
  const y = FACE.cy + FACE.ry * t;
  return `M${x.toFixed(1)} ${y.toFixed(1)}h${DEPTH}`;
}).join("");

/**
 * The hero's coin: a cartoon orange memecoin turned three-quarters, with a ridged rim and a stamped rocket. SVG with
 * one group per part, ready to animate: `.coin-edge` (rim and ridges), `.coin-face`, `.coin-emblem` and `.coin-shine`
 * (each set to `transform-box: fill-box` and centred).
 */
export function MemeCoin({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 200 240" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-rim`}>
          <ellipse cx={FACE.cx + DEPTH} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} />
        </clipPath>
      </defs>

      <g className="coin-edge transform-fill origin-center">
        {/* The rim: the same ellipse pushed back, filled deeper orange and grooved. */}
        <ellipse cx={FACE.cx + DEPTH} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} fill={ORANGE.edge} />
        <path d={RIDGES} stroke={INK} strokeWidth="3" strokeLinecap="round" clipPath={`url(#${id}-rim)`} />
        <ellipse cx={FACE.cx + DEPTH} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} fill="none" stroke={INK} strokeWidth="5.5" />
      </g>

      <g className="coin-face transform-fill origin-center">
        <ellipse cx={FACE.cx} cy={FACE.cy} rx={FACE.rx} ry={FACE.ry} fill={ORANGE.face} stroke={INK} strokeWidth="5.5" />
        {/* The raised inner ring, with a lip of shadow along its right side. */}
        <ellipse cx={FACE.cx + 2} cy={FACE.cy + 1} rx="45" ry="78" fill={ORANGE.deep} />
        <ellipse cx={FACE.cx} cy={FACE.cy} rx="43" ry="76" fill={ORANGE.ring} stroke={INK} strokeWidth="4.5" />
      </g>

      {/* Positioned by the outer group, so a CSS transform on .coin-emblem animates it without moving it off the face. */}
      <g transform={`translate(${FACE.cx} ${FACE.cy}) scale(.78 1)`}>
      <g className="coin-emblem transform-fill origin-center">
        {/* A stamped rocket: a deep-orange shadow copy, then the raised one on top. */}
        <g transform="translate(4 4)" fill={ORANGE.deep}>
          <path d="M0 -50 C17 -36 21 -10 18 18 L-18 18 C-21 -10 -17 -36 0 -50 Z" />
          <path d="M-17 2 L-33 30 L-17 22 Z M17 2 L33 30 L17 22 Z M-9 22 Q0 46 9 22 Z" />
        </g>
        <g fill={ORANGE.light} stroke={INK} strokeWidth="4" strokeLinejoin="round">
          <path d="M-17 2 L-33 30 L-17 22 Z" />
          <path d="M17 2 L33 30 L17 22 Z" />
          <path d="M-9 20 Q0 46 9 20 Z" />
          <path d="M0 -50 C17 -36 21 -10 18 18 L-18 18 C-21 -10 -17 -36 0 -50 Z" />
          <circle cx="0" cy="-10" r="9" fill={ORANGE.deep} />
        </g>
      </g>
      </g>

      <g className="coin-shine transform-fill origin-center" fill="none" stroke={ORANGE.light} strokeLinecap="round">
        {/* Cartoon gloss in the same hue: a light stroke down the face's left side. */}
        <path d="M44 86 Q46 56 62 38" strokeWidth="6" />
        <path d="M42 112 v14" strokeWidth="6" />
      </g>
    </svg>
  );
}
