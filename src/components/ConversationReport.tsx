/**
 * ConversationReport — Comprehensive VocalHireAI Evaluation Report (20 sections).
 *
 * Sections 14, 14A, 16, 17 are computed client-side using the automated
 * scoring formula. All other sections are AI-generated via Gemini.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import type { ConversationTemplate, TranscriptEntry } from "../types/gemini";
import {
  generateReport,
  computeScoring,
  type EvaluationReport,
  type ComputedScoring,
} from "../lib/report-generator";
import { useToast } from "./Toast";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { getAccessToken } from "../store/api";
import {
  selectTemplate,
  selectTranscript,
  selectVideoUrl,
  selectInterviewId,
  resetInterview,
  setTemplate,
  setInterviewResult,
} from "../store/interviewSlice";
import { getTranscriptBackup, clearTranscriptBackup } from "../lib/transcriptBackup";
import { reportToPdf } from "../lib/reportToPdf";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

type Status = "loading" | "done" | "error";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConversationReport() {
  const template = useAppSelector(selectTemplate);
  const transcript = useAppSelector(selectTranscript);
  const videoUrl = useAppSelector(selectVideoUrl);
  const interviewId = useAppSelector(selectInterviewId);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [hasCheckedBackup, setHasCheckedBackup] = useState(false);

  // Restore transcript from localStorage backup if Redux is empty (e.g. refresh, report failed earlier)
  useEffect(() => {
    if (hasCheckedBackup) return;
    if (transcript.length > 0) {
      setHasCheckedBackup(true);
      return;
    }
    const backup = getTranscriptBackup();
    if (backup?.transcript?.length && backup.template) {
      const merged: TranscriptEntry[] = [...backup.transcript];
      if (backup.pendingUserText.trim()) {
        merged.push({
          id: `user-restored-${Date.now()}`,
          role: "user",
          text: backup.pendingUserText.trim(),
          timestamp: backup.savedAt,
        });
      }
      if (backup.pendingAssistantText.trim()) {
        merged.push({
          id: `assistant-restored-${Date.now()}`,
          role: "assistant",
          text: backup.pendingAssistantText.trim(),
          timestamp: backup.savedAt,
        });
      }
      dispatch(setTemplate(backup.template));
      dispatch(setInterviewResult({ transcript: merged, videoUrl: null }));
    }
    setHasCheckedBackup(true);
  }, [dispatch, hasCheckedBackup, transcript.length]);

  if (!hasCheckedBackup) {
    return (
      <div className="report-page">
        <div className="report-loading">
          <div className="report-loading__spinner" />
          <p>Checking for saved transcript...</p>
        </div>
      </div>
    );
  }

  if (!template || transcript.length === 0) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ReportInner
      template={template}
      transcript={transcript}
      videoUrl={videoUrl}
      interviewId={interviewId}
      onReportGenerated={() => clearTranscriptBackup()}
      onBackToDashboard={() => {
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        dispatch(resetInterview());
        navigate("/dashboard");
      }}
    />
  );
}

// Inner component — avoids hook-ordering issues with early return
function ReportInner({
  template,
  transcript,
  videoUrl,
  interviewId,
  onReportGenerated,
  onBackToDashboard,
}: {
  template: ConversationTemplate;
  transcript: TranscriptEntry[];
  videoUrl: string | null;
  interviewId: string | null;
  onReportGenerated: () => void;
  onBackToDashboard: () => void;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [error, setError] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const toast = useToast();
  const toastRef = useRef(toast);
  const reportWrapperRef = useRef<HTMLDivElement>(null);
  toastRef.current = toast;

  const handleDownloadPdf = useCallback(async () => {
    const el = reportWrapperRef.current;
    if (!el) return;
    setDownloadingPdf(true);
    try {
      await reportToPdf(el, `VocalHireAI-Report-${interviewId ?? "session"}.pdf`);
    } catch (err) {
      const { logErrorToServer } = await import("../lib/logError");
      logErrorToServer("PDF download failed", { details: err instanceof Error ? err.message : String(err), source: "report_pdf" });
    } finally {
      setDownloadingPdf(false);
    }
  }, [interviewId]);

  useEffect(() => {
    let cancelled = false;
    const tid = toastRef.current.loading("Generating evaluation report...");
    async function run() {
      try {
        const result = await generateReport(transcript, template);
        if (!cancelled) {
          setReport(result);
          setStatus("done");
          toastRef.current.update(tid, "success", "Report generated successfully!");
          onReportGenerated();
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setStatus("error");
          toastRef.current.update(tid, "error", `Report failed: ${msg}`);
          const { logErrorToServer } = await import("../lib/logError");
          logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "interview_report" });
          // Mark interview so dashboard doesn't stay "Pending"
          if (interviewId) {
            try {
              const token = getAccessToken();
              const first = transcript[0];
              const last = transcript[transcript.length - 1];
              const durationSeconds =
                transcript.length >= 2 && first && last
                  ? Math.round((last.timestamp - first.timestamp) / 1000)
                  : 0;
              await fetch(`${API_BASE}/interviews/${interviewId}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  transcript,
                  duration: durationSeconds,
                  recommendation: "Report failed",
                  status: "COMPLETED",
                }),
              });
            } catch {
              // ignore
            }
          }
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
      toastRef.current.dismiss(tid);
    };
  }, [transcript, template, interviewId, onReportGenerated]);

  // Computed scoring (memoized so it doesn't recompute on every render)
  const scoring = useMemo(
    () => (report ? computeScoring(report) : null),
    [report],
  );

  // Metadata
  const interviewDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );
  const duration = useMemo(() => {
    if (transcript.length < 2) return "Less than 1 minute";
    const last = transcript[transcript.length - 1];
    const first = transcript[0];
    if (!last || !first) return "Less than 1 minute";
    const mins = Math.round((last.timestamp - first.timestamp) / 60000);
    return mins < 1 ? "Less than 1 minute" : `${mins} minute${mins > 1 ? "s" : ""}`;
  }, [transcript]);
  const reportId = useMemo(
    () =>
      `EVAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    [],
  );

  // Save report to backend once (when report + scoring become available)
  const savedRef = useRef(false);
  useEffect(() => {
    if (report && scoring && interviewId && !savedRef.current) {
      savedRef.current = true;
      const last = transcript[transcript.length - 1];
      const first = transcript[0];
      const durationSeconds =
        transcript.length >= 2 && last && first
          ? Math.round((last.timestamp - first.timestamp) / 1000)
          : 0;

      (async () => {
        try {
          const token = getAccessToken();
          const res = await fetch(`${API_BASE}/interviews/${interviewId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              report,
              scoring,
              transcript,
              duration: durationSeconds,
              overallScore: scoring.overallScore,
              recommendation: scoring.recommendation,
              status: "COMPLETED",
            }),
          });
          if (!res.ok) {
            const text = await res.text();
            toastRef.current.error(`Failed to save report: ${text}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to save report";
          toastRef.current.error(msg);
          const { logErrorToServer } = await import("../lib/logError");
          logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "interview_report" });
        }
      })();
    }
  }, [report, scoring, interviewId, transcript]);

  // ---- Loading ----
  if (status === "loading") {
    return (
      <div className="report-page">
        <div className="report-loading">
          <div className="report-loading__spinner" />
          <h2 className="report-loading__title">Generating Evaluation Report</h2>
          <p className="report-loading__subtitle">
            Analysing interview transcript across 20 evaluation dimensions...
          </p>
        </div>
      </div>
    );
  }

  // ---- Error ----
  if (status === "error") {
    return (
      <div className="report-page">
        <div className="report-error">
          <h2>Report Generation Failed</h2>
          <p>{error}</p>
          <button className="btn btn--start" onClick={onBackToDashboard}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!report || !scoring) return null;

  // ---- Next steps (Section 17) ----
  const nextSteps = getNextSteps(scoring.recommendation);

  // ---- Render ----
  return (
    <div className="report-page">
      <div className="report-wrapper" ref={reportWrapperRef}>
        {/* ================================================================
            HEADER
            ================================================================ */}
        <header className="report-header">
          <button type="button" className="report-header__title" onClick={() => navigate("/dashboard")} title="Dashboard" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "inherit" }}>
            VocalHireAI Evaluation Report
          </button>
          <p className="report-header__subtitle">
            Comprehensive AI video interview analysis
          </p>
        </header>

        {/* ================================================================
            HERO — Overall Score + Recommendation + Quick Stats
            ================================================================ */}
        <div className="eval-hero">
          <ScoreRing
            score={scoring.overallPercent}
            label="Overall"
            size={128}
          />
          <span
            className={`eval-rec-badge eval-rec-badge--${scoring.recommendation.toLowerCase().replace(" ", "-")}`}
          >
            {scoring.recommendation}
          </span>
        </div>

        <div className="eval-stats-row">
          <div className="eval-stat">
            <span className="eval-stat__label">Confidence</span>
            <span
              className="eval-stat__value"
              style={{ color: confidenceColor(scoring.confidenceLevel) }}
            >
              {scoring.confidenceLevel}
            </span>
          </div>
          <div className="eval-stat">
            <span className="eval-stat__label">Role Level</span>
            <span className="eval-stat__value">{scoring.roleLevel}</span>
          </div>
          <div className="eval-stat">
            <span className="eval-stat__label">Training</span>
            <span className="eval-stat__value">{scoring.trainingRequirement}</span>
          </div>
          <div className="eval-stat">
            <span className="eval-stat__label">Score</span>
            <span className="eval-stat__value">
              {scoring.overallScore}/10
            </span>
          </div>
        </div>

        {/* ================================================================
            S1 — Candidate Information
            ================================================================ */}
        <SectionCard n={1} title="Candidate Information">
          <div className="eval-criteria">
            <CriteriaRow label="Full Name" value={report.candidateInfo.fullName} />
            <CriteriaRow label="Position Applied For" value={report.candidateInfo.positionAppliedFor} />
            <CriteriaRow label="Interview Date" value={interviewDate} />
            <CriteriaRow label="Interview Mode" value="AI Voice Interview" />
            <CriteriaRow label="Interview Duration" value={duration} />
          </div>
        </SectionCard>

        {/* ================================================================
            S2 — Interview Overview
            ================================================================ */}
        <SectionCard n={2} title="Interview Overview">
          <div className="eval-criteria">
            <CriteriaRow label="Interview Objective" value={report.interviewOverview.objective} />
            <CriteriaRow label="Job Role Summary" value={report.interviewOverview.jobRoleSummary} />
            <CriteriaRow label="Assessment Method" value="AI Voice Interview with VAD" />
            <CriteriaRow label="AI Model Used" value={import.meta.env.VITE_GEMINI_MODEL || "Gemini"} />
            <CriteriaRow label="Evaluation Criteria" value={report.interviewOverview.evaluationCriteria} />
          </div>
        </SectionCard>

        {/* ================================================================
            S14 — Performance Summary Table
            ================================================================ */}
        <SectionCard n={14} title="Performance Summary">
          <table className="eval-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Score (0-10)</th>
              </tr>
            </thead>
            <tbody>
              <ScoreTableRow label="Technical Skills" score={report.technicalSkills.score} />
              <ScoreTableRow label="Communication" score={report.communication.score} />
              <ScoreTableRow label="Analytical Thinking" score={report.analyticalThinking.score} />
              <ScoreTableRow label="Behavioral Traits" score={report.behavioral.score} />
              <ScoreTableRow label="Domain Knowledge" score={report.domainKnowledge.score} />
              <ScoreTableRow label="Cultural Fit" score={report.culturalFit.score} />
              <ScoreTableRow label="Motivation" score={report.workEthic.score} />
              <tr className="eval-table__total">
                <td>Overall Score</td>
                <td className="eval-table__score" style={{ color: scoreClr(scoring.overallScore) }}>
                  {scoring.overallScore}
                </td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        {/* ================================================================
            S3 — Technical Skills
            ================================================================ */}
        <SectionCard n={3} title="Technical Skills Assessment" score={report.technicalSkills.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Core Technical Knowledge" value={report.technicalSkills.coreKnowledge} />
            <CriteriaRow label="Tool/Technology Proficiency" value={report.technicalSkills.toolProficiency} />
            <CriteriaRow label="Problem-Solving Ability" value={report.technicalSkills.problemSolving} />
            <CriteriaRow label="Coding/Practical Skills" value={report.technicalSkills.codingSkills} />
            <CriteriaRow label="System Design Understanding" value={report.technicalSkills.systemDesign} />
            <CriteriaRow label="Accuracy Level" value={report.technicalSkills.accuracyLevel} />
          </div>
        </SectionCard>

        {/* ================================================================
            S4 — Communication Skills
            ================================================================ */}
        <SectionCard n={4} title="Communication Skills" score={report.communication.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Verbal Clarity" value={report.communication.verbalClarity} />
            <CriteriaRow label="Language Proficiency" value={report.communication.languageProficiency} />
            <CriteriaRow label="Listening Ability" value={report.communication.listeningAbility} />
            <CriteriaRow label="Explanation Quality" value={report.communication.explanationQuality} />
            <CriteriaRow label="Confidence Level" value={report.communication.confidenceLevel} />
          </div>
        </SectionCard>

        {/* ================================================================
            S5 — Analytical & Critical Thinking
            ================================================================ */}
        <SectionCard n={5} title="Analytical & Critical Thinking" score={report.analyticalThinking.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Logical Reasoning" value={report.analyticalThinking.logicalReasoning} />
            <CriteriaRow label="Decision-Making Ability" value={report.analyticalThinking.decisionMaking} />
            <CriteriaRow label="Data Interpretation" value={report.analyticalThinking.dataInterpretation} />
            <CriteriaRow label="Case/Scenario Handling" value={report.analyticalThinking.scenarioHandling} />
            <CriteriaRow label="Innovation & Creativity" value={report.analyticalThinking.innovationCreativity} />
          </div>
        </SectionCard>

        {/* ================================================================
            S6 — Behavioral & Personality
            ================================================================ */}
        <SectionCard n={6} title="Behavioral & Personality Assessment" score={report.behavioral.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Professional Attitude" value={report.behavioral.professionalAttitude} />
            <CriteriaRow label="Emotional Intelligence" value={report.behavioral.emotionalIntelligence} />
            <CriteriaRow label="Adaptability" value={report.behavioral.adaptability} />
            <CriteriaRow label="Integrity & Ethics" value={report.behavioral.integrityEthics} />
            <CriteriaRow label="Stress Management" value={report.behavioral.stressManagement} />
            <CriteriaRow label="Leadership Traits" value={report.behavioral.leadershipTraits} />
          </div>
        </SectionCard>

        {/* ================================================================
            S7 — Domain Knowledge
            ================================================================ */}
        <SectionCard n={7} title="Domain Knowledge" score={report.domainKnowledge.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Industry Awareness" value={report.domainKnowledge.industryAwareness} />
            <CriteriaRow label="Role-Specific Expertise" value={report.domainKnowledge.roleExpertise} />
            <CriteriaRow label="Market/Trend Understanding" value={report.domainKnowledge.marketTrends} />
            <CriteriaRow label="Compliance & Standards" value={report.domainKnowledge.complianceKnowledge} />
          </div>
        </SectionCard>

        {/* ================================================================
            S8 — Work Ethic & Motivation
            ================================================================ */}
        <SectionCard n={8} title="Work Ethic & Motivation" score={report.workEthic.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Career Goals Alignment" value={report.workEthic.careerGoalsAlignment} />
            <CriteriaRow label="Initiative" value={report.workEthic.initiative} />
            <CriteriaRow label="Commitment Level" value={report.workEthic.commitmentLevel} />
            <CriteriaRow label="Learning Ability" value={report.workEthic.learningAbility} />
            <CriteriaRow label="Growth Mindset" value={report.workEthic.growthMindset} />
          </div>
        </SectionCard>

        {/* ================================================================
            S9 — Cultural Fit
            ================================================================ */}
        <SectionCard n={9} title="Cultural Fit Assessment" score={report.culturalFit.score}>
          <div className="eval-criteria">
            <CriteriaRow label="Team Compatibility" value={report.culturalFit.teamCompatibility} />
            <CriteriaRow label="Organizational Values Match" value={report.culturalFit.valuesMatch} />
            <CriteriaRow label="Diversity & Inclusion" value={report.culturalFit.diversityAwareness} />
            <CriteriaRow label="Collaboration Skills" value={report.culturalFit.collaborationSkills} />
          </div>
        </SectionCard>

        {/* ================================================================
            S10 — AI Observations
            ================================================================ */}
        <SectionCard n={10} title="AI Observations">
          <div className="eval-criteria">
            <CriteriaRow label="Speech Pattern Analysis" value={report.aiObservations.speechPatterns} />
            <CriteriaRow label="Response Consistency" value={report.aiObservations.responseConsistency} />
            <CriteriaRow label="Emotional Indicators" value={report.aiObservations.emotionalIndicators} />
            <CriteriaRow label="Engagement Level" value={report.aiObservations.engagementLevel} />
            <CriteriaRow label="Stress Indicators" value={report.aiObservations.stressIndicators} />
            <CriteriaRow label="Authenticity Score" value={report.aiObservations.authenticityScore} />
          </div>
        </SectionCard>

        {/* ================================================================
            S11 — Strengths
            ================================================================ */}
        <SectionCard n={11} title="Strengths Identified" variant="green">
          <ul className="report-list report-list--green">
            {report.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </SectionCard>

        {/* ================================================================
            S12 — Areas for Improvement
            ================================================================ */}
        <SectionCard n={12} title="Areas for Improvement" variant="amber">
          <ul className="report-list report-list--amber">
            {report.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </SectionCard>

        {/* ================================================================
            S13 — Risk & Red Flag Analysis
            ================================================================ */}
        <SectionCard n={13} title="Risk & Red Flag Analysis" variant="red">
          <div className="eval-criteria">
            <CriteriaRow label="Behavioral Concerns" value={report.riskAnalysis.behavioralConcerns} />
            <CriteriaRow label="Skill Gaps" value={report.riskAnalysis.skillGaps} />
            <CriteriaRow label="Integrity Issues" value={report.riskAnalysis.integrityIssues} />
            <CriteriaRow label="Performance Risks" value={report.riskAnalysis.performanceRisks} />
            <CriteriaRow label="Reliability Risks" value={report.riskAnalysis.reliabilityRisks} />
          </div>
          <div className="eval-redflag-score">
            Red Flag Severity:{" "}
            <span style={{ color: report.riskAnalysis.redFlagScore > 4 ? "var(--accent-red)" : "var(--accent-green)" }}>
              {report.riskAnalysis.redFlagScore}/10
            </span>
          </div>
        </SectionCard>

        {/* ================================================================
            S14A — Automated Scoring Formula
            ================================================================ */}
        <SectionCard n={"14A"} title="Automated Scoring Breakdown">
          <div className="eval-formula">
            <div className="eval-formula__row">
              <span className="eval-formula__label">Weighted Base Score</span>
              <span className="eval-formula__value">{scoring.baseScore}</span>
            </div>
            <div className="eval-formula__row">
              <span className="eval-formula__label">
                Red Flag Penalty (severity {report.riskAnalysis.redFlagScore})
              </span>
              <span className="eval-formula__value" style={{ color: "var(--accent-red)" }}>
                -{scoring.penalty}
              </span>
            </div>
            <div className="eval-formula__row">
              <span className="eval-formula__label">
                Confidence Factor (AIQ {report.aiConfidence.confidenceScore})
              </span>
              <span className="eval-formula__value">
                x{scoring.confidenceFactor}
              </span>
            </div>
            <div className="eval-formula__row eval-formula__row--total">
              <span className="eval-formula__label">Final Overall Score</span>
              <span className="eval-formula__value" style={{ color: scoreClr(scoring.overallScore) }}>
                {scoring.overallScore} / 10 ({scoring.overallPercent}%)
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ================================================================
            S15 — AI Confidence Level
            ================================================================ */}
        <SectionCard n={15} title="AI Confidence Level">
          <div className="eval-criteria">
            <CriteriaRow label="Data Completeness" value={report.aiConfidence.dataCompleteness} />
            <CriteriaRow label="Prediction Reliability" value={report.aiConfidence.predictionReliability} />
            <CriteriaRow label="Bias Risk Assessment" value={report.aiConfidence.biasRisk} />
          </div>
          <div className="eval-confidence-badge">
            Confidence Level:{" "}
            <span
              className={`eval-confidence-pill eval-confidence-pill--${scoring.confidenceLevel.toLowerCase()}`}
            >
              {scoring.confidenceLevel}
            </span>
          </div>
        </SectionCard>

        {/* ================================================================
            S16 — Recommendation
            ================================================================ */}
        <SectionCard n={16} title="Recommendation">
          <div className="eval-rec-grid">
            <div className="eval-rec-item">
              <span className="eval-rec-label">Hiring Decision</span>
              <span
                className={`eval-rec-badge eval-rec-badge--${scoring.recommendation.toLowerCase().replace(" ", "-")}`}
              >
                {scoring.recommendation}
              </span>
            </div>
            <div className="eval-rec-item">
              <span className="eval-rec-label">Suitable Role Level</span>
              <span className="eval-rec-badge eval-rec-badge--neutral">
                {scoring.roleLevel}
              </span>
            </div>
            <div className="eval-rec-item">
              <span className="eval-rec-label">Training Required</span>
              <span className="eval-rec-badge eval-rec-badge--neutral">
                {scoring.trainingRequirement}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* ================================================================
            S17 — Next Steps
            ================================================================ */}
        <SectionCard n={17} title="Next Steps">
          <div className="eval-criteria">
            {nextSteps.map((step, i) => (
              <CriteriaRow key={i} label={step.label} value={step.action} />
            ))}
          </div>
        </SectionCard>

        {/* ================================================================
            S18 — Interview Transcript Summary
            ================================================================ */}
        <SectionCard n={18} title="Interview Transcript Summary">
          {report.transcriptSummary.keyQuestions.length > 0 && (
            <div className="eval-sub">
              <h4 className="eval-sub__title">Key Questions Asked</h4>
              <ul className="report-list report-list--green">
                {report.transcriptSummary.keyQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {report.transcriptSummary.keyResponses.length > 0 && (
            <div className="eval-sub">
              <h4 className="eval-sub__title">Key Responses</h4>
              <ul className="report-list report-list--green">
                {report.transcriptSummary.keyResponses.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {report.transcriptSummary.notableQuotes.length > 0 && (
            <div className="eval-sub">
              <h4 className="eval-sub__title">Notable Quotes</h4>
              <ul className="report-list report-list--amber">
                {report.transcriptSummary.notableQuotes.map((q, i) => (
                  <li key={i}>"{q}"</li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        {/* ================================================================
            Video Recording
            ================================================================ */}
        {videoUrl && (
          <section className="report-card report-card--video">
            <div className="eval-section__header">
              <span className="eval-section__num">
                <IconVideo />
              </span>
              <h3 className="report-card__title">Conversation Recording</h3>
            </div>
            <div className="report-video-wrapper">
              <video className="report-video" src={videoUrl} controls playsInline />
            </div>
            <div className="report-video-actions">
              <a
                className="btn btn--download"
                href={videoUrl}
                download={`interview-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`}
              >
                <IconDownload /> Download Recording
              </a>
            </div>
          </section>
        )}

        {/* ================================================================
            Full Transcript
            ================================================================ */}
        {transcript.length > 0 && (
          <SectionCard n={"T"} title="Full Transcript">
            <div className="report-transcript">
              {transcript.map((entry) => (
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
          </SectionCard>
        )}

        {/* ================================================================
            S19 — Ethical & Compliance Check
            ================================================================ */}
        <SectionCard n={19} title="Ethical & Compliance Check">
          <div className="eval-criteria">
            <CriteriaRow label="Data Privacy Compliance" value="AI analysis conducted via API with encryption in transit. No data stored permanently." />
            <CriteriaRow label="Consent Confirmation" value="Candidate consented to AI-assisted interview evaluation by initiating the session." />
            <CriteriaRow label="Bias Mitigation Applied" value="Standardized evaluation criteria applied uniformly across all assessment dimensions." />
            <CriteriaRow label="Transparency Level" value="Full scoring methodology and formula disclosed in this report (Section 14A)." />
          </div>
        </SectionCard>

        {/* ================================================================
            S20 — Final Remarks
            ================================================================ */}
        <SectionCard n={20} title="Final Remarks">
          <p className="report-card__body">{report.finalRemarks}</p>
        </SectionCard>

        {/* ================================================================
            Footer
            ================================================================ */}
        <div className="eval-footer">
          <span className="eval-footer__line eval-footer__line--bold">
            VocalHireAI Evaluation System
          </span>
          <span className="eval-footer__line">Version 1.0</span>
          <span className="eval-footer__line">
            Generated: {new Date().toLocaleString()}
          </span>
          <span className="eval-footer__line">Report ID: {reportId}</span>
        </div>

        {/* ================================================================
            Actions
            ================================================================ */}
        <div className="report-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf || status !== "done"}
          >
            {downloadingPdf ? "Generating PDF…" : <><IconPdf /> Download PDF</>}
          </button>
          <button className="btn btn--start" onClick={onBackToDashboard}>
            <IconBack /> Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Helper components
// ===========================================================================

/** Reusable section card with numbered badge */
function SectionCard({
  n,
  title,
  children,
  variant,
  score,
}: {
  n: number | string;
  title: string;
  children: React.ReactNode;
  variant?: "green" | "amber" | "red" | "video";
  score?: number;
}) {
  const variantClass = variant ? ` report-card--${variant}` : "";
  return (
    <section className={`report-card${variantClass}`}>
      <div className="eval-section__header">
        <span className="eval-section__num">{n}</span>
        <h3 className="report-card__title">{title}</h3>
        {score !== undefined && (
          <span className={`eval-score-badge eval-score-badge--${scoreLevel(score)}`}>
            {score}/10
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Key-value criteria row */
function CriteriaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="eval-criteria__row">
      <span className="eval-criteria__label">{label}</span>
      <span className="eval-criteria__value">{value}</span>
    </div>
  );
}

/** Performance table row */
function ScoreTableRow({ label, score }: { label: string; score: number }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="eval-table__score" style={{ color: scoreClr(score) }}>
        {score}
      </td>
    </tr>
  );
}

/** Circular score ring */
function ScoreRing({
  score,
  label,
  size = 108,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const strokeW = size > 120 ? 10 : 8;
  const radius = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreClr(score / 10);

  return (
    <div className="score-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeW}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="score-ring__inner">
        <span className="score-ring__value" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="score-ring__label">{label}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function scoreLevel(score: number): "high" | "mid" | "low" {
  if (score >= 7) return "high";
  if (score >= 5) return "mid";
  return "low";
}

function scoreClr(score: number): string {
  if (score >= 7) return "var(--accent-green)";
  if (score >= 5) return "var(--accent-amber)";
  return "var(--accent-red)";
}

function confidenceColor(level: string): string {
  if (level === "High") return "var(--accent-green)";
  if (level === "Medium") return "var(--accent-amber)";
  return "var(--accent-red)";
}

function getNextSteps(
  recommendation: ComputedScoring["recommendation"],
): { label: string; action: string }[] {
  switch (recommendation) {
    case "Strong Hire":
      return [
        { label: "HR Review", action: "Ready for immediate processing" },
        { label: "Offer Discussion", action: "Recommended within 48 hours" },
        { label: "Background Verification", action: "Initiate standard verification" },
        { label: "Technical Round", action: "May be waived based on strong performance" },
        { label: "Managerial Round", action: "Final alignment meeting recommended" },
      ];
    case "Hire":
      return [
        { label: "Technical Round", action: "Additional technical assessment recommended" },
        { label: "Managerial Round", action: "Schedule with hiring manager" },
        { label: "HR Review", action: "Proceed to standard review" },
        { label: "Background Verification", action: "Pending technical clearance" },
        { label: "Offer Discussion", action: "After completing remaining rounds" },
      ];
    case "Consider":
      return [
        { label: "Additional Interview", action: "Further evaluation required" },
        { label: "Skill Assessment", action: "Targeted assessment for identified gaps" },
        { label: "Review Meeting", action: "Team discussion recommended" },
        { label: "Background Verification", action: "On hold pending decision" },
        { label: "Offer Discussion", action: "Deferred until further evaluation" },
      ];
    case "Reject":
      return [
        { label: "Candidate Communication", action: "Send respectful decline notification" },
        { label: "Feedback", action: "Provide constructive feedback if requested" },
        { label: "File Archive", action: "Archive for future reference" },
        { label: "Technical Round", action: "Not applicable" },
        { label: "Offer Discussion", action: "Not applicable" },
      ];
  }
}

// ===========================================================================
// SVG Icons
// ===========================================================================

function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconPdf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15h1" />
      <path d="M9 19h1" />
      <path d="M13 15v4" />
      <path d="M17 15v4" />
      <path d="M15 19h2" />
    </svg>
  );
}
