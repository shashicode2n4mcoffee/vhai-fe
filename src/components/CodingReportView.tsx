/**
 * CodingReportView — View a saved coding test result by ID from URL params.
 */

import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { useGetCodingQuery } from "../store/endpoints/coding";
import { LANGUAGE_CONFIG, type CodingDetail } from "../lib/coding-test";

export function CodingReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useGetCodingQuery(id!, { skip: !id });
  const detail: CodingDetail | null =
    data?.problem && data?.evaluation
      ? {
          problem: (data as { problem: string }).problem,
          userCode: (data as { userCode?: string }).userCode ?? "",
          evaluation: (data as { evaluation: unknown }).evaluation,
          language: (data as { language?: string }).language ?? "javascript",
          difficulty: (data as { difficulty?: string }).difficulty ?? "Medium",
          timeSpent: (data as { timeSpent?: number }).timeSpent ?? 0,
        }
      : null;
  const errorMessage = isError && error && "data" in error ? (error as { data?: { error?: string } }).data?.error ?? "Failed to load coding test" : null;

  if (isLoading) {
    return (
      <div className="code-page">
        <div className="code-results-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Loading...</h2>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>Fetching coding test report.</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="code-page">
        <div className="code-results-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Error</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>{errorMessage}</p>
          <button className="btn btn--primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="code-page">
        <div className="code-results-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Report Not Found</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
            This coding test report is no longer available.
          </p>
          <button className="btn btn--primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { problem, userCode, evaluation, language, difficulty, timeSpent } = detail;
  const cats = evaluation.categories;
  const categoryList: { key: string; label: string; data: { score: number; feedback: string } }[] = [
    { key: "correctness", label: "Correctness", data: cats.correctness },
    { key: "efficiency", label: "Efficiency", data: cats.efficiency },
    { key: "codeQuality", label: "Code Quality", data: cats.codeQuality },
    { key: "edgeCases", label: "Edge Cases", data: cats.edgeCases },
    { key: "style", label: "Code Style", data: cats.style },
  ];

  return (
    <div className="code-page">
      <div className="code-results-wrap">
        <button className="btn-back" onClick={() => navigate("/dashboard")}>
          <BackIcon /> Back to Dashboard
        </button>

        {/* Score hero */}
        <div className="code-result-hero">
          <div className="code-result-ring">
            <ScoreRing value={evaluation.overallScore} />
          </div>
          <h2 className="code-result-verdict">{evaluation.verdict}</h2>
          <p className="code-result-meta">
            {problem.title} · {LANGUAGE_CONFIG[language]?.label ?? language} · {difficulty} · {formatTime(timeSpent)}
          </p>
        </div>

        {/* Category breakdown */}
        <h3 className="code-section-title">Skill Breakdown</h3>
        <div className="code-categories">
          {categoryList.map(({ key, label, data }) => (
            <div key={key} className="code-cat">
              <div className="code-cat__header">
                <span className="code-cat__label">{label}</span>
                <span className={`code-cat__score code-cat__score--${scoreColor(data.score)}`}>
                  {data.score}
                </span>
              </div>
              <div className="code-cat__bar">
                <div
                  className={`code-cat__fill code-cat__fill--${scoreColor(data.score)}`}
                  style={{ width: `${data.score}%` }}
                />
              </div>
              <p className="code-cat__feedback">{data.feedback}</p>
            </div>
          ))}
        </div>

        {/* Complexity */}
        <div className="code-complexity">
          <div className="code-complexity__item">
            <span className="code-complexity__label">Time Complexity</span>
            <code className="code-complexity__val">{evaluation.timeComplexity}</code>
          </div>
          <div className="code-complexity__item">
            <span className="code-complexity__label">Space Complexity</span>
            <code className="code-complexity__val">{evaluation.spaceComplexity}</code>
          </div>
        </div>

        {/* Strengths & Improvements */}
        <div className="code-feedback-grid">
          {evaluation.strengths.length > 0 && (
            <div className="code-feedback-col code-feedback-col--good">
              <h4 className="code-feedback-col__title">
                <CheckCircleIcon /> Strengths
              </h4>
              <ul className="code-feedback-col__list">
                {evaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
          {evaluation.improvements.length > 0 && (
            <div className="code-feedback-col code-feedback-col--improve">
              <h4 className="code-feedback-col__title">
                <LightbulbIcon /> Areas for Improvement
              </h4>
              <ul className="code-feedback-col__list">
                {evaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Your Code */}
        <div className="code-optimal">
          <h3 className="code-section-title">Your Submission</h3>
          <div className="code-optimal__editor">
            <Editor
              height="300px"
              language={LANGUAGE_CONFIG[language]?.monacoId ?? language}
              theme="vs-dark"
              value={userCode}
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                lineNumbers: "on",
                renderLineHighlight: "none",
              }}
            />
          </div>
        </div>

        {/* Optimal solution */}
        <div className="code-optimal">
          <h3 className="code-section-title">Optimal Solution</h3>
          <div className="code-optimal__editor">
            <Editor
              height="300px"
              language={LANGUAGE_CONFIG[language]?.monacoId ?? language}
              theme="vs-dark"
              value={evaluation.optimizedSolution}
              options={{
                readOnly: true,
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                padding: { top: 12, bottom: 12 },
                lineNumbers: "on",
                renderLineHighlight: "none",
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="apt-actions">
          <button className="btn-back" onClick={() => navigate("/dashboard")}>
            <BackIcon /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function ScoreRing({ value }: { value: number }) {
  const size = 140;
  const sw = 12;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color =
    value >= 80 ? "var(--accent-green)" : value >= 60 ? "var(--accent-amber)" : "var(--accent-red)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="32" fontWeight="800" fontFamily="inherit"
      >
        {value}
      </text>
    </svg>
  );
}

// ===========================================================================
// SVG Icons
// ===========================================================================

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </svg>
  );
}
