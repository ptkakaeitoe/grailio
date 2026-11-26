"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties } from "react";
import { CheckIcon, ImageSquareIcon, StackIcon, XIcon } from "@phosphor-icons/react/ssr";
import { SealedPack } from "@/components/launch/pack-shop";
import { Holo, StockCardFront, tilt } from "@/components/stock-card-front";
import { cleanField, cn } from "@/components/clean-ui";
import { PACK_COVER, SET_FOR_SIZE, cardArt, type ArtSet, type StockCard } from "@/lib/launch/cards";
import { DEFAULT_CONFIG, DEFAULT_SIZES, RARITIES, RARITY_DOT, updatePack, type CardDesign, type PackConfig, type Pattern } from "@/lib/launch/pack";

/*
 * Step 3 of the Launch flow: use the app's default pack and card art, or design the pack cover and one card per
 * rarity. The choice is saved with the pack as `design`; a custom design also saves `cover`, `pattern`, `tone` and
 * `cards` (title, colour, art set or a small uploaded image per rarity).
 */

export const PIC_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const PIC_MAX_MB = 2;
export const COIN_TONES = ["#2f5f8f", "#3a1f5c", "#2b8a3e", "#c2255c", "#c78a5c", "#d9480f", "#0c8599", "#202020"];
const CARD_TONES = ["#8a9183", "#779bad", "#9883aa", "#b29451", "#c2255c", "#2b8a3e", "#d9480f", "#0c8599"];
const PATTERNS: Pattern[] = ["plain", "stripes", "dots", "grid"];
const SETS: ArtSet[] = ["fable", "saga", "mythos"];
const PREVIEW_SIZE = DEFAULT_SIZES.find((s) => s.id === "standard") ?? DEFAULT_SIZES[0];

const label = "mb-2 block text-sm text-muted";
const option = "flex min-h-14 items-center gap-3 rounded-md border border-border px-4 text-left transition-colors hover:border-border-strong aria-pressed:border-black aria-pressed:bg-black aria-pressed:text-white";
const tile = "relative grid h-14 place-items-center overflow-hidden rounded-md border-2 border-border text-xs capitalize transition-[border-color] hover:border-border-strong aria-pressed:border-black";
const swatch = "grid h-11 place-items-center rounded-md border-2 border-transparent transition-[border-color] aria-pressed:border-black";

/** Center-crops an image file to w×h and returns a small JPEG data URL, so it can be saved with the pack. */
export function shrinkImage(file: File, w: number, h: number, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("no canvas")); return; }
      const scale = Math.min(img.width / w, img.height / h);
      const sw = w * scale, sh = h * scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

/** Checks and shrinks a picked file; returns the data URL or an error message. */
export async function readPicture(file: File, w: number, h: number, quality?: number): Promise<{ url: string } | { error: string }> {
  if (!PIC_TYPES.includes(file.type)) return { error: "Use a PNG, JPG, WebP or GIF." };
  if (file.size > PIC_MAX_MB * 1024 * 1024) return { error: `Keep it under ${PIC_MAX_MB} MB.` };
  try { return { url: await shrinkImage(file, w, h, quality) }; } catch { return { error: "That image couldn't be read." }; }
}

/** What gets saved with the pack for the chosen design: the defaults drop any custom art. */
export function designPatch(c: PackConfig): Partial<PackConfig> {
  return c.design === "custom" ? { design: "custom" } : { design: "default", cover: null, pattern: DEFAULT_CONFIG.pattern, cards: DEFAULT_CONFIG.cards };
}

/* ---------- colour helpers (same maths as the marketplace's pack colours) ---------- */

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
function mix(color: string, target: string, amount: number) {
  const a = color.replace("#", ""), b = target.replace("#", "");
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `#${[0, 2, 4].map((i) => hex(ch(a, i) + (ch(b, i) - ch(a, i)) * amount)).join("")}`;
}
function ink(bg: string) {
  const c = bg.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? mix(bg, "#000000", 0.82) : mix(bg, "#ffffff", 0.85);
}

