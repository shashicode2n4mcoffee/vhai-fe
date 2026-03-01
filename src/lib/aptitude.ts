/**
 * Aptitude Test — Question generation via DeepSeek API (DeepSeek-V3.2).
 *
 * Cost strategy: ONE API call generates MCQs with correct answers embedded.
 * Evaluation is done entirely client-side (zero additional API calls).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AptitudeQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AptitudeQuiz {
  title: string;
  questions: AptitudeQuestion[];
}

export interface AptitudeResult {
  quiz: AptitudeQuiz;
  answers: Record<number, number>; // questionId -> selectedIndex
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
}

export interface AptitudeRecord {
  id: string;
  date: string;
  topic: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
}

// ---------------------------------------------------------------------------
// Generate questions (single API call — DeepSeek-V3.2)
// ---------------------------------------------------------------------------

export async function generateQuiz(
  topic: string,
  count: number,
  difficulty: "Easy" | "Medium" | "Hard" | "Mixed",
  distributionOverride?: string,
): Promise<AptitudeQuiz> {
  const { callDeepSeek } = await import("./deepseek-client");

  const distributionText =
    distributionOverride ?? (difficulty === "Mixed" ? "8 Easy, 8 Medium, 4 Hard" : `All ${difficulty}`);

  const prompt = `Generate exactly ${count} multiple-choice aptitude test questions.

Topic: ${topic}
Difficulty distribution: ${distributionText}

If the topic mentions R.S. Aggarwal or Quantitative Aptitude, pick questions from these chapters:
Number System, HCF-LCM, Simplification, Surds & Indices, Percentages, Profit & Loss, Simple & Compound Interest, Ratio & Proportion, Partnership, Averages, Problems on Ages, Time & Work, Pipes & Cisterns, Time Speed & Distance, Boats & Streams, Mixture & Alligation, Algebra, Linear & Quadratic Equations, Inequalities, AP & GP, Geometry, Mensuration, Trigonometry, Heights & Distances, Data Interpretation, Data Sufficiency, Statistics, Permutations & Combinations, Probability, Set Theory, Logarithms, Functions, Matrices, Complex Numbers.

Spread questions across as many different chapters/topics as possible within the ${count} questions.

Return a JSON object with this EXACT structure:
{
  "title": "<short quiz title based on topic>",
  "questions": [
    {
      "id": 1,
      "question": "<question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correctIndex": <0-3 index of correct option>,
      "explanation": "<one short sentence: formula or step + answer. Max 15–20 words.>"
    }
  ]
}

Rules:
- Each question MUST have exactly 4 options.
- correctIndex MUST be a number 0-3.
- Questions should be clear, unambiguous, and test real aptitude/mathematical reasoning.
- Distribute correct answers across all positions (0,1,2,3) — don't cluster them.
- For Easy questions: straightforward formula application. For Medium/Hard: moderate complexity.
- CRITICAL — "explanation" must be SHORT and CRISP: one sentence only, max 20 words. Example: "LCM(3,5,8)=120. Answer: 120." No working, no alternatives, no "let me assume", no long derivations.
- Return ONLY the JSON object, nothing else.`;

  const rawText = await callDeepSeek(prompt, {
    temperature: 0.7,
    maxTokens: 8192,
    jsonMode: true,
  });

  // Parse JSON, or salvage truncated response
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    const repaired = repairTruncatedQuizJson(rawText);
    if (repaired) {
      raw = JSON.parse(repaired);
    } else {
      throw new Error("Failed to parse generated questions. Please try again.");
    }
  }

  const quiz = normalizeQuiz(raw, count);
  if (quiz.questions.length < count) {
    console.warn(
      `Aptitude: using ${quiz.questions.length} of ${count} questions.`,
    );
  }
  return quiz;
}

/**
 * If the API returns truncated JSON (e.g. finishReason MAX_TOKENS), try to close
 * the array and object at the last complete question so we can return partial results.
 */
