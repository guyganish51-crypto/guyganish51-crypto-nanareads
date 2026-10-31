/**
 * Minimal visual-order helper for the OG image renderer (satori has no bidi support).
 * Wraps text to lines, then for RTL text reverses word order and the characters of
 * Hebrew words, leaving Latin words, numbers and emoji readable.
 */
const RTL_CHAR = /[֐-׿]/;
const SEG = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

export function visualLine(line: string, rtl: boolean): string {
  if (!rtl) return line;
  return line.split(" ").reverse()
    .map((w) => (RTL_CHAR.test(w) ? [...SEG.segment(w)].map((s) => s.segment).reverse().join("")
      .replace(/[()[\]{}]/g, (c) => ({ "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" })[c]!) : w))
    .join(" ");
}

export const isHebrew = (s: string) => RTL_CHAR.test(s);
export const needsShaping = (s: string) => /[؀-ۿݐ-ݿऀ-෿฀-๿]/.test(s);