/** The pack sleeve's background for a tone, pattern and optional cover image. */
export function coverStyle(tone: string, pattern: Pattern, cover: string | null | undefined): CSSProperties {
  if (cover) return { background: `linear-gradient(180deg, rgb(0 0 0 / .3), rgb(0 0 0 / .6)), url("${cover}") center / cover, ${tone}`, color: "#fff" };
  const soft = mix(tone, ink(tone), 0.18);
  switch (pattern) {
    case "stripes": return { background: `repeating-linear-gradient(135deg, ${tone} 0 14px, ${soft} 14px 28px)` };
    case "dots": return { background: `radial-gradient(circle, ${soft} 2.2px, transparent 2.8px) 0 0 / 16px 16px, ${tone}` };
    case "grid": return { background: `linear-gradient(${soft} 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(90deg, ${soft} 1px, transparent 1px) 0 0 / 18px 18px, ${tone}` };
    default: return { background: tone };
  }
}

/** The card a rarity's design makes: its art set (or the pack size's set), uploaded image, title and colour. */
export function designedCard(d: CardDesign | undefined, rarity: number, ticker: string, sizeId = PREVIEW_SIZE.id): StockCard {
  const base = cardArt(ticker, rarity, d?.set ?? SET_FOR_SIZE[sizeId] ?? "fable");
  if (!d) return base;
  return { ...base, name: d.title.trim() || base.name, src: d.image || base.src, accent: d.color || base.accent };
}

/* ---------- step 3 ---------- */

