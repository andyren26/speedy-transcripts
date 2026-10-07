// Turns Whisper's per-sentence segments (job_sessions.segments) into the two
// download formats: a timestamped .txt and an .srt subtitle file.

export type Segment = { start: number; end: number; text: string };

/** Accepts the raw jsonb value and keeps only well-formed segments. */
export function parseSegments(value: unknown): Segment[] | null {
  if (!Array.isArray(value)) return null;
  const segments = value.filter(
    (s): s is Segment =>
      !!s &&
      typeof s === "object" &&
      typeof (s as Segment).start === "number" &&
      typeof (s as Segment).end === "number" &&
      typeof (s as Segment).text === "string" &&
      (s as Segment).text.trim() !== "",
  );
  return segments.length > 0 ? segments : null;
}

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

/** 3725.4 → "01:02:05" */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** 3725.4 → "01:02:05,400" (SRT uses a comma before the milliseconds) */
function srtClock(seconds: number) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/** One line per sentence: "[00:00:03] 大家好…" */
export function toTimestampedTxt(segments: Segment[]) {
  return segments.map((s) => `[${clock(s.start)}] ${s.text.trim()}`).join("\n") + "\n";
}

/** Standard SubRip: numbered cues, "start --> end", text, blank line. */
export function toSrt(segments: Segment[]) {
  return segments
    .map((s, i) => {
      // every cue must have a positive duration or some players skip it
      const end = s.end > s.start ? s.end : s.start + 1;
      return `${i + 1}\n${srtClock(s.start)} --> ${srtClock(end)}\n${s.text.trim()}\n`;
    })
    .join("\n");
}
