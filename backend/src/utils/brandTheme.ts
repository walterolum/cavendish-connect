/**
 * Builds the site's colour ramps from the two colours an admin picks.
 *
 * The admin's primary colour is used exactly for buttons (step 600) and the
 * accent exactly for highlights (step 400); the lighter and darker steps are
 * generated in OKLCH, a colour space where equal steps look equally different
 * to the eye, so any brand colour gets an even, usable palette.
 */

export const DEFAULT_PRIMARY = '#1442a3';
export const DEFAULT_ACCENT = '#ffc81f';
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const HEX = /^#([0-9a-f]{6})$/i;

export const isHexColor = (v: string) => HEX.test(v);

type Lch = { l: number; c: number; h: number };

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
}

function rgbToOklch([r, g, b]: number[]): Lch {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: Math.atan2(B, A) };
}

/** OKLCH -> linear sRGB (may be out of gamut). */
function oklchToLinear({ l, c, h }: Lch): [number, number, number] {
  const A = c * Math.cos(h);
  const B = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

/** Converts to hex, lowering chroma until the colour fits in sRGB. */
function oklchToHex(col: Lch): string {
  let c = col.c;
  for (let i = 0; i < 30; i++) {
    const lin = oklchToLinear({ ...col, c });
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) return rgbToHex(lin.map(fromLinear));
    c *= 0.9;
  }
  return rgbToHex(oklchToLinear({ ...col, c: 0 }).map(fromLinear));
}

/** Target lightness per step; the anchor step keeps the admin's exact colour. */
const LIGHTNESS = [0.975, 0.94, 0.885, 0.8, 0.7, 0.6, 0.5, 0.43, 0.36, 0.3, 0.22];
/** How much of the base chroma each step keeps (pale and very dark steps are calmer). */
const CHROMA = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 1, 0.95, 0.85, 0.75, 0.6];

export function ramp(baseHex: string, anchorStep: (typeof STEPS)[number]): Record<number, string> {
  const base = rgbToOklch(hexToRgb(isHexColor(baseHex) ? baseHex : DEFAULT_PRIMARY));
  const anchorIdx = STEPS.indexOf(anchorStep);
  // Shift the lightness curve so the anchor step lands on the base colour.
  const shift = base.l - LIGHTNESS[anchorIdx];
  // Lightness per step, then forced to step down steadily so 50 is always the
  // palest and 950 the darkest, even for very light or very dark base colours.
  const ls = STEPS.map((_, i) => {
    if (i === anchorIdx) return base.l;
    const weight = i < anchorIdx ? (anchorIdx - i) / anchorIdx : (i - anchorIdx) / (STEPS.length - 1 - anchorIdx);
    return Math.min(0.985, Math.max(0.12, LIGHTNESS[i] + shift * (1 - weight)));
  });
  for (let i = anchorIdx - 1; i >= 0; i--) ls[i] = Math.min(0.985, Math.max(ls[i], ls[i + 1] + 0.012));
  for (let i = anchorIdx + 1; i < ls.length; i++) ls[i] = Math.max(0.1, Math.min(ls[i], ls[i - 1] - 0.025));
  for (let i = 1; i < anchorIdx; i++) ls[i] = Math.min(ls[i], ls[i - 1] - 0.004);

  const out: Record<number, string> = {};
  STEPS.forEach((step, i) => {
    out[step] = i === anchorIdx ? baseHex.toLowerCase() : oklchToHex({ l: ls[i], c: base.c * CHROMA[i], h: base.h });
  });
  return out;
}

/** WCAG relative luminance and contrast ratio, for the admin's readability warnings. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = hexToRgb(hex).map(toLinear);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** The stylesheet every page loads before it paints (/brand.css). */
export function brandCss(primaryHex: string, accentHex: string): string {
  const primary = isHexColor(primaryHex) ? primaryHex : DEFAULT_PRIMARY;
  const accent = isHexColor(accentHex) ? accentHex : DEFAULT_ACCENT;
  const p = ramp(primary, 600);
  const a = ramp(accent, 400);
  const vars = (name: string, r: Record<number, string>) => STEPS.map((s) => `--color-${name}-${s}:${r[s]};`).join('');
  // Dark mode: the two palest brand steps become deep tints of the same hue.
  const base = rgbToOklch(hexToRgb(primary));
  const dark50 = oklchToHex({ l: 0.27, c: Math.min(base.c, 0.08), h: base.h });
  const dark100 = oklchToHex({ l: 0.32, c: Math.min(base.c, 0.1), h: base.h });
  return (
    `/* Generated from the colours in Admin > Appearance */\n` +
    `:root{${vars('brand', p)}${vars('accent', a)}--brand-primary:${primary};--brand-accent:${accent};}\n` +
    `:root.dark{--color-brand-50:${dark50};--color-brand-100:${dark100};}\n`
  );
}
