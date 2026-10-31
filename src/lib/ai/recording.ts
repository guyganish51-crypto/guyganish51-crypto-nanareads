import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import type { Msg } from "@/lib/chat/types";

const VISION_MODEL = process.env.VISION_MODEL ?? "anthropic/claude-haiku-5.5";
const BATCH = 10;

const Transcript = z.object({
  chatName: z.string().nullable().describe("Name/title shown at the top of the chat screen, if visible"),
  messages: z.array(z.object({
    side: z.enum(["me", "them", "system"]).describe("right-aligned/coloured bubbles are 'me', left-aligned are 'them', centred date/system lines are 'system'"),
    author: z.string().nullable().describe("sender name if shown (group chats), else null"),
    text: z.string().describe("bubble text exactly as written; for photos/voice/stickers write [photo] / [voice] / [sticker]"),
    time: z.string().nullable().describe("time or date shown for this message or the separator above it, verbatim, else null"),
  })),
});

const SYSTEM = `You transcribe screenshots of a messaging app conversation (Instagram, Messenger, iMessage, WhatsApp...).
The frames are in chronological scroll order and overlap heavily. Transcribe every distinct message bubble exactly once, top to bottom, oldest first.
Copy text verbatim including emoji and typos. Skip UI chrome (keyboard, input box, reactions counts, "Seen", "Delivered").`;

/** Turn ordered JPEG frames into normalized messages. */
export async function transcribeFrames(frames: Uint8Array[]): Promise<{ title: string | null; messages: Msg[]; costUsd: number }> {
  const batches: Uint8Array[][] = [];
  for (let i = 0; i < frames.length; i += BATCH) batches.push(frames.slice(i, i + BATCH + 1)); // +1 overlap frame
  let cost = 0;
  const results = new Array<z.infer<typeof Transcript> | null>(batches.length).fill(null);
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const i = next++;
      const res = await generateText({
        model: VISION_MODEL,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: [
            ...batches[i].map((f) => ({ type: "file" as const, mediaType: "image/jpeg", data: f })),
            { type: "text" as const, text: "Transcribe these frames." },
          ],
        }],
        output: Output.object({ schema: Transcript }),
        maxOutputTokens: 6000,
      });
      cost += ((res.usage?.inputTokens ?? 0) * 0.1 + (res.usage?.outputTokens ?? 0) * 0.5) / 1e6;
      results[i] = res.output;
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  const title = results.find((r) => r?.chatName)?.chatName ?? null;
  const other = title ?? "Them";
  const out: Msg[] = [];
  const key = (m: { a: string; x: string }) => `${m.a}|${m.x.replace(/\s+/g, " ").trim().toLowerCase()}`;
  let t = Date.UTC(2000, 0, 1, 12);
  for (const r of results) {
    if (!r) continue;
    for (const m of r.messages) {
      if (m.side === "system" || !m.text.trim()) continue;
      const a = m.side === "me" ? "Me" : (m.author?.trim() || other);
      const x = m.text.trim();
      const k = key({ a, x });
      // overlap removal: skip if the same bubble appears among the last 12 kept
      if (out.slice(-12).some((o) => key(o) === k)) continue;
      t += 60_000;
      const kind = /^\[(photo|voice|sticker|video)\]$/i.test(x) ? (/voice/i.test(x) ? "voice" : /sticker/i.test(x) ? "sticker" : "media") : undefined;
      out.push(kind ? { t, a, x, k: kind } : { t, a, x });
    }
  }
  return { title, messages: out, costUsd: cost };
}
