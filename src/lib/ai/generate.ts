import "server-only";
import { gunzipSync } from "node:zlib";
import { generateText, Output } from "ai";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildTranscript } from "@/lib/chat/stats";
import type { ChatStats, Msg } from "@/lib/chat/types";
import { localeEnglishNames, isLocale } from "@/lib/i18n/config";
import { PERSONA, buildPrompt, type Heat } from "./prompts";
import { PreviewSchema, ReportSchema, type Block, type Report } from "./schema";

export const MODELS = {
  preview: process.env.PREVIEW_MODEL ?? "anthropic/claude-haiku-5.5",
  full: process.env.REPORT_MODEL ?? "anthropic/claude-sonnet-5.5",
};
// $ per 1M tokens (input, output) for cost tracking only
const PRICE: Record<string, [number, number]> = {
  "anthropic/claude-haiku-5.5": [0.1, 0.5],
  "anthropic/claude-sonnet-5.5": [2, 10],
  "anthropic/claude-sonnet-5": [2, 10],
};
const CHAR_BUDGET = Number(process.env.TRANSCRIPT_CHAR_BUDGET ?? 900_000);
const PREVIEW_CHAR_BUDGET = Number(process.env.PREVIEW_CHAR_BUDGET ?? 400_000);

interface ChatRow {
  id: string; context: string; storage_path: string; participants: string[]; me_name: string | null;
  stats: ChatStats; notes: string | null; report_lang: string;
}

async function loadChat(chatId: string): Promise<{ chat: ChatRow; messages: Msg[] }> {
  const db = supabaseAdmin();
  const { data: chat, error } = await db.from("chats").select("*").eq("id", chatId).single();
  if (error || !chat) throw new Error("chat_not_found");
  if (!chat.storage_path) throw new Error("chat_expired");
  const { data: file, error: fe } = await db.storage.from("chats").download(chat.storage_path);
  if (fe || !file) throw new Error("chat_file_missing");
  const buf = Buffer.from(await file.arrayBuffer());
  const json = JSON.parse(gunzipSync(buf).toString("utf8")) as { messages: Msg[] };
  return { chat: chat as ChatRow, messages: json.messages };
}

function costOf(model: string, usage: { inputTokens?: number; outputTokens?: number } | undefined) {
  const [i, o] = PRICE[model] ?? [0, 0];
  return ((usage?.inputTokens ?? 0) * i + (usage?.outputTokens ?? 0) * o) / 1_000_000;
}

const norm = (s: string) => s.replace(/\s+/g, " ").replace(/[“”"']/g, "").trim().toLowerCase();

/** Drop quotes the model did not copy from the chat. */
function verifyQuotes(blocks: Block[], haystack: string): Block[] {
  return blocks.filter((b) => b.type !== "quote" || (b.text.length > 0 && haystack.includes(norm(b.text).slice(0, 120))));
}

function verifyReport(r: Report, messages: Msg[]): Report {
  const hay = norm(messages.map((m) => m.x).join("\n"));
  return {
    ...r,
    opening: verifyQuotes(r.opening, hay),
    sections: r.sections.map((s) => ({ ...s, blocks: verifyQuotes(s.blocks, hay) })),
    people: r.people.map((p) => ({ ...p, blocks: verifyQuotes(p.blocks, hay) })),
  };
}

function cutoffNote(cutoff: number | null) {
  if (!cutoff) return null;
  return `The chat was too long; only messages from ${new Date(cutoff).toISOString().slice(0, 10)} onward are included.`;
}

export async function runPreview(reportId: string) {
  const db = supabaseAdmin();
  const { data: rep } = await db.from("reports").select("*").eq("id", reportId).single();
  if (!rep) return;
  try {
    const { chat, messages } = await loadChat(rep.chat_id);
    const { transcript, cutoff } = buildTranscript(messages, PREVIEW_CHAR_BUDGET, chat.me_name);
    const repLang = String(rep.lang);
    const lang = isLocale(repLang) ? localeEnglishNames[repLang] : "English";
    const res = await generateText({
      model: MODELS.preview,
      system: PERSONA,
      prompt: buildPrompt({
        kind: "preview", context: chat.context, lang, heat: (rep.content?.heat as Heat) ?? "spicy",
        meName: chat.me_name, participants: chat.participants, stats: chat.stats, transcript,
        cutoffNote: cutoffNote(cutoff), notes: chat.notes,
      }),
      output: Output.object({ schema: PreviewSchema }),
      maxOutputTokens: 3000,
    });
    await db.from("reports").update({
      status: "preview_ready",
      title: res.output.title,
      preview: { ...res.output, cutoff },
      cost_usd: costOf(MODELS.preview, res.usage),
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);
  } catch (e) {
    await db.from("reports").update({ status: "failed", error: String(e).slice(0, 500) }).eq("id", reportId);
  }
}

export async function runFull(reportId: string) {
  const db = supabaseAdmin();
  const { data: rep } = await db.from("reports").select("*").eq("id", reportId).single();
  if (!rep) return;
  try {
    const { chat, messages } = await loadChat(rep.chat_id);
    const { transcript, cutoff } = buildTranscript(messages, CHAR_BUDGET, chat.me_name);
    const repLang = String(rep.lang);
    const lang = isLocale(repLang) ? localeEnglishNames[repLang] : "English";
    let previous: string | null = null;
    if (rep.question) {
      const { data: prev } = await db.from("reports").select("title, content").eq("chat_id", rep.chat_id)
        .lt("number", rep.number).order("number", { ascending: false }).limit(1).single();
      if (prev?.content?.report) {
        const r = prev.content.report as Report;
        previous = `${r.title}\n${r.sections.map((s) => s.heading).join("; ")}\n${r.verdict.roast}`;
      }
    } else if (rep.preview) {
      const p = rep.preview;
      previous = JSON.stringify({ title: p.title, opening: p.opening, sections: p.sections, people: p.people });
    }
    const res = await generateText({
      model: MODELS.full,
      system: PERSONA,
      prompt: buildPrompt({
        kind: rep.question ? "followup" : "full", context: chat.context, lang,
        heat: (rep.content?.heat as Heat) ?? "spicy", meName: chat.me_name, participants: chat.participants,
        stats: chat.stats, transcript, cutoffNote: cutoffNote(cutoff), notes: chat.notes,
        question: rep.question, previous,
      }),
      output: Output.object({ schema: ReportSchema }),
      maxOutputTokens: 16000,
    });
    const report = verifyReport(res.output, messages);
    await db.from("reports").update({
      status: "full_ready",
      title: report.title,
      content: { ...(rep.content ?? {}), report, cutoff },
      cost_usd: Number(rep.cost_usd ?? 0) + costOf(MODELS.full, res.usage),
      updated_at: new Date().toISOString(),
    }).eq("id", reportId);
    // refresh chat retention: 7 days after the latest report
    await db.from("chats").update({ expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).eq("id", rep.chat_id);
  } catch (e) {
    await db.from("reports").update({ status: "failed", error: String(e).slice(0, 500) }).eq("id", reportId);
    // refund the credit
    await db.from("credit_ledger").insert({ user_id: rep.user_id, delta: 1, reason: "refund_failed", report_id: reportId });
  }
}
