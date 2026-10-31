import "server-only";
import { NextResponse } from "next/server";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function body<T>(req: Request): Promise<T | null> {
  try { return (await req.json()) as T; } catch { return null; }
}

export const CONTEXTS = ["partner", "friends", "friend", "family", "work", "other"] as const;
export const SOURCES = ["whatsapp", "imessage", "instagram", "messenger", "kakaotalk", "line", "telegram", "other"] as const;
export const HEATS = ["gentle", "spicy", "savage"] as const;
