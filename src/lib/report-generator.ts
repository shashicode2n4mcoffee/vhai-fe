/**
 * Report Generator — Comprehensive AI Interview Evaluation Report
 *
 * Calls Gemini REST API (gemini-2.5-flash-lite) to analyse the interview
 * transcript and produce a structured 20-section evaluation report.
 *
 * Sections 14, 14A, 16, 17 are computed client-side using the automated
 * scoring formula (weights + penalties + confidence adjustment).
 */

import type { ConversationTemplate, TranscriptEntry } from "../types/gemini";

// ---------------------------------------------------------------------------
// Types — AI-generated evaluation
// ---------------------------------------------------------------------------

export interface EvaluationReport {
  /** S1 – Candidate Information (extracted from conversation) */
  candidateInfo: {
    fullName: string;
    positionAppliedFor: string;
  };

  /** S2 – Interview Overview */
  interviewOverview: {
    objective: string;
    jobRoleSummary: string;
    evaluationCriteria: string;
  };

  /** S3 – Technical Skills Assessment (score 0-10) */
  technicalSkills: {
    coreKnowledge: string;
    toolProficiency: string;
    problemSolving: string;
    codingSkills: string;
    systemDesign: string;
    accuracyLevel: string;
    score: number;
  };

  /** S4 – Communication Skills (score 0-10) */
  communication: {
    verbalClarity: string;
    languageProficiency: string;
    listeningAbility: string;
    explanationQuality: string;
    confidenceLevel: string;
    score: number;
  };

  /** S5 – Analytical & Critical Thinking (score 0-10) */
  analyticalThinking: {
    logicalReasoning: string;
    decisionMaking: string;
    dataInterpretation: string;
    scenarioHandling: string;
    innovationCreativity: string;
    score: number;
  };

  /** S6 – Behavioral & Personality Assessment (score 0-10) */
  behavioral: {
    professionalAttitude: string;
    emotionalIntelligence: string;
    adaptability: string;
    integrityEthics: string;
    stressManagement: string;
    leadershipTraits: string;
    score: number;
  };

  /** S7 – Domain Knowledge (score 0-10) */
  domainKnowledge: {
    industryAwareness: string;
    roleExpertise: string;
    marketTrends: string;
    complianceKnowledge: string;
    score: number;
  };

  /** S8 – Work Ethic & Motivation (score 0-10) */
  workEthic: {
    careerGoalsAlignment: string;
    initiative: string;
    commitmentLevel: string;
    learningAbility: string;
    growthMindset: string;
    score: number;
  };

  /** S9 – Cultural Fit Assessment (score 0-10) */
  culturalFit: {
    teamCompatibility: string;
    valuesMatch: string;
    diversityAwareness: string;
    collaborationSkills: string;
    score: number;
  };

  /** S10 – AI Observations */
  aiObservations: {
    speechPatterns: string;
    responseConsistency: string;
    emotionalIndicators: string;
    engagementLevel: string;
    stressIndicators: string;
    authenticityScore: string;
  };

  /** S11 – Strengths Identified */
  strengths: string[];

  /** S12 – Areas for Improvement */
  improvements: string[];

  /** S13 – Risk & Red Flag Analysis */
  riskAnalysis: {
    behavioralConcerns: string;
    skillGaps: string;
    integrityIssues: string;
    performanceRisks: string;
    reliabilityRisks: string;
    redFlagScore: number;
  };

  /** S15 – AI Confidence Level */
  aiConfidence: {
    dataCompleteness: string;
    predictionReliability: string;
    biasRisk: string;
    confidenceScore: number;
  };

  /** S18 – Interview Transcript Summary */
  transcriptSummary: {
    keyQuestions: string[];
    keyResponses: string[];
    notableQuotes: string[];
  };

  /** S20 – Final Remarks */
  finalRemarks: string;
}

// ---------------------------------------------------------------------------
// Types — Client-side computed scoring (Section 14, 14A, 16, 17)
// ---------------------------------------------------------------------------

export interface ComputedScoring {
  /** Section 14A step-by-step */
  baseScore: number;
  penalty: number;
  confidenceFactor: number;
  overallScore: number;
  overallPercent: number;

