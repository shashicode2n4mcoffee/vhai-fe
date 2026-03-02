/**
 * Resume upload — Extract text from PDF/DOCX and summarize with DeepSeek (name + skills, ~500 chars).
 * Used by Dashboard; result stored in user settings and auto-filled in templates for candidates.
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import mammoth from "mammoth";
import { callDeepSeek } from "./deepseek-client";

if (typeof pdfWorker === "string" && "GlobalWorkerOptions" in pdfjsLib) {
  (pdfjsLib as typeof pdfjsLib & { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc =
    pdfWorker;
}

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const RESUMEE_SUMMARY_MAX_CHARS = 500;

/** Reject if not PDF or DOCX (or file type not in allowed list). */
export function validateResumeFile(file: File): { ok: true } | { ok: false; error: string } {
  const ext = (file.name || "").toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: "Only PDF and Word (.docx) files are allowed. Other types are rejected." };
  }
  if (!ACCEPTED_TYPES.includes(file.type) && ext !== ".pdf" && ext !== ".docx") {
    return { ok: false, error: "Invalid file type. Use PDF or Word (.docx) only." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.` };
  }
  return { ok: true };
}

/** Extract plain text from a PDF file (browser). */
async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const parts: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    parts.push(pageText);
  }
  return parts.join("\n").replace(/\s+/g, " ").trim();
}

/** Extract plain text from a DOCX file (browser). */
async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").replace(/\s+/g, " ").trim();
}

/** Extract text from PDF or DOCX. Rejects other types. */
export async function extractTextFromResumeFile(file: File): Promise<string> {
  const validated = validateResumeFile(file);
  if (!validated.ok) throw new Error(validated.error);

  const ext = (file.name || "").toLowerCase().slice(file.name.lastIndexOf("."));
  if (ext === ".pdf") return extractTextFromPdf(file);
  if (ext === ".docx") return extractTextFromDocx(file);
  throw new Error("Only PDF and Word (.docx) files are allowed.");
}

const DEEPSEEK_PROMPT = `You are a resume summarizer. Given the raw text extracted from a candidate's resume (PDF or Word), output a single, optimized summary in plain text with exactly these two parts:
1) Full name of the candidate (as it appears in the resume).
2) A concise list of skills, technologies, and key experience (e.g. "Skills: React, Node.js, 4 years backend. Experience: ...").

Rules:
- Total length must be at most ${RESUMEE_SUMMARY_MAX_CHARS} characters.
- No markdown, no bullets, no headings — one flowing paragraph or short lines.
- Include only name and skills/experience; omit address, phone, email, and generic phrases.
- If the text is empty or unreadable, respond with: "Name: Unknown. Skills: Not specified."`;

/** Call DeepSeek to produce a ~500 char summary (name + skills) from raw resume text. */
export async function summarizeResumeWithDeepSeek(rawText: string): Promise<string> {
  const truncated = rawText.slice(0, 30000);
  const prompt = `${DEEPSEEK_PROMPT}\n\n--- Resume text ---\n${truncated}\n--- End ---`;
  const summary = await callDeepSeek(prompt, {
    temperature: 0.3,
    maxTokens: 400,
  });
  return summary.slice(0, 600).trim();
}
