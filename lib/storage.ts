import path from "node:path";

export const DATA_DIR = process.env.RECMAP_DATA_DIR || path.join(process.cwd(), "data");
export const UPLOADED_DIR = path.join(DATA_DIR, "uploaded");
export const PDF_DIR = path.join(DATA_DIR, "pdfs");
