import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDF_DIR } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  const filename = path.basename(params.filename);
  if (filename !== params.filename || !filename.toLowerCase().endsWith(".pdf")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(PDF_DIR, filename);
  if (!fs.existsSync(filePath)) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
