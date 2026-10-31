"use client";
import { useState } from "react";

export function MessageForm({ kind, labels, withEmail }: {
  kind: "feedback" | "support";
  withEmail?: boolean;
  labels: { email?: string; message: string; send: string; sent: string; error: string };
}) {
  const [msg, setMsg] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  if (state === "done") return <p className="card p-5 text-lg">✅ {labels.sent}</p>;
  return (
    <form
      className="card space-y-3 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const r = await fetch("/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, message: msg, email: email || undefined }) });
        setState(r.ok ? "done" : "err");
      }}
    >
      {withEmail && (
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={labels.email}
          className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5" />
      )}
      <textarea required value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={labels.message} rows={6} maxLength={5000}
        className="w-full rounded-xl border-2 border-ink bg-paper px-3 py-2.5" />
      {state === "err" && <p className="text-tomato-dark">{labels.error}</p>}
      <button className="btn btn-primary" disabled={state === "busy" || !msg.trim()}>{labels.send}</button>
    </form>
  );
}
