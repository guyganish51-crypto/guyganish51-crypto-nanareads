export type MsgKind = "text" | "media" | "voice" | "system" | "deleted" | "sticker" | "link";

/** Normalized message. Short keys keep the uploaded JSON small. */
export interface Msg {
  /** epoch ms, local wall-clock time encoded as if UTC (exports carry no timezone) */
  t: number;
  /** author display name as in the export */
  a: string;
  /** text */
  x: string;
  /** kind, omitted for plain text */
  k?: MsgKind;
}

export interface ParsedChat {
  source: string;
  title: string | null;
  participants: string[];
  messages: Msg[];
}

export interface AuthorStats {
  name: string;
  messages: number;
  share: number; // 0..1
  words: number;
  initiations: number;
  initiationShare: number; // 0..1
  medianReplyMinutes: number | null;
  afterMidnight: number;
  voice: number;
  media: number;
  topEmojis: string[];
}

export interface ChatStats {
  total: number;
  days: number;
  perDay: number;
  firstAt: number | null;
  lastAt: number | null;
  busiestHour: number | null;
  afterMidnightShare: number;
  voice: number;
  media: number;
  topEmojis: string[];
  longestSilenceDays: number;
  longestSilenceEndedAt: number | null;
  authors: AuthorStats[];
  monthly: { month: string; count: number }[];
  /** recurring phrases with exact counts (catchphrases, running jokes) */
  phrases?: { text: string; count: number; topAuthor: string; topAuthorCount: number }[];
  /** true when timestamps were invented (screen-recording import) */
  synthetic?: boolean;
}
