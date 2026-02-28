/**
 * FullFlowReportPage — Combined final report for the full interview flow.
 *
 * Reads aptitude, interview (transcript + report), and coding results from
 * localStorage (saved by AptitudeTest, ConversationReport, CodingTest) and
 * displays a single consolidated report.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFullFlowReport,
  clearFullFlowReport,
  type FullFlowReportSession,
  type FullFlowAptitudeResult,
  type FullFlowInterviewResult,
  type FullFlowCodingResult,
} from "../lib/fullFlowStorage";
import { computeScoring, type EvaluationReport } from "../lib/report-generator";
import type { CodeEvaluation } from "../lib/coding-test";
import { BoltIcon } from "./AppLogo";

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}

export function FullFlowReportPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<FullFlowReportSession | null>(null);

  useEffect(() => {
    setSession(getFullFlowReport());
  }, []);

  // Redirect if no session
  useEffect(() => {
    if (session === null) return;
  }, [session]);

  const handleBackToDashboard = () => {
    clearFullFlowReport();
    navigate("/dashboard", { state: { fullFlowComplete: true } });
  };

  if (session === null) {
    return (
      <div className="dash">
        <div className="report-loading" style={{ padding: 80 }}>
          <div className="report-loading__spinner" />
          <p>Loading report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <header className="dash__topbar">
        <button type="button" className="dash__brand" onClick={() => navigate("/dashboard")} title="Dashboard">
          <div className="dash__brand-icon">
            <BoltIcon />
          </div>
          <span className="dash__brand-name">VocalHireAI</span>
        </button>
        <div className="dash__user-section">
          <button type="button" className="dash__topbar-btn" onClick={handleBackToDashboard}>
            ← Dashboard
          </button>
        </div>
      </header>

      <div className="dash__content">
        <div className="full-flow-report">
          <h1 className="full-flow-report__title">Full Interview Report</h1>
          <p className="full-flow-report__meta">
            Template: <strong>{session.templateName}</strong> · Started{" "}
            {new Date(session.startedAt).toLocaleString()}
          </p>

          <div className="full-flow-report__sections">
            {session.aptitude && (
              <AptitudeSection result={session.aptitude} />
            )}
            {session.interview && (
              <InterviewSection result={session.interview} />
            )}
            {session.coding ? (
              <CodingSection result={session.coding} />
            ) : (
              <CodingSectionSkipped />
            )}
          </div>

          <div className="apt-actions" style={{ marginTop: 32 }}>
            <button type="button" className="btn btn--primary" onClick={handleBackToDashboard}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aptitude section
// ---------------------------------------------------------------------------
function AptitudeSection({ result }: { result: FullFlowAptitudeResult }) {
  return (
    <section className="report-card full-flow-report__card">
      <div className="eval-section__header">
        <span className="eval-section__num">1</span>
        <h2 className="report-card__title">Aptitude Test</h2>
        <span className={`eval-rec-badge eval-rec-badge--${result.passed ? "strong-hire" : "reject"}`}>
          {result.passed ? "PASSED" : "NEEDS IMPROVEMENT"}
        </span>
      </div>
      <div className="eval-criteria">
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Score</span>
          <span className="eval-criteria__value">
            {result.score} / {result.total} ({result.percentage}%)
          </span>
        </div>
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Topic</span>
          <span className="eval-criteria__value">{result.topic}</span>
        </div>
        {result.timeSpentSec != null && (
          <div className="eval-criteria__row">
            <span className="eval-criteria__label">Time</span>
            <span className="eval-criteria__value">{formatDuration(result.timeSpentSec)}</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Interview section (transcript + report summary)
// ---------------------------------------------------------------------------
function InterviewSection({ result }: { result: FullFlowInterviewResult }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const scoring = useMemo(() => {
    const report = result.report as EvaluationReport | null | undefined;
    if (!report || typeof report !== "object" || !("technicalSkills" in report)) return null;
    return computeScoring(report as EvaluationReport);
  }, [result.report]);

  return (
    <section className="report-card full-flow-report__card">
      <div className="eval-section__header">
        <span className="eval-section__num">2</span>
        <h2 className="report-card__title">AI Video Interview</h2>
        {scoring && (
          <span
            className={`eval-rec-badge eval-rec-badge--${scoring.recommendation.toLowerCase().replace(" ", "-")}`}
          >
            {scoring.recommendation}
          </span>
        )}
      </div>

      {scoring && (
        <div className="eval-criteria" style={{ marginBottom: 16 }}>
          <div className="eval-criteria__row">
            <span className="eval-criteria__label">Overall Score</span>
            <span className="eval-criteria__value">{scoring.overallScore}/10 ({scoring.overallPercent}%)</span>
          </div>
          <div className="eval-criteria__row">
            <span className="eval-criteria__label">Confidence</span>
            <span className="eval-criteria__value">{scoring.confidenceLevel}</span>
          </div>
          <div className="eval-criteria__row">
            <span className="eval-criteria__label">Role Level</span>
            <span className="eval-criteria__value">{scoring.roleLevel}</span>
          </div>
        </div>
      )}

      {result.report && typeof result.report === "object" && "strengths" in result.report && (
        <div className="full-flow-report__subsection">
          <h4 className="eval-sub__title">Strengths</h4>
          <ul className="report-list report-list--green">
            {(result.report as EvaluationReport).strengths.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.transcript.length > 0 && (
        <div className="full-flow-report__subsection">
          <button
            type="button"
            className="full-flow-report__toggle"
            onClick={() => setShowTranscript(!showTranscript)}
          >
            {showTranscript ? "Hide" : "Show"} full transcript ({result.transcript.length} entries)
          </button>
          {showTranscript && (
            <div className="report-transcript" style={{ marginTop: 12 }}>
              {result.transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`report-transcript__entry report-transcript__entry--${entry.role}`}
                >
                  <span className="report-transcript__role">
                    {entry.role === "user" ? "Candidate" : "AI Interviewer"}
                  </span>
                  <p className="report-transcript__text">{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coding section (skipped for MBA/Management track)
// ---------------------------------------------------------------------------
function CodingSectionSkipped() {
  return (
    <section className="report-card full-flow-report__card">
      <div className="eval-section__header">
        <span className="eval-section__num">3</span>
        <h2 className="report-card__title">Coding Challenge</h2>
        <span className="eval-rec-badge eval-rec-badge--neutral">Not applicable</span>
      </div>
      <p className="full-flow-report__subsection" style={{ marginTop: 8, opacity: 0.9 }}>
        Skipped for this track (MBA/Management). Coding is not part of the assessment.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coding section
// ---------------------------------------------------------------------------
function CodingSection({ result }: { result: FullFlowCodingResult }) {
  const ev = result.evaluation as CodeEvaluation | null | undefined;

  return (
    <section className="report-card full-flow-report__card">
      <div className="eval-section__header">
        <span className="eval-section__num">3</span>
        <h2 className="report-card__title">Coding Challenge</h2>
        <span className="eval-rec-badge eval-rec-badge--neutral">{result.verdict}</span>
      </div>
      <div className="eval-criteria">
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Problem</span>
          <span className="eval-criteria__value">{result.problemTitle}</span>
        </div>
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Score</span>
          <span className="eval-criteria__value">{result.score}/100</span>
        </div>
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Language</span>
          <span className="eval-criteria__value">{result.language}</span>
        </div>
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Difficulty</span>
          <span className="eval-criteria__value">{result.difficulty}</span>
        </div>
        <div className="eval-criteria__row">
          <span className="eval-criteria__label">Time</span>
          <span className="eval-criteria__value">{formatDuration(result.timeSpentSec)}</span>
        </div>
      </div>

      {ev && (
        <>
          {ev.timeComplexity && (
            <div className="eval-criteria" style={{ marginTop: 12 }}>
              <div className="eval-criteria__row">
                <span className="eval-criteria__label">Time Complexity</span>
                <code className="eval-criteria__value">{ev.timeComplexity}</code>
              </div>
              <div className="eval-criteria__row">
                <span className="eval-criteria__label">Space Complexity</span>
                <code className="eval-criteria__value">{ev.spaceComplexity}</code>
              </div>
            </div>
          )}
          {ev.strengths?.length > 0 && (
            <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
              <h4 className="eval-sub__title">Strengths</h4>
              <ul className="report-list report-list--green">
                {ev.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {ev.improvements?.length > 0 && (
            <div className="full-flow-report__subsection" style={{ marginTop: 8 }}>
              <h4 className="eval-sub__title">Areas for Improvement</h4>
              <ul className="report-list report-list--amber">
                {ev.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