  /** Section 16 */
  recommendation: "Strong Hire" | "Hire" | "Consider" | "Reject";
  roleLevel: "Entry" | "Mid" | "Senior" | "Lead";
  trainingRequirement: "None" | "Minor" | "Moderate" | "Extensive";

  /** Section 15 derived label */
  confidenceLevel: "High" | "Medium" | "Low";
}

// ---------------------------------------------------------------------------
// Scoring formula (Section 14A)
// ---------------------------------------------------------------------------

export function computeScoring(report: EvaluationReport): ComputedScoring {
  const TS = clamp(report.technicalSkills.score);
  const COM = clamp(report.communication.score);
  const AT = clamp(report.analyticalThinking.score);
  const BEH = clamp(report.behavioral.score);
  const DK = clamp(report.domainKnowledge.score);
  const CF = clamp(report.culturalFit.score);
  const MOT = clamp(report.workEthic.score);
  const RED = clamp(report.riskAnalysis.redFlagScore);
  const AIQ = clamp(report.aiConfidence.confidenceScore);

  // Step 1 — Weighted Base Score
  const baseScore =
    TS * 0.25 +
    COM * 0.15 +
    AT * 0.2 +
    BEH * 0.1 +
    DK * 0.15 +
    CF * 0.1 +
    MOT * 0.05;

  // Step 2 — Penalty for Red Flags
  let penalty = 0;
  if (RED > 8) penalty = 5.0;
  else if (RED > 6) penalty = 3.0;
  else if (RED > 4) penalty = 1.5;
  else if (RED > 2) penalty = 0.5;

  // Step 3 — Confidence Factor
  const confidenceFactor = 0.9 + (AIQ / 10) * 0.2;

  // Step 4 — Final Score (clamped 0-10)
  const overallScore = Math.max(
    0,
    Math.min(10, (baseScore - penalty) * confidenceFactor),
  );

  // Step 5 — Percentage
  const overallPercent = overallScore * 10;

  // Step 6 — Recommendation (with hard stops)
  const integ = (report.riskAnalysis.integrityIssues || "").toLowerCase();
  const hasIntegrityFlag =
    integ.includes("flagged") ||
    integ.includes("severe") ||
    integ.includes("major concern");

  let recommendation: ComputedScoring["recommendation"];
  if (RED >= 9 || TS <= 3 || BEH <= 3 || hasIntegrityFlag) {
    recommendation = "Reject";
  } else if (overallScore >= 8.0) {
    recommendation = "Strong Hire";
  } else if (overallScore >= 6.5) {
    recommendation = "Hire";
  } else if (overallScore >= 5.0) {
    recommendation = "Consider";
  } else {
    recommendation = "Reject";
  }

  // Step 7 — Training Requirement
  let trainingRequirement: ComputedScoring["trainingRequirement"];
  if (overallScore >= 8.0 && TS >= 7) trainingRequirement = "None";
  else if (overallScore >= 6.5) trainingRequirement = "Minor";
  else if (overallScore >= 5.0) trainingRequirement = "Moderate";
  else trainingRequirement = "Extensive";

  // Step 8 — Role Level
  let roleLevel: ComputedScoring["roleLevel"];
  if (TS >= 8 && AT >= 8 && BEH >= 7) roleLevel = "Lead";
  else if (TS >= 8 && AT >= 8) roleLevel = "Senior";
  else if (TS >= 6 && AT >= 6) roleLevel = "Mid";
  else roleLevel = "Entry";

  // Confidence Level
  let confidenceLevel: ComputedScoring["confidenceLevel"];
  if (AIQ >= 7) confidenceLevel = "High";
  else if (AIQ >= 4) confidenceLevel = "Medium";
  else confidenceLevel = "Low";

  return {
    baseScore: r2(baseScore),
    penalty,
    confidenceFactor: r2(confidenceFactor),
    overallScore: r2(overallScore),
    overallPercent: r1(overallPercent),
    recommendation,
    roleLevel,
    trainingRequirement,
    confidenceLevel,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(10, Number(n) || 0));
}
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// API call
// ---------------------------------------------------------------------------

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Max transcript length (chars) to avoid token limits and timeouts for long interviews (9+ min) */
const MAX_TRANSCRIPT_CHARS = 420_000;
/** Request timeout for report generation (long interviews can take 1–2 min) */
const REPORT_REQUEST_TIMEOUT_MS = 480_000;
/** Retry once on failure (transient errors / timeouts) */
const REPORT_MAX_ATTEMPTS = 3;

