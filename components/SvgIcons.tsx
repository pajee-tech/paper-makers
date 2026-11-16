// Free, original, line-art icons for Nursery/KG/Primary picture questions.
// Outline-only so children can also colour them in.
import type { ReactNode } from "react";

const S = { fill: "none", stroke: "#000", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const ICONS: Record<string, { label: string; urdu: string; svg: ReactNode }> = {
  apple: { label: "Apple", urdu: "سیب", svg: <g {...S}><path d="M32 18c-6-6-20-4-20 12s10 26 20 22c10 4 20-6 20-22s-14-18-20-12z" /><path d="M32 18c0-6 2-9 6-11" /><path d="M34 12c4-4 10-3 12 0-4 3-9 3-12 0z" /></g> },
  ball: { label: "Ball", urdu: "گیند", svg: <g {...S}><circle cx="32" cy="32" r="22" /><path d="M10 32h44M32 10c-8 8-8 36 0 44M32 10c8 8 8 36 0 44" /></g> },
  cat: { label: "Cat", urdu: "بلی", svg: <g {...S}><path d="M16 26l2-14 9 8h10l9-8 2 14" /><ellipse cx="32" cy="34" rx="17" ry="15" /><circle cx="25" cy="31" r="1.6" /><circle cx="39" cy="31" r="1.6" /><path d="M30 37l2 2 2-2M18 38h-8M18 41l-7 3M46 38h8M46 41l7 3" /></g> },
  fish: { label: "Fish", urdu: "مچھلی", svg: <g {...S}><path d="M8 32c8-12 26-14 38 0-12 14-30 12-38 0z" /><path d="M46 32l12-10v20z" /><circle cx="18" cy="30" r="1.8" /></g> },
  sun: { label: "Sun", urdu: "سورج", svg: <g {...S}><circle cx="32" cy="32" r="11" /><path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l6 6M45 45l6 6M13 51l6-6M45 19l6-6" /></g> },
  moon: { label: "Moon", urdu: "چاند", svg: <g {...S}><path d="M40 8a24 24 0 1 0 16 36A20 20 0 0 1 40 8z" /></g> },
  star: { label: "Star", urdu: "ستارہ", svg: <g {...S}><path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" /></g> },
  house: { label: "House", urdu: "گھر", svg: <g {...S}><path d="M8 30L32 10l24 20" /><path d="M14 26v28h36V26" /><path d="M27 54V40h10v14" /><path d="M18 34h7v6h-7zM39 34h7v6h-7z" /></g> },
  tree: { label: "Tree", urdu: "درخت", svg: <g {...S}><path d="M32 8c-12 0-18 10-14 18-8 4-6 18 6 18h16c12 0 14-14 6-18 4-8-2-18-14-18z" /><path d="M32 44v14M26 58h12M32 50l-6-6M32 48l6-6" /></g> },
  car: { label: "Car", urdu: "گاڑی", svg: <g {...S}><path d="M6 42v-8l6-2 6-10h24l8 10 8 2v8z" /><circle cx="18" cy="44" r="5" /><circle cx="46" cy="44" r="5" /><path d="M22 24l-3 8h13v-8zM36 24v8h10l-6-8z" /></g> },
  flower: { label: "Flower", urdu: "پھول", svg: <g {...S}><circle cx="32" cy="22" r="5" /><circle cx="32" cy="12" r="6" /><circle cx="42" cy="20" r="6" /><circle cx="38" cy="31" r="6" /><circle cx="26" cy="31" r="6" /><circle cx="22" cy="20" r="6" /><path d="M32 30v28M32 46c-6-6-12-4-14-2 4 4 10 4 14 2zM32 50c6-6 12-4 14-2-4 4-10 4-14 2z" /></g> },
  umbrella: { label: "Umbrella", urdu: "چھتری", svg: <g {...S}><path d="M6 32a26 22 0 0 1 52 0c-4-4-9-4-13 0-4-4-9-4-13 0-4-4-9-4-13 0-4-4-9-4-13 0z" /><path d="M32 32v20a5 5 0 0 1-10 0" /><path d="M32 10V6" /></g> },
  cup: { label: "Cup", urdu: "کپ", svg: <g {...S}><path d="M12 20h32v18a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" /><path d="M44 24h4a6 6 0 0 1 0 12h-4" /><path d="M8 58h40" /></g> },
  kite: { label: "Kite", urdu: "پتنگ", svg: <g {...S}><path d="M32 4l18 22-18 24-18-24z" /><path d="M32 4v46M14 26h36" /><path d="M32 50c-4 4 4 6 0 10" /></g> },
  egg: { label: "Egg", urdu: "انڈا", svg: <g {...S}><path d="M32 6c-12 0-20 20-20 32a20 20 0 0 0 40 0C52 26 44 6 32 6z" /></g> },
  bird: { label: "Bird", urdu: "پرندہ", svg: <g {...S}><path d="M10 36c4-12 18-18 30-10l10-4-4 8c2 12-10 22-24 18-6-2-10-6-12-12z" /><path d="M24 34c6 0 10-4 12-8" /><circle cx="42" cy="28" r="1.5" /><path d="M24 48l-2 8M30 48l1 8" /></g> },
};

export const ICON_KEYS = Object.keys(ICONS);

export function SvgIcon({ name, size = 22 }: { name: string; size?: number }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg viewBox="0 0 64 64" width={`${size}mm`} height={`${size}mm`} role="img" aria-label={icon.label}>
      {icon.svg}
    </svg>
  );
}
