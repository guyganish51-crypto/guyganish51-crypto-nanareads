import { test } from "node:test";
import assert from "node:assert/strict";
import { parseText } from "../src/lib/chat/parse.ts";
import { computeStats, buildTranscript } from "../src/lib/chat/stats.ts";

test("whatsapp android dmy 24h + multiline + system + media", () => {
  const s = `13/09/2025, 21:15 - Messages and calls are end-to-end encrypted.
13/09/2025, 21:15 - Dana: hey
what's up
13/09/2025, 21:16 - Yoni: <Media omitted>
14/09/2025, 08:01 - Yoni: good morning 😂😂`;
  const r = parseText(s);
  assert.equal(r.source, "whatsapp");
  const m = r.messages.filter((x) => x.k !== "system");
  assert.equal(m.length, 3);
  assert.equal(m[0].x, "hey\nwhat's up");
  assert.equal(m[1].k, "media");
  assert.equal(new Date(m[2].t).toISOString(), "2025-09-14T08:01:00.000Z");
  assert.deepEqual(r.participants.sort(), ["Dana", "Yoni"]);
});

test("whatsapp ios bracket mdy am/pm with LRM", () => {
  const s = `‎[12/31/25, 9:15:03 PM] Dana: hi
[1/1/26, 12:01:00 AM] Yoni: happy new year
[1/1/26, 12:05:00 AM] Yoni: ‎image omitted`;
  const r = parseText(s);
  assert.equal(new Date(r.messages[0].t).toISOString(), "2025-12-31T21:15:03.000Z");
  assert.equal(new Date(r.messages[1].t).toISOString(), "2026-01-01T00:01:00.000Z");
  assert.equal(r.messages[2].k, "media");
});

test("whatsapp hebrew dotted dates", () => {
  const s = `[31.12.2025, 21:15:03] גיא: מה קורה
[31.12.2025, 21:16:10] דנה: ‏התמונה הושמטה
[01.01.2026, 09:00:00] גיא: בוקר`;
  const r = parseText(s);
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[1].k, "media");
  assert.equal(new Date(r.messages[2].t).toISOString(), "2026-01-01T09:00:00.000Z");
});

test("line", () => {
  const s = `[LINE] Chat history with Ken
Saved on: 2025/12/31 22:00

2025/12/30(Tue)
21:15\tKen\thello
21:16\tAmi\t[Photo]
21:17\tAmi\tsee you`;
  const r = parseText(s);
  assert.equal(r.source, "line");
  assert.equal(r.messages.length, 3);
  assert.equal(r.messages[1].k, "media");
  assert.equal(r.title, "Ken");
});

test("kakao mobile ko + pc", () => {
  const a = parseText(`민수 님과 카카오톡 대화
2025년 12월 31일 오후 9:15, 민수 : 안녕
2025년 12월 31일 오후 9:16, 지은 : 사진
2025년 12월 31일 오전 12:01, 지은 : ㅋㅋ`);
  assert.equal(a.source, "kakaotalk");
  assert.equal(new Date(a.messages[0].t).toISOString(), "2025-12-31T21:15:00.000Z");
  assert.equal(a.messages[1].k, "media");
  assert.equal(new Date(a.messages[2].t).getUTCHours(), 0);
  const b = parseText(`--------------- 2025년 12월 31일 수요일 ---------------
[민수] [오후 9:15] 안녕
[지은] [오후 9:16] 반가워
[지은] [오후 9:17] ㅋㅋ`, "kakaotalk");
  assert.equal(b.messages.length, 3);
});

test("telegram json", () => {
  const r = parseText(JSON.stringify({ name: "Squad", messages: [
    { type: "message", date: "2025-12-31T21:15:00", from: "A", text: "hi" },
    { type: "message", date: "2025-12-31T21:16:00", from: "B", text: [{ type: "bold", text: "yo" }, " there"] },
    { type: "message", date: "2025-12-31T21:17:00", from: "B", media_type: "voice_message", text: "" },
  ] }));
  assert.equal(r.source, "telegram");
  assert.equal(r.messages[1].x, "yo there");
  assert.equal(r.messages[2].k, "voice");
});

test("csv", () => {
  const r = parseText(`date,sender,text
2025-12-31 21:15:00,Me,"hi, you"
2025-12-31 21:16:00,Sam,"multi
line"`);
  assert.equal(r.messages.length, 2);
  assert.equal(r.messages[0].x, "hi, you");
  assert.equal(r.messages[1].x, "multi\nline");
});

test("stats + transcript budget", () => {
  const base = Date.UTC(2025, 0, 1, 10);
  const msgs = Array.from({ length: 100 }, (_, i) => ({ t: base + i * 3_600_000 * (i % 10 === 0 ? 8 : 1), a: i % 3 ? "A" : "B", x: "hello 😂" }));
  msgs.sort((a, b) => a.t - b.t);
  const s = computeStats(msgs);
  assert.equal(s.total, 100);
  assert.equal(s.authors[0].name, "A");
  assert.equal(s.topEmojis[0], "😂");
  const t = buildTranscript(msgs, 500);
  assert.ok(t.cutoff);
  assert.ok(t.transcript.length <= 700);
});

test("phrases exact counts", async () => {
  const { topPhrases } = await import("../src/lib/chat/stats.ts");
  const base = Date.UTC(2025, 0, 1);
  const msgs = [
    ...Array.from({ length: 12 }, (_, i) => ({ t: base + i, a: i % 4 ? "Gutman" : "Roni", x: "אני במעלית" })),
    ...Array.from({ length: 6 }, (_, i) => ({ t: base + 100 + i, a: "Roni", x: "who is coming friday night?" })),
  ];
  const p = topPhrases(msgs);
  assert.equal(p[0].text, "אני במעלית");
  assert.equal(p[0].count, 12);
  assert.equal(p[0].topAuthor, "Gutman");
  assert.ok(p.some((x) => x.count === 6));
});
