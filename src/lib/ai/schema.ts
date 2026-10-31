import { z } from "zod";

export const Block = z.union([
  z.object({ type: z.literal("p"), text: z.string() }),
  z.object({ type: z.literal("quote"), author: z.string(), text: z.string() }),
]);
export type Block = z.infer<typeof Block>;

export const PreviewSchema = z.object({
  title: z.string().describe("One-line headline for the report: names the chat and three absurd-but-true specifics from it, ends with 1-2 emoji"),
  opening: z.string().describe("Nana's opening, 90-140 words, first person, sets up the chat with concrete details. This part is free to read."),
  verdict_teaser: z.string().describe("One sentence teasing Nana's final verdict without giving it away"),
  sections: z.array(z.object({ emoji: z.string(), heading: z.string() })).min(4).max(7)
    .describe("Headings of the full report's sections, each naming a specific person/event from the chat"),
  people: z.array(z.object({ name: z.string(), title: z.string().describe("funny 3-7 word epithet + 1 emoji") })).max(12),
  email_hook: z.string().describe("A provocative question about a real tension in the chat, under 110 characters, usable as an email subject"),
});
export type Preview = z.infer<typeof PreviewSchema>;

export const ReportSchema = z.object({
  title: z.string(),
  opening: z.array(Block).describe("2-3 paragraphs"),
  sections: z.array(z.object({
    emoji: z.string(),
    heading: z.string(),
    blocks: z.array(Block).describe("paragraphs of 2-5 sentences interleaved with 1-4 short verbatim quotes"),
  })).min(4).max(8),
  people: z.array(z.object({
    name: z.string(),
    title: z.string(),
    blocks: z.array(Block).describe("60-140 words plus one signature quote"),
  })).max(14),
  glossary: z.array(z.object({ term: z.string(), meaning: z.string() })).max(8)
    .describe("The chat's private language: recurring words/phrases with a funny definition"),
  awards: z.array(z.object({ award: z.string(), winner: z.string(), why: z.string() })).max(8),
  reactions: z.array(z.object({ name: z.string(), prediction: z.string() })).max(14)
    .describe("How each person will react when this report lands in the chat"),
  verdict: z.object({
    roast: z.string().describe("One paragraph that sums everyone up, unsparing"),
    heart: z.string().describe("One paragraph on what genuinely holds them together, specific and warm"),
    last_line: z.string().describe("A final one-liner aimed at one specific person"),
  }),
  advice: z.string().nullable().describe("For two-person chats: what Nana would actually do in the user's place. Null for groups."),
});
export type Report = z.infer<typeof ReportSchema>;