function repairTruncatedQuizJson(text: string): string | null {
  if (!text || !text.includes('"questions"')) return null;
  // Find last complete question block: }\s*,\s*{ (boundary between two questions)
  const re = /\}\s*,\s*\{/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) lastMatch = m;
  if (!lastMatch) return null;
  const endOfLastComplete = lastMatch.index + 1; // include the }
  const prefix = text.slice(0, endOfLastComplete);
  return prefix + "\n  ]\n}";
}

// ---------------------------------------------------------------------------
// Client-side evaluation (zero API cost)
// ---------------------------------------------------------------------------

export function evaluateQuiz(
  quiz: AptitudeQuiz,
  answers: Record<number, number>,
): AptitudeResult {
  let score = 0;
  for (const q of quiz.questions) {
    if (answers[q.id] === q.correctIndex) score++;
  }
  const total = quiz.questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return {
    quiz,
    answers,
    score,
    total,
    percentage,
    passed: percentage >= 60,
  };
}

// ---------------------------------------------------------------------------
// LocalStorage persistence
// ---------------------------------------------------------------------------

const APTITUDE_KEY = "vocalhireai_aptitude";

export function saveAptitudeRecord(record: AptitudeRecord): void {
  const records = getAptitudeHistory();
  records.unshift(record);
  localStorage.setItem(APTITUDE_KEY, JSON.stringify(records));
}

// Full detail storage keyed by record ID
const APTITUDE_DETAIL_KEY = "vocalhireai_aptitude_detail";

export function saveAptitudeDetail(id: string, detail: AptitudeResult): void {
  try {
    const all = JSON.parse(localStorage.getItem(APTITUDE_DETAIL_KEY) || "{}");
    all[id] = detail;
    localStorage.setItem(APTITUDE_DETAIL_KEY, JSON.stringify(all));
  } catch { /* quota exceeded — ignore */ }
}

export function getAptitudeDetail(id: string): AptitudeResult | null {
  try {
    const all = JSON.parse(localStorage.getItem(APTITUDE_DETAIL_KEY) || "{}");
    return all[id] ?? null;
  } catch { return null; }
}

export function getAptitudeHistory(): AptitudeRecord[] {
  try {
    return JSON.parse(localStorage.getItem(APTITUDE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearAptitudeHistory(): void {
  localStorage.removeItem(APTITUDE_KEY);
}

export function getAptitudeStats(): {
  total: number;
  avgScore: number;
  bestScore: number;
} {
  const records = getAptitudeHistory();
  if (records.length === 0) return { total: 0, avgScore: 0, bestScore: 0 };
  const total = records.length;
  const avg = records.reduce((s, r) => s + r.percentage, 0) / total;
  const best = Math.max(...records.map((r) => r.percentage));
  return { total, avgScore: Math.round(avg), bestScore: best };
}

// ---------------------------------------------------------------------------
// Normalize / validate
// ---------------------------------------------------------------------------

function normalizeQuiz(raw: unknown, expectedCount: number): AptitudeQuiz {
  const r = (raw ?? {}) as Record<string, unknown>;
  const title =
    typeof r.title === "string" ? r.title : "Aptitude Test";

  const rawQ = Array.isArray(r.questions) ? r.questions : [];
  const questions: AptitudeQuestion[] = rawQ
    .slice(0, expectedCount)
    .map((q: unknown, idx: number) => {
      const qr = (q ?? {}) as Record<string, unknown>;
      return {
        id: typeof qr.id === "number" ? qr.id : idx + 1,
        question:
          typeof qr.question === "string" ? qr.question : `Question ${idx + 1}`,
        options: Array.isArray(qr.options)
          ? qr.options.map(String).slice(0, 4)
          : ["A", "B", "C", "D"],
        correctIndex: Math.max(
          0,
          Math.min(3, Number(qr.correctIndex) || 0),
        ),
        explanation:
          typeof qr.explanation === "string"
            ? qr.explanation
            : "No explanation provided.",
      };
    });

  if (questions.length === 0) {
    throw new Error("No questions were generated. Please try again.");
  }

  return { title, questions };
}
