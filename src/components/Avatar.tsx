import { PATRIK_SVG } from "@/lib/site/patrik";

const inner = PATRIK_SVG.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

/** Patrik — straw sombrero, moustache, DJ headphones. Source of truth: src/lib/site/patrik.ts */
export function Avatar({ size = 48, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} role="img" aria-label="Patrik"
      dangerouslySetInnerHTML={{ __html: inner }} />
  );
}
