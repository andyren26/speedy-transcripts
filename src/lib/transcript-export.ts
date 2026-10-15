// Binary export formats (.docx and .pdf). Server-only: the PDF embeds a Traditional
// Chinese font read from disk, so this must not be imported from client components.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import subsetFont from "subset-font";
import { mmss, type Segment } from "./transcript-format";

/** Word: "[00:12] 文字" per paragraph, timestamp in grey. */
export async function toDocx(segments: Segment[]): Promise<Uint8Array> {
  const font = { ascii: "Calibri", hAnsi: "Calibri", eastAsia: "Microsoft JhengHei" };
  const doc = new Document({
    creator: "Video Speed Reader",
    title: "逐字稿",
    styles: { default: { document: { run: { font, size: 22 } } } },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "逐字稿", font })] }),
          ...segments.map(
            (s) =>
              new Paragraph({
                spacing: { after: 140 },
                children: [
                  new TextRun({ text: `[${mmss(s.start)}] `, color: "888888", font }),
                  new TextRun({ text: s.text.trim(), font }),
                ],
              }),
          ),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// pdf-lib can't wrap text itself, and CJK has no spaces to break on: keep runs of
// latin letters/digits together, and let every other character break freely.
function tokenize(text: string) {
  return text.match(/[A-Za-z0-9'’.,:;!?%$@#&/_()-]+|\s+|[^\sA-Za-z0-9]/g) ?? [];
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  const fits = (t: string) => font.widthOfTextAtSize(t, size) <= maxWidth;
  for (const token of tokenize(text)) {
    if (fits(line + token)) {
      line += token;
      continue;
    }
    if (line.trim()) lines.push(line.trimEnd());
    line = "";
    if (token.trim() === "") continue;
    if (fits(token)) {
      line = token;
    } else {
      // one very long latin token: split by character
      for (const ch of token) {
        if (!fits(line + ch)) {
          lines.push(line);
          line = "";
        }
        line += ch;
      }
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** PDF (A4): grey [mm:ss] column on the left, wrapped text on the right. */
export async function toPdf(segments: Segment[]): Promise<Uint8Array> {
  const fontBytes = await readFile(
    path.join(process.cwd(), "src", "assets", "fonts", "NotoSansTC_400Regular.ttf"),
  );
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle("逐字稿");
  pdf.setCreator("Video Speed Reader");
  // Cut the 7 MB font down to just the characters in this transcript (HarfBuzz), then
  // embed that whole tiny font. pdf-lib's own `subset: true` drops glyphs from this
  // font (blank/missing characters), so we don't use it.
  const used = "逐字稿[]0123456789:" + segments.map((s) => s.text).join("");
  const tiny = await subsetFont(Buffer.from(fontBytes), used, { targetFormat: "truetype" });
  const font = await pdf.embedFont(tiny, { subset: false });

  const W = 595.28;
  const H = 841.89;
  const margin = 56;
  const stampWidth = 46;
  const textX = margin + stampWidth + 8;
  const size = 11;
  const lineHeight = 18;
  const textWidth = W - margin - textX;

  let page = pdf.addPage([W, H]);
  let y = H - margin;
  page.drawText("逐字稿", { x: margin, y: y - 14, size: 18, font, color: rgb(0.1, 0.1, 0.1) });
  y -= 44;

  for (const s of segments) {
    const lines = wrap(s.text.trim(), font, size, textWidth);
    if (lines.length === 0) continue;
    // keep a sentence's first two lines together; otherwise start a new page when full
    if (y - lineHeight * Math.min(lines.length, 2) < margin) {
      page = pdf.addPage([W, H]);
      y = H - margin;
    }
    page.drawText(`[${mmss(s.start)}]`, { x: margin, y: y - size, size: 9, font, color: rgb(0.55, 0.55, 0.55) });
    for (const line of lines) {
      if (y - lineHeight < margin) {
        page = pdf.addPage([W, H]);
        y = H - margin;
      }
      page.drawText(line, { x: textX, y: y - size, size, font, color: rgb(0.1, 0.1, 0.1) });
      y -= lineHeight;
    }
    y -= 6;
  }
  return pdf.save();
}
