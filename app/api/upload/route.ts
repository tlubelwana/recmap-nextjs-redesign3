import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveUploadedGuideline } from "@/lib/data";
import { runFullExtractionPipeline } from "@/lib/uploadPipeline";
import { getCurrentUser } from "@/lib/currentUser";
import type { UploadResponseBody } from "@/lib/types";
import { UPLOAD_FEATURE_ENABLED } from "@/lib/config";

export const runtime = "nodejs";
// Extraction (PDF parse + a long Claude call) can take a while on a big
// document — give it more headroom than the default route timeout.
export const maxDuration = 120;

const PDF_DIR = path.join(process.cwd(), "public", "data", "pdfs");
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

function safeFileName(original: string): string {
  const ext = path.extname(original) || ".pdf";
  const base = path
    .basename(original, ext)
    .replace(/[^a-zA-Z0-9-_]+/g, "_")
    .slice(0, 60);
  return `${base || "guideline"}_${randomUUID().slice(0, 8)}${ext}`;
}

export async function POST(req: NextRequest) {
  if (!UPLOAD_FEATURE_ENABLED) {
    return NextResponse.json({ error: "Guideline uploads are currently disabled." }, { status: 403 });
  }
  if (!getCurrentUser()) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (25MB max)." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Extract text before we do anything else — if the PDF is unreadable
  // (scanned image with no text layer, corrupt file) fail fast without
  // writing anything to disk.
  let documentText: string;
  try {
    // pdf-parse's default export sometimes runs a debug code path when
    // required at the top of the module in some bundlers; requiring it
    // lazily here keeps that from firing during `next build`.
    const pdfParse = (await import("pdf-parse")).default;
    const parsed = await pdfParse(buffer);
    documentText = parsed.text?.trim() ?? "";
  } catch (err) {
    return NextResponse.json(
      { error: `Could not read text from this PDF: ${(err as Error).message}` },
      { status: 422 }
    );
  }

  if (documentText.length < 200) {
    return NextResponse.json(
      {
        error:
          "This PDF has little or no extractable text (it may be a scanned image without OCR). Try a text-based PDF.",
      },
      { status: 422 }
    );
  }

  // Persist the source PDF so the catalog can link back to it, same as the
  // 13 shipped guidelines do.
  if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });
  const storedFileName = safeFileName(file.name);
  fs.writeFileSync(path.join(PDF_DIR, storedFileName), buffer);

  let guideline;
  try {
    guideline = await runFullExtractionPipeline({
      documentText,
      originalFileName: file.name,
      storedPdfFileName: storedFileName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error running extraction.";
    const status = message.includes("ANTHROPIC_API_KEY") ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }

  saveUploadedGuideline(guideline);

  const response: UploadResponseBody = { guideline };
  return NextResponse.json(response, { status: 201 });
}
