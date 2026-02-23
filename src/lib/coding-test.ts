/**
 * Coding Test — Problem generation + AI-powered code evaluation via Gemini.
 *
 * Flow:
 *   1. generateCodingProblem()  → ONE API call to create a challenge
 *   2. evaluateCode()           → ONE API call to rate the submitted code
 *   3. saveCodingRecord()       → persist to localStorage
 *
 * Uses VITE_GEMINI_REPORT_MODEL (cheapest model) for both calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodingLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "cpp"
  | "csharp"
  | "go"
  | "rust";

export type CodingDifficulty = "Easy" | "Medium" | "Hard";

export interface CodingProblem {
  title: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  language: CodingLanguage;
  difficulty: CodingDifficulty;
  hints: string[];
  testCases: { input: string; expectedOutput: string }[];
}

export interface CodeEvaluation {
  overallScore: number; // 0–100
  verdict: "Excellent" | "Good" | "Average" | "Needs Improvement" | "Poor";
  categories: {
    correctness: { score: number; feedback: string };
    codeQuality: { score: number; feedback: string };
    efficiency: { score: number; feedback: string };
    edgeCases: { score: number; feedback: string };
    style: { score: number; feedback: string };
  };
  strengths: string[];
  improvements: string[];
  optimizedSolution: string;
  timeComplexity: string;
  spaceComplexity: string;
}

export interface CodingRecord {
  id: string;
  date: string;
  title: string;
  language: CodingLanguage;
  difficulty: CodingDifficulty;
  score: number;
  verdict: string;
  timeSpent: number; // seconds
}

// ---------------------------------------------------------------------------
// Language display config
// ---------------------------------------------------------------------------

export const LANGUAGE_CONFIG: Record<
  CodingLanguage,
  { label: string; monacoId: string; extension: string }
> = {
  javascript: { label: "JavaScript", monacoId: "javascript", extension: ".js" },
  typescript: { label: "TypeScript", monacoId: "typescript", extension: ".ts" },
  python: { label: "Python", monacoId: "python", extension: ".py" },
  java: { label: "Java", monacoId: "java", extension: ".java" },
  cpp: { label: "C++", monacoId: "cpp", extension: ".cpp" },
  csharp: { label: "C#", monacoId: "csharp", extension: ".cs" },
  go: { label: "Go", monacoId: "go", extension: ".go" },
  rust: { label: "Rust", monacoId: "rust", extension: ".rs" },
};

// ---------------------------------------------------------------------------
// Generate problem (single API call)
// ---------------------------------------------------------------------------

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateCodingProblem(
  topic: string,
  language: CodingLanguage,
  difficulty: CodingDifficulty,
): Promise<CodingProblem> {
  const { getGeminiConfig } = await import("./gemini-key");
  const geminiConfig = await getGeminiConfig();
  const apiKey = geminiConfig.apiKey;
  const model = geminiConfig.reportModel;
  const langLabel = LANGUAGE_CONFIG[language].label;

  const prompt = `Generate a coding challenge for the following:

Topic: ${topic}
Language: ${langLabel}
Difficulty: ${difficulty}

Return a JSON object with this EXACT structure:
{
  "title": "<concise problem title>",
  "description": "<detailed problem description in markdown with clear requirements>",
  "examples": [
    { "input": "<example input>", "output": "<expected output>", "explanation": "<step-by-step>" }
  ],
  "constraints": ["<constraint 1>", "<constraint 2>"],
  "starterCode": "<starter code template with function signature, in ${langLabel}>",
  "hints": ["<hint 1>", "<hint 2>"],
  "testCases": [
    { "input": "<test input>", "expectedOutput": "<expected output>" }
  ]
}

Rules:
- The problem MUST be solvable in ${langLabel}.
- starterCode must be a valid, compilable function stub with params and return type.
- Include 2-3 examples with clear explanations.
- Include 4-6 test cases covering edge cases.
- Include 2-3 helpful hints (progressively more revealing).
- For ${difficulty}: Easy=basic logic, Medium=DS/algo, Hard=complex optimization.
- Description should be detailed, professional, and clearly formatted.
- Return ONLY the JSON object, nothing else.`;

  const res = await fetch(
    `${API_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.8,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Problem generation failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const raw = JSON.parse(text);
    return normalizeProblem(raw, language, difficulty);
  } catch {
    throw new Error("Failed to parse generated problem. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Evaluate code (single API call)
// ---------------------------------------------------------------------------

export async function evaluateCode(
  problem: CodingProblem,
  userCode: string,
  language: CodingLanguage,
  timeSpent: number,
): Promise<CodeEvaluation> {
  const { getGeminiConfig } = await import("./gemini-key");
  const geminiConfig = await getGeminiConfig();
  const apiKey = geminiConfig.apiKey;
  const model = geminiConfig.reportModel;
  const langLabel = LANGUAGE_CONFIG[language].label;

  const prompt = `You are an expert ${langLabel} code reviewer. Evaluate the following solution.

## Problem
Title: ${problem.title}
Description: ${problem.description}
Difficulty: ${problem.difficulty}

## Test Cases
${problem.testCases.map((tc, i) => `${i + 1}. Input: ${tc.input} → Expected: ${tc.expectedOutput}`).join("\n")}

## Submitted Code (${langLabel})
\`\`\`${language}
${userCode}
\`\`\`

## Time Spent: ${Math.round(timeSpent / 60)} minutes

Evaluate the code and return a JSON object with this EXACT structure:
{
  "overallScore": <0-100>,
  "verdict": "<Excellent|Good|Average|Needs Improvement|Poor>",
  "categories": {
    "correctness": { "score": <0-100>, "feedback": "<specific feedback>" },
    "codeQuality": { "score": <0-100>, "feedback": "<specific feedback>" },
    "efficiency": { "score": <0-100>, "feedback": "<specific feedback>" },
    "edgeCases": { "score": <0-100>, "feedback": "<specific feedback>" },
    "style": { "score": <0-100>, "feedback": "<specific feedback>" }
  },
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "optimizedSolution": "<optimal solution code in ${langLabel}>",
  "timeComplexity": "<e.g. O(n log n)>",
  "spaceComplexity": "<e.g. O(n)>"
}

Scoring guidelines:
- correctness: Does it solve the problem? Does it handle all test cases?
- codeQuality: Clean code, good naming, proper structure, DRY?
- efficiency: Time/space complexity, unnecessary operations?
- edgeCases: Handles nulls, empty inputs, boundaries, overflow?
- style: Idiomatic ${langLabel}, consistent formatting, comments?
- overallScore = weighted avg: correctness 35%, efficiency 25%, codeQuality 20%, edgeCases 10%, style 10%
- verdict: >=90 Excellent, >=75 Good, >=60 Average, >=40 Needs Improvement, <40 Poor
- Be specific and constructive in feedback.
- Return ONLY the JSON object.`;

  const res = await fetch(
    `${API_BASE}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.3,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Code evaluation failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  try {
    const raw = JSON.parse(text);
    return normalizeEvaluation(raw);
  } catch {
    throw new Error("Failed to parse evaluation. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const CODING_KEY = "vocalhireai_coding";

export function saveCodingRecord(record: CodingRecord): void {
  const records = getCodingHistory();
  records.unshift(record);
  localStorage.setItem(CODING_KEY, JSON.stringify(records));
}

// Full detail storage keyed by record ID
const CODING_DETAIL_KEY = "vocalhireai_coding_detail";

export interface CodingDetail {
  problem: CodingProblem;
  userCode: string;
  evaluation: CodeEvaluation;
  language: CodingLanguage;
  difficulty: CodingDifficulty;
  timeSpent: number;
}

export function saveCodingDetail(id: string, detail: CodingDetail): void {
  try {
    const all = JSON.parse(localStorage.getItem(CODING_DETAIL_KEY) || "{}");
    all[id] = detail;
    localStorage.setItem(CODING_DETAIL_KEY, JSON.stringify(all));
  } catch { /* quota exceeded — ignore */ }
}