export async function generateReport(
  transcript: TranscriptEntry[],
  template: ConversationTemplate,
): Promise<EvaluationReport> {
  const { getGeminiConfig } = await import("./gemini-key");
  const geminiConfig = await getGeminiConfig();
  const apiKey = geminiConfig.apiKey;
  const reportModel = geminiConfig.reportModel;

  let formattedTranscript = transcript
    .map((e) => `[${e.role === "user" ? "Candidate" : "AI Interviewer"}]: ${e.text}`)
    .join("\n");

  // Truncate if very long to avoid token limits and timeouts (keep tail so recent Q&A is included)
  if (formattedTranscript.length > MAX_TRANSCRIPT_CHARS) {
    formattedTranscript =
      "[Transcript truncated for length — showing most recent portion]\n\n" +
      formattedTranscript.slice(-MAX_TRANSCRIPT_CHARS);
  }

  // Compute metadata
  const interviewDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const duration = getDuration(transcript);
  const prompt = buildPrompt(formattedTranscript, template, interviewDate, duration);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= REPORT_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REPORT_REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(
        `${API_BASE}/${reportModel}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              maxOutputTokens: 8192,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Report generation failed (${res.status}): ${body.slice(0, 500)}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      try {
        const raw = JSON.parse(text);
        return normalizeReport(raw);
      } catch {
        return createFallbackReport(text);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isAbort = lastError.name === "AbortError";
      const isRetryable =
        isAbort ||
        (lastError.message && /timeout|network|failed|5\d{2}/i.test(lastError.message));
      if (attempt < REPORT_MAX_ATTEMPTS && isRetryable) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError ?? new Error("Report generation failed");
}

// ---------------------------------------------------------------------------
// Duration helper
// ---------------------------------------------------------------------------

function getDuration(transcript: TranscriptEntry[]): string {
  if (transcript.length < 2) return "Less than 1 minute";
  const first = transcript[0]!.timestamp;
  const last = transcript[transcript.length - 1]!.timestamp;
  const mins = Math.round((last - first) / 60000);
  if (mins < 1) return "Less than 1 minute";
  if (mins === 1) return "1 minute";
  return `${mins} minutes`;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrompt(
  transcript: string,
  template: ConversationTemplate,
  interviewDate: string,
  duration: string,
): string {
  return `You are an expert AI interview evaluator. Analyze the voice interview transcript below and produce a comprehensive evaluation report as a single JSON object.

## Interview Context

**AI Behavior / Interviewer Role:** ${template.aiBehavior}
**What Customer / Interviewer Wants:** ${template.customerWants}
**What Candidate Offers:** ${template.candidateOffers}
**Interview Date:** ${interviewDate}
**Interview Duration:** ${duration}
**Interview Mode:** AI Voice Interview

## Transcript

${transcript}

## Required JSON Structure

Return a JSON object with EXACTLY the following keys and structure. Every score MUST be a number 0-10. Every text field MUST contain a brief evaluation (1-3 sentences). Use "N/A - not assessed in this interview" where a criterion is not applicable.

{
  "candidateInfo": {
    "fullName": "<extract from conversation if mentioned, else 'Not provided'>",
    "positionAppliedFor": "<infer from context>"
  },
  "interviewOverview": {
    "objective": "<brief interview objective>",
    "jobRoleSummary": "<brief role description based on context>",
    "evaluationCriteria": "<what was being assessed>"
  },
  "technicalSkills": {
    "coreKnowledge": "<evaluation>",
    "toolProficiency": "<evaluation>",
    "problemSolving": "<evaluation>",
    "codingSkills": "<evaluation or N/A>",
    "systemDesign": "<evaluation or N/A>",
    "accuracyLevel": "<evaluation>",
    "score": 0
  },
  "communication": {
    "verbalClarity": "<evaluation>",
    "languageProficiency": "<evaluation>",
    "listeningAbility": "<evaluation>",
    "explanationQuality": "<evaluation>",
    "confidenceLevel": "<evaluation>",
    "score": 0
  },
  "analyticalThinking": {
    "logicalReasoning": "<evaluation>",
    "decisionMaking": "<evaluation>",
    "dataInterpretation": "<evaluation>",
    "scenarioHandling": "<evaluation>",
    "innovationCreativity": "<evaluation>",
    "score": 0
  },
  "behavioral": {
    "professionalAttitude": "<evaluation>",
    "emotionalIntelligence": "<evaluation>",
    "adaptability": "<evaluation>",
    "integrityEthics": "<evaluation>",
    "stressManagement": "<evaluation>",
    "leadershipTraits": "<evaluation>",
    "score": 0
  },
  "domainKnowledge": {
    "industryAwareness": "<evaluation>",
    "roleExpertise": "<evaluation>",
    "marketTrends": "<evaluation>",
    "complianceKnowledge": "<evaluation>",
    "score": 0
  },
  "workEthic": {
    "careerGoalsAlignment": "<evaluation>",
    "initiative": "<evaluation>",
    "commitmentLevel": "<evaluation>",
    "learningAbility": "<evaluation>",
    "growthMindset": "<evaluation>",
    "score": 0
  },
  "culturalFit": {
    "teamCompatibility": "<evaluation>",
    "valuesMatch": "<evaluation>",
    "diversityAwareness": "<evaluation>",
    "collaborationSkills": "<evaluation>",
    "score": 0
  },
  "aiObservations": {
    "speechPatterns": "<analysis of speech patterns>",
    "responseConsistency": "<consistency analysis>",
    "emotionalIndicators": "<emotional signals detected>",
    "engagementLevel": "<engagement analysis>",
    "stressIndicators": "<stress signals>",
    "authenticityScore": "<authenticity assessment>"
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>"],
  "improvements": ["<area 1>", "<area 2>", "<area 3>", "<area 4>"],
  "riskAnalysis": {
    "behavioralConcerns": "<concerns or 'None identified'>",
    "skillGaps": "<gaps or 'None identified'>",
    "integrityIssues": "<issues or 'None identified'>",
    "performanceRisks": "<risks or 'None identified'>",
    "reliabilityRisks": "<risks or 'None identified'>",
    "redFlagScore": 0
  },
  "aiConfidence": {
    "dataCompleteness": "<data quality assessment>",
    "predictionReliability": "<reliability>",
    "biasRisk": "<bias assessment>",
    "confidenceScore": 0
  },
  "transcriptSummary": {
    "keyQuestions": ["<q1>", "<q2>", "<q3>"],
    "keyResponses": ["<r1>", "<r2>", "<r3>"],
    "notableQuotes": ["<quote1>", "<quote2>"]
  },
  "finalRemarks": "<overall AI system notes about this interview>"
}

IMPORTANT:
- All score fields MUST be integers or decimals between 0 and 10.
- Arrays MUST have at least 2 items.
- Be specific — reference actual content from the transcript.
- Return ONLY the JSON object, nothing else.`;
}

// ---------------------------------------------------------------------------
// Normalize / validate AI response
// ---------------------------------------------------------------------------

function normalizeReport(raw: unknown): EvaluationReport {
  const r = (raw ?? {}) as Record<string, unknown>;

  const str = (
    obj: unknown,
    key: string,
    fallback = "Not assessed",
  ): string => {
    const o = obj as Record<string, unknown> | undefined;
    return typeof o?.[key] === "string" ? (o[key] as string) : fallback;
  };

  const num = (obj: unknown, key: string, fallback = 5): number => {
    const o = obj as Record<string, unknown> | undefined;
    const v = Number(o?.[key]);
    return isNaN(v) ? fallback : Math.max(0, Math.min(10, v));
  };

  const arr = (obj: unknown, key: string): string[] => {
    const o = obj as Record<string, unknown> | undefined;
    const v = o?.[key];
    return Array.isArray(v) ? v.map(String) : [];
  };

  return {
    candidateInfo: {
      fullName: str(r.candidateInfo, "fullName", "Not provided"),
      positionAppliedFor: str(r.candidateInfo, "positionAppliedFor", "Not specified"),
    },
    interviewOverview: {
      objective: str(r.interviewOverview, "objective"),
      jobRoleSummary: str(r.interviewOverview, "jobRoleSummary"),
      evaluationCriteria: str(r.interviewOverview, "evaluationCriteria"),
    },
    technicalSkills: {
      coreKnowledge: str(r.technicalSkills, "coreKnowledge"),
      toolProficiency: str(r.technicalSkills, "toolProficiency"),
      problemSolving: str(r.technicalSkills, "problemSolving"),
      codingSkills: str(r.technicalSkills, "codingSkills"),
      systemDesign: str(r.technicalSkills, "systemDesign"),
      accuracyLevel: str(r.technicalSkills, "accuracyLevel"),
      score: num(r.technicalSkills, "score"),
    },
    communication: {
      verbalClarity: str(r.communication, "verbalClarity"),
      languageProficiency: str(r.communication, "languageProficiency"),
      listeningAbility: str(r.communication, "listeningAbility"),
      explanationQuality: str(r.communication, "explanationQuality"),
      confidenceLevel: str(r.communication, "confidenceLevel"),
      score: num(r.communication, "score"),
    },
    analyticalThinking: {
      logicalReasoning: str(r.analyticalThinking, "logicalReasoning"),
      decisionMaking: str(r.analyticalThinking, "decisionMaking"),
      dataInterpretation: str(r.analyticalThinking, "dataInterpretation"),
      scenarioHandling: str(r.analyticalThinking, "scenarioHandling"),
      innovationCreativity: str(r.analyticalThinking, "innovationCreativity"),
      score: num(r.analyticalThinking, "score"),
    },
    behavioral: {
      professionalAttitude: str(r.behavioral, "professionalAttitude"),
      emotionalIntelligence: str(r.behavioral, "emotionalIntelligence"),
      adaptability: str(r.behavioral, "adaptability"),
      integrityEthics: str(r.behavioral, "integrityEthics"),
      stressManagement: str(r.behavioral, "stressManagement"),
      leadershipTraits: str(r.behavioral, "leadershipTraits"),
      score: num(r.behavioral, "score"),
    },
    domainKnowledge: {
      industryAwareness: str(r.domainKnowledge, "industryAwareness"),
      roleExpertise: str(r.domainKnowledge, "roleExpertise"),
      marketTrends: str(r.domainKnowledge, "marketTrends"),
      complianceKnowledge: str(r.domainKnowledge, "complianceKnowledge"),
      score: num(r.domainKnowledge, "score"),
    },
    workEthic: {
      careerGoalsAlignment: str(r.workEthic, "careerGoalsAlignment"),
      initiative: str(r.workEthic, "initiative"),
      commitmentLevel: str(r.workEthic, "commitmentLevel"),
      learningAbility: str(r.workEthic, "learningAbility"),
      growthMindset: str(r.workEthic, "growthMindset"),
      score: num(r.workEthic, "score"),
    },
    culturalFit: {
      teamCompatibility: str(r.culturalFit, "teamCompatibility"),
      valuesMatch: str(r.culturalFit, "valuesMatch"),
      diversityAwareness: str(r.culturalFit, "diversityAwareness"),
      collaborationSkills: str(r.culturalFit, "collaborationSkills"),
      score: num(r.culturalFit, "score"),
    },
    aiObservations: {
      speechPatterns: str(r.aiObservations, "speechPatterns"),
      responseConsistency: str(r.aiObservations, "responseConsistency"),
      emotionalIndicators: str(r.aiObservations, "emotionalIndicators"),
      engagementLevel: str(r.aiObservations, "engagementLevel"),
      stressIndicators: str(r.aiObservations, "stressIndicators"),
      authenticityScore: str(r.aiObservations, "authenticityScore"),
    },
    strengths: arr(r, "strengths").length ? arr(r, "strengths") : ["Not enough data"],
    improvements: arr(r, "improvements").length ? arr(r, "improvements") : ["Not enough data"],
    riskAnalysis: {
      behavioralConcerns: str(r.riskAnalysis, "behavioralConcerns", "None identified"),
      skillGaps: str(r.riskAnalysis, "skillGaps", "None identified"),
      integrityIssues: str(r.riskAnalysis, "integrityIssues", "None identified"),
      performanceRisks: str(r.riskAnalysis, "performanceRisks", "None identified"),
      reliabilityRisks: str(r.riskAnalysis, "reliabilityRisks", "None identified"),
      redFlagScore: num(r.riskAnalysis, "redFlagScore", 0),
    },
    aiConfidence: {
      dataCompleteness: str(r.aiConfidence, "dataCompleteness"),
      predictionReliability: str(r.aiConfidence, "predictionReliability"),
      biasRisk: str(r.aiConfidence, "biasRisk"),
      confidenceScore: num(r.aiConfidence, "confidenceScore", 5),
    },
    transcriptSummary: {
      keyQuestions: arr(r.transcriptSummary, "keyQuestions"),
      keyResponses: arr(r.transcriptSummary, "keyResponses"),
      notableQuotes: arr(r.transcriptSummary, "notableQuotes"),
    },
    finalRemarks:
      typeof r.finalRemarks === "string"
        ? r.finalRemarks
        : "Report generated successfully.",
  };
}

// ---------------------------------------------------------------------------
// Fallback (if JSON parsing fails entirely)
// ---------------------------------------------------------------------------

function createFallbackReport(rawText: string): EvaluationReport {
  const na = "Unable to evaluate — report generation returned non-JSON response.";
  return {
    candidateInfo: { fullName: "Not provided", positionAppliedFor: "Not specified" },
    interviewOverview: { objective: na, jobRoleSummary: na, evaluationCriteria: na },
    technicalSkills: {
      coreKnowledge: na, toolProficiency: na, problemSolving: na,
      codingSkills: na, systemDesign: na, accuracyLevel: na, score: 5,
    },
    communication: {
      verbalClarity: na, languageProficiency: na, listeningAbility: na,
      explanationQuality: na, confidenceLevel: na, score: 5,
    },
    analyticalThinking: {
      logicalReasoning: na, decisionMaking: na, dataInterpretation: na,
      scenarioHandling: na, innovationCreativity: na, score: 5,
    },
    behavioral: {
      professionalAttitude: na, emotionalIntelligence: na, adaptability: na,
      integrityEthics: na, stressManagement: na, leadershipTraits: na, score: 5,
    },
    domainKnowledge: {
      industryAwareness: na, roleExpertise: na,
      marketTrends: na, complianceKnowledge: na, score: 5,
    },
    workEthic: {
      careerGoalsAlignment: na, initiative: na, commitmentLevel: na,
      learningAbility: na, growthMindset: na, score: 5,
    },
    culturalFit: {
      teamCompatibility: na, valuesMatch: na,
      diversityAwareness: na, collaborationSkills: na, score: 5,
    },
    aiObservations: {
      speechPatterns: na, responseConsistency: na, emotionalIndicators: na,
      engagementLevel: na, stressIndicators: na, authenticityScore: na,
    },
    strengths: ["Could not parse AI response"],
    improvements: ["Could not parse AI response"],
    riskAnalysis: {
      behavioralConcerns: na, skillGaps: na, integrityIssues: "None identified",
      performanceRisks: na, reliabilityRisks: na, redFlagScore: 0,
    },
    aiConfidence: {
      dataCompleteness: "Low — parsing failure",
      predictionReliability: "Low",
      biasRisk: "Unknown",
      confidenceScore: 2,
    },
    transcriptSummary: { keyQuestions: [], keyResponses: [], notableQuotes: [] },
    finalRemarks: rawText || "Report generation produced an incomplete response.",
  };
}
