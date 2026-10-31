"use client";
import { useState } from "react";
import type { Dict } from "@/lib/i18n/dictionaries";
import { NanaAvatar } from "./NanaAvatar";

type Demo = Dict["demos"][number];

export function DemoPicker({ demos, lockedLabel, byLabel, hint }: { demos: Demo[]; lockedLabel: string; byLabel: string; hint: string }) {
  const [i, setI] = useState(0);
  const d = demos[i];
  const first = d.messages[0]?.a;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {demos.map((x, j) => (
          <button key={x.id} onClick={() => setI(j)} className={`chip ${j === i ? "!bg-butter" : ""}`} aria-pressed={j === i}>
            {x.label} <span className="text-xs text-ink-soft">· {x.kind}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-ink-soft">{hint}</p>
      <div key={d.id} className="card rise grid gap-0 overflow-hidden md:grid-cols-2">
        <div className="space-y-2 border-b-2 border-ink bg-[#efe7da] p-4 md:border-b-0 md:border-e-2">
          <p className="text-center text-xs font-medium text-ink-soft">{d.count}</p>
          {d.messages.map((m, k) => (
            <div key={k} className={`flex ${m.a === first ? "justify-start" : "justify-end"}`}>
              <div className={`bubble ${m.a === first ? "bubble-other" : ""}`}>
                <div className="text-xs font-semibold text-tomato-dark">{m.a}</div>
                {m.x}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2">
            {d.stats.map((s, k) => (
              <div key={k} className={`rounded-xl border-2 border-ink p-2.5 ${["bg-sky", "bg-butter", "bg-blush", "bg-sage"][k % 4]}`}>
                <div className="text-xs font-medium">{s.k}</div>
                <div className="font-display text-2xl font-bold">{s.v}</div>
              </div>
            ))}
          </div>
          <h3 className="font-display text-2xl font-bold leading-tight">{d.headline}</h3>
          <div className="flex gap-3">
            <NanaAvatar size={36} className="shrink-0" />
            <p className="leading-relaxed"><span className="text-xs font-semibold text-ink-soft">{byLabel} · </span>{d.verdict}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{lockedLabel}</p>
            <ul className="space-y-1">
              {d.locked.map((l, k) => (
                <li key={k} className="flex items-center gap-2 text-sm"><span>🔒</span><span className="blur-[0.3px]">{l}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
