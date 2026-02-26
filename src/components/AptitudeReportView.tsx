/**
 * AptitudeReportView — View a saved aptitude test result by ID from URL params.
 */

import { useParams, useNavigate } from "react-router-dom";
import { useGetAptitudeQuery } from "../store/endpoints/aptitude";
import type { AptitudeResult } from "../lib/aptitude";

export function AptitudeReportView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useGetAptitudeQuery(id!, { skip: !id });
  const result: AptitudeResult | null = data?.quiz
    ? {
        quiz: data.quiz,
        answers: (data as { answers?: Record<string, string> }).answers ?? {},
        score: (data as { score?: number }).score ?? 0,
        total: (data as { total?: number }).total ?? 0,
        percentage: (data as { percentage?: number }).percentage ?? 0,
        passed: (data as { passed?: boolean }).passed ?? false,
      }
    : null;
  const errorMessage = isError && error && "data" in error ? (error as { data?: { error?: string } }).data?.error ?? "Failed to load aptitude test" : null;

  if (isLoading) {
    return (
      <div className="apt-page">
        <div className="apt-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Loading...</h2>
          <p style={{ color: "rgba(255,255,255,0.5)" }}>Fetching aptitude test report.</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="apt-page">
        <div className="apt-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Error</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>{errorMessage}</p>
          <button className="btn btn--primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="apt-page">
        <div className="apt-wrapper" style={{ textAlign: "center", paddingTop: 80 }}>
          <h2 style={{ marginBottom: 12 }}>Report Not Found</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
            This aptitude test report is no longer available.
          </p>
          <button className="btn btn--primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="apt-page">
      <div className="apt-wrapper">
        {/* Score hero */}
        <div className="apt-result-hero">
          <div className="apt-result-ring">
            <ScoreRing value={result.percentage} />
          </div>
          <h2 className="apt-result-score">
            {result.score}/{result.total}
          </h2>
          <span
            className={`apt-result-badge ${result.passed ? "apt-result-badge--pass" : "apt-result-badge--fail"}`}
          >
            {result.passed ? "PASSED" : "NEEDS IMPROVEMENT"}
          </span>
          <p className="apt-result-topic">{result.quiz.title}</p>
        </div>

        {/* Question breakdown */}
        <h3 className="apt-section-title">Question Breakdown</h3>
        <div className="apt-breakdown">
          {result.quiz.questions.map((q, idx) => {
            const selected = result.answers[q.id];
            const isCorrect = selected === q.correctIndex;
            return (
              <div
                key={q.id}
                className={`apt-b-card ${isCorrect ? "apt-b-card--correct" : "apt-b-card--wrong"}`}
              >
                <div className="apt-b-header">
                  <span className="apt-b-num">{idx + 1}</span>
                  <span className={`apt-b-icon ${isCorrect ? "apt-b-icon--correct" : "apt-b-icon--wrong"}`}>
                    {isCorrect ? <CheckIcon /> : <XIcon />}
                  </span>
                </div>
                <p className="apt-b-question">{q.question}</p>

                <div className="apt-b-answers">
                  {q.options.map((opt, oi) => {
                    let cls = "apt-b-opt";
                    if (oi === q.correctIndex) cls += " apt-b-opt--correct";
                    if (oi === selected && !isCorrect) cls += " apt-b-opt--wrong";
                    return (
                      <div key={oi} className={cls}>
                        <span className="apt-b-opt__marker">
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                <p className="apt-b-explain">
                  <strong>Explanation:</strong> {q.explanation}
                </p>
              </div>
            );
          })}
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
// Score Ring
// ===========================================================================

function ScoreRing({ value }: { value: number }) {
  const size = 120;
  const sw = 10;
  const r = (size - sw * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color =
    value >= 80
      ? "var(--accent-green)"
      : value >= 60
        ? "var(--accent-amber)"
        : "var(--accent-red)";

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
        fill={color} fontSize="28" fontWeight="800" fontFamily="inherit"
      >
        {value}%
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

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