export function getCodingDetail(id: string): CodingDetail | null {
  try {
    const all = JSON.parse(localStorage.getItem(CODING_DETAIL_KEY) || "{}");
    return all[id] ?? null;
  } catch { return null; }
}

export function getCodingHistory(): CodingRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CODING_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearCodingHistory(): void {
  localStorage.removeItem(CODING_KEY);
}

export function getCodingStats(): {
  total: number;
  avgScore: number;
  bestScore: number;
} {
  const records = getCodingHistory();
  if (records.length === 0) return { total: 0, avgScore: 0, bestScore: 0 };
  const total = records.length;
  const avg = records.reduce((s, r) => s + r.score, 0) / total;
  const best = Math.max(...records.map((r) => r.score));
  return { total, avgScore: Math.round(avg), bestScore: best };
}

// ---------------------------------------------------------------------------
// Normalize / validate
// ---------------------------------------------------------------------------

function normalizeProblem(
  raw: unknown,
  language: CodingLanguage,
  difficulty: CodingDifficulty,
): CodingProblem {
  const r = (raw ?? {}) as Record<string, unknown>;

  const title =
    typeof r.title === "string" ? r.title : "Coding Challenge";
  const description =
    typeof r.description === "string"
      ? r.description
      : "Solve the coding problem.";

  const examples = Array.isArray(r.examples)
    ? r.examples.slice(0, 5).map((ex: unknown) => {
        const e = (ex ?? {}) as Record<string, unknown>;
        return {
          input: String(e.input ?? ""),
          output: String(e.output ?? ""),
          explanation: typeof e.explanation === "string" ? e.explanation : undefined,
        };
      })
    : [];

  const constraints = Array.isArray(r.constraints)
    ? r.constraints.map(String).slice(0, 8)
    : [];

  const starterCode =
    typeof r.starterCode === "string"
      ? r.starterCode
      : getDefaultStarter(language);

  const hints = Array.isArray(r.hints)
    ? r.hints.map(String).slice(0, 5)
    : [];

  const testCases = Array.isArray(r.testCases)
    ? r.testCases.slice(0, 10).map((tc: unknown) => {
        const t = (tc ?? {}) as Record<string, unknown>;
        return {
          input: String(t.input ?? ""),
          expectedOutput: String(t.expectedOutput ?? ""),
        };
      })
    : [];

  if (!title || !description) {
    throw new Error("Generated problem is incomplete. Please try again.");
  }

  return {
    title,
    description,
    examples,
    constraints,
    starterCode,
    language,
    difficulty,
    hints,
    testCases,
  };
}