export function DesignStep({ c, name }: { c: PackConfig; name: string }) {
  const custom = c.design === "custom";
  const [tab, setTab] = useState<"pack" | "cards">("pack");
  const [rarity, setRarity] = useState(0);
  const [error, setError] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);
  const cardInput = useRef<HTMLInputElement>(null);
  const ticker = c.basket[0]?.ticker ?? "";
  const card = c.cards[rarity];

  /** First time in Customize: start from a plain cover and cards named after their art. */
  const customize = () => updatePack((p) => p.design === undefined
    ? { design: "custom", pattern: "plain", cover: null, cards: RARITIES.map((r, i) => ({ ...DEFAULT_CONFIG.cards[i], title: "", color: RARITY_DOT[r], image: null, set: undefined })) }
    : { design: "custom" });
  const setCard = (patch: Partial<CardDesign>) => updatePack((p) => ({ cards: p.cards.map((d, i) => (i === rarity ? { ...d, ...patch } : d)) }));

  async function pick(file: File | undefined, kind: "cover" | "card") {
    if (!file) return;
    const res = kind === "cover" ? await readPicture(file, 190, 330) : await readPicture(file, 220, 220);
    if ("error" in res) { setError(res.error); return; }
    setError("");
    if (kind === "cover") updatePack({ cover: res.url }); else setCard({ image: res.url });
  }
  const uploaded = (v: string | null | undefined) => Boolean(v?.startsWith("data:"));

  return (
    <>
      <div>
        <span className={label}>Design</span>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Design">
          <button type="button" className={cn(option, "justify-center")} aria-pressed={!custom} onClick={() => updatePack({ design: "default" })}>Use defaults</button>
          <button type="button" className={cn(option, "justify-center")} aria-pressed={custom} onClick={customize}>Customize</button>
        </div>
      </div>

      {custom && (
        <div className="flex flex-col gap-5 rounded-md border border-border p-3 phone:p-4">
          <div className="grid grid-cols-2 rounded-md bg-surface-muted p-1" role="tablist" aria-label="Design part">
            {(["pack", "cards"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(""); }}
                className="min-h-11 rounded-[5px] text-sm text-muted capitalize transition-colors aria-selected:bg-black aria-selected:text-white">{t}</button>
            ))}
          </div>

          {tab === "pack" ? (
            <>
              <div className="grid grid-cols-[126px_1fr] items-start gap-4">
                <div className="w-[190px] [zoom:0.66]" aria-hidden="true">
                  <SealedPack size={PREVIEW_SIZE} coin={name || "Coin"} color={{ bg: c.tone, ink: ink(c.tone) }} style={coverStyle(c.tone, c.pattern, c.cover)} />
                </div>
                <div className="min-w-0">
                  <span className={label}>Colour</span>
                  <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Pack colour">
                    {COIN_TONES.map((t) => (
                      <button key={t} type="button" aria-label={`Colour ${t}`} aria-pressed={c.tone === t} onClick={() => updatePack({ tone: t })} className={swatch} style={{ background: t }}>
                        {c.tone === t && <CheckIcon weight="bold" className="size-4 text-[#fff]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <span className={label}>Cover</span>
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Pack cover">
                  {PATTERNS.map((p) => (
                    <button key={p} type="button" className={tile} aria-pressed={!c.cover && c.pattern === p} onClick={() => updatePack({ pattern: p, cover: null })}>
                      <span className="absolute inset-0" style={coverStyle(c.tone, p, null)} aria-hidden="true" />
                      <span className="relative rounded-sm bg-[#000]/60 px-1.5 py-0.5 text-[#fff]">{p}</span>
                    </button>
                  ))}
                  {SETS.map((s) => (
                    <button key={s} type="button" className={tile} aria-pressed={c.cover === PACK_COVER[s]} onClick={() => updatePack({ cover: PACK_COVER[s] })}>
                      <Image src={PACK_COVER[s]} alt="" fill sizes="80px" className="object-cover" />
                      <span className="relative rounded-sm bg-[#000]/60 px-1.5 py-0.5 text-[#fff]">{s}</span>
                    </button>
                  ))}
                  <button type="button" className={tile} aria-pressed={uploaded(c.cover)} aria-label={uploaded(c.cover) ? "Change cover image" : "Upload cover image"} onClick={() => coverInput.current?.click()}>
                    {uploaded(c.cover) ? <Image src={c.cover!} alt="" fill sizes="80px" className="object-cover" /> : <ImageSquareIcon weight="bold" className="size-5 text-muted" />}
                  </button>
                </div>
                <input ref={coverInput} type="file" accept={PIC_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pick(e.target.files?.[0], "cover"); e.target.value = ""; }} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Rarity">
                {RARITIES.map((r, i) => (
                  <button key={r} type="button" role="tab" aria-selected={rarity === i} onClick={() => { setRarity(i); setError(""); }}
                    className="flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-border px-0.5 text-xs capitalize phone:px-1 phone:text-[13px] transition-colors hover:border-border-strong aria-selected:border-black aria-selected:bg-surface-muted">
                    <span className="size-1.5 shrink-0 rounded-full max-phone:hidden" style={{ background: RARITY_DOT[r] }} aria-hidden="true" />
                    <span className="truncate">{r}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[126px_1fr] items-start gap-4">
                <div {...tilt} className="holo-card relative overflow-hidden rounded-[4px]" aria-hidden="true">
                  <StockCardFront art={designedCard(card, rarity, ticker)} rarity={rarity} brand={name || "Coin"} decorative sizes="126px" className="w-full" />
                  <Holo rarity={rarity} />
                  <span className="holo-glare" aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-col gap-3">
                  <div>
                    <label htmlFor="card-title" className={label}>Name</label>
                    <input id="card-title" className={cleanField} maxLength={16} autoComplete="off"
                      value={card.title} placeholder={designedCard({ ...card, title: "" }, rarity, ticker).name} onChange={(e) => setCard({ title: e.target.value })} />
                  </div>
                  <div>
                    <span className={label}>Colour</span>
                    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Card colour">
                      {CARD_TONES.map((t) => (
                        <button key={t} type="button" aria-label={`Colour ${t}`} aria-pressed={card.color === t} onClick={() => setCard({ color: t })} className={swatch} style={{ background: t }}>
                          {card.color === t && <CheckIcon weight="bold" className="size-4 text-[#fff]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <span className={label}>Art</span>
                <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Card art">
                  <button type="button" className={tile} aria-pressed={!card.image && !card.set} aria-label="Art by pack size" onClick={() => setCard({ set: undefined, image: null })}>
                    <StackIcon weight="bold" className="size-5 text-muted" />
                  </button>
                  {SETS.map((s) => (
                    <button key={s} type="button" className={tile} aria-pressed={!card.image && card.set === s} aria-label={`${s} art`} onClick={() => setCard({ set: s, image: null })}>
                      <Image src={cardArt("", rarity, s).src} alt="" fill sizes="64px" className="object-cover" />
                    </button>
                  ))}
                  <button type="button" className={tile} aria-pressed={Boolean(card.image)} aria-label={card.image ? "Change card image" : "Upload card image"} onClick={() => cardInput.current?.click()}>
                    {card.image ? <Image src={card.image} alt="" fill sizes="64px" className="object-cover" /> : <ImageSquareIcon weight="bold" className="size-5 text-muted" />}
                  </button>
                </div>
                {card.image && (
                  <button type="button" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-black" onClick={() => setCard({ image: null })}>
                    <XIcon weight="bold" className="size-3.5" /> Remove image
                  </button>
                )}
                <input ref={cardInput} type="file" accept={PIC_TYPES.join(",")} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void pick(e.target.files?.[0], "card"); e.target.value = ""; }} />
              </div>
            </>
          )}

          {error && <p className="-mt-2 text-sm text-down" role="alert">{error}</p>}
        </div>
      )}
    </>
  );
}