function normalizeEvaluation(raw: unknown): CodeEvaluation {
  const r = (raw ?? {}) as Record<string, unknown>;

  const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
  const str = (v: unknown, def: string) =>
    typeof v === "string" ? v : def;
  const arr = (v: unknown) =>
    Array.isArray(v) ? v.map(String) : [];

  const cats = (r.categories ?? {}) as Record<string, unknown>;
  const cat = (key: string) => {
    const c = (cats[key] ?? {}) as Record<string, unknown>;
    return {
      score: clamp(c.score),
      feedback: str(c.feedback, "No feedback provided."),
    };
  };

  const correctness = cat("correctness");
  const codeQuality = cat("codeQuality");
  const efficiency = cat("efficiency");
  const edgeCases = cat("edgeCases");
  const style = cat("style");

  // Compute weighted score if overall isn't provided
  const computed = Math.round(
    correctness.score * 0.35 +
      efficiency.score * 0.25 +
      codeQuality.score * 0.2 +
      edgeCases.score * 0.1 +
      style.score * 0.1,
  );
  const overallScore = clamp(r.overallScore) || computed;

  const verdictMap: [number, CodeEvaluation["verdict"]][] = [
    [90, "Excellent"],
    [75, "Good"],
    [60, "Average"],
    [40, "Needs Improvement"],
    [0, "Poor"],
  ];
  const computedVerdict =
    verdictMap.find(([min]) => overallScore >= min)?.[1] ?? "Poor";
  const verdict = str(r.verdict, computedVerdict) as CodeEvaluation["verdict"];

  return {
    overallScore,
    verdict,
    categories: { correctness, codeQuality, efficiency, edgeCases, style },
    strengths: arr(r.strengths),
    improvements: arr(r.improvements),
    optimizedSolution: str(r.optimizedSolution, "// No solution provided"),
    timeComplexity: str(r.timeComplexity, "—"),
    spaceComplexity: str(r.spaceComplexity, "—"),
  };
}

function getDefaultStarter(lang: CodingLanguage): string {
  switch (lang) {
    case "javascript":
      return "function solve(input) {\n  // Your code here\n  \n}";
    case "typescript":
      return "function solve(input: string): string {\n  // Your code here\n  \n}";
    case "python":
      return "def solve(input):\n    # Your code here\n    pass";
    case "java":
      return "class Solution {\n    public String solve(String input) {\n        // Your code here\n        return \"\";\n    }\n}";
    case "cpp":
      return "#include <string>\nusing namespace std;\n\nstring solve(string input) {\n    // Your code here\n    return \"\";\n}";
    case "csharp":
      return "public class Solution {\n    public string Solve(string input) {\n        // Your code here\n        return \"\";\n    }\n}";
    case "go":
      return "package main\n\nfunc solve(input string) string {\n\t// Your code here\n\treturn \"\"\n}";
    case "rust":
      return "fn solve(input: &str) -> String {\n    // Your code here\n    String::new()\n}";
  }
}
