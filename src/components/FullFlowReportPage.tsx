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
  type StoredProctoringFlag,
} from "../lib/fullFlowStorage";
import { computeScoring, type EvaluationReport, type ComputedScoring } from "../lib/report-generator";
import type { CodeEvaluation } from "../lib/coding-test";
import { BoltIcon } from "./AppLogo";

function scoreClr(score: number): string {
  if (score >= 7) return "var(--accent-green)";
  if (score >= 5) return "var(--accent-amber)";
  return "var(--accent-red)";
}

function getNextSteps(recommendation: ComputedScoring["recommendation"]): { label: string; action: string }[] {
  switch (recommendation) {
    case "Strong Hire":
      return [
        { label: "HR Review", action: "Ready for immediate processing" },
        { label: "Offer Discussion", action: "Recommended within 48 hours" },
        { label: "Background Verification", action: "Initiate standard verification" },
      ];
    case "Hire":
      return [
        { label: "Technical Round", action: "Additional technical assessment recommended" },
        { label: "Managerial Round", action: "Schedule with hiring manager" },
        { label: "HR Review", action: "Proceed to standard review" },
      ];
    case "Consider":
      return [
        { label: "Additional Interview", action: "Further evaluation required" },
        { label: "Skill Assessment", action: "Targeted assessment for identified gaps" },
        { label: "Review Meeting", action: "Team discussion recommended" },
      ];
    case "Reject":
      return [
        { label: "Candidate Communication", action: "Send respectful decline notification" },
        { label: "Feedback", action: "Provide constructive feedback if requested" },
      ];
  }
}

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
            <ProctoringSection session={session} />
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
// Proctoring & integrity (all stages)
// ---------------------------------------------------------------------------
function ProctoringSection({ session }: { session: FullFlowReportSession }) {
  const hasAptitudeFlags = session.aptitude?.proctoringFlags?.length;
  const hasAptitudeRisk = session.aptitude?.riskScore != null && session.aptitude.riskScore > 0;
  const hasCodingFlags = session.coding?.proctoringFlags?.length;
  const hasCodingRisk = session.coding?.riskScore != null && session.coding.riskScore > 0;
  const hasAny = hasAptitudeFlags || hasAptitudeRisk || hasCodingFlags || hasCodingRisk;

  return (
    <section className="report-card full-flow-report__card">
      <div className="eval-section__header">
        <span className="eval-section__num">4</span>
        <h2 className="report-card__title">Proctoring &amp; Integrity</h2>
        {hasAny ? (
          <span className="eval-rec-badge eval-rec-badge--neutral">Issues recorded</span>
        ) : (
          <span className="eval-rec-badge eval-rec-badge--strong-hire">No issues</span>
        )}
      </div>
      {hasAny ? (
        <div className="eval-criteria">
          {session.aptitude && (hasAptitudeFlags || hasAptitudeRisk) && (
            <div className="full-flow-report__subsection" style={{ marginBottom: 16 }}>
              <h4 className="eval-sub__title">Aptitude Test</h4>
              {hasAptitudeRisk && (
                <div className="eval-criteria__row">
                  <span className="eval-criteria__label">Risk score</span>
                  <span className="eval-criteria__value">{session.aptitude.riskScore}/100</span>
                </div>
              )}
              {session.aptitude.proctoringFlags?.map((f: StoredProctoringFlag) => (
                <div key={f.id} className="eval-criteria__row" style={{ alignItems: "flex-start" }}>
                  <span className="eval-criteria__label">Issue</span>
                  <span className="eval-criteria__value">{f.message}</span>
                </div>
              ))}
            </div>
          )}
          {session.coding && (hasCodingFlags || hasCodingRisk) && (
            <div className="full-flow-report__subsection">
              <h4 className="eval-sub__title">Coding Challenge</h4>
              {hasCodingRisk && (
                <div className="eval-criteria__row">
                  <span className="eval-criteria__label">Risk score</span>
                  <span className="eval-criteria__value">{session.coding.riskScore}/100</span>
                </div>
              )}
              {session.coding.proctoringFlags?.map((f: StoredProctoringFlag) => (
                <div key={f.id} className="eval-criteria__row" style={{ alignItems: "flex-start" }}>
                  <span className="eval-criteria__label">Issue</span>
                  <span className="eval-criteria__value">{f.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="full-flow-report__subsection" style={{ marginTop: 8, opacity: 0.9 }}>
          No proctoring issues were recorded during the aptitude test or coding challenge.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Aptitude section (summary + full question breakdown when available)
// ---------------------------------------------------------------------------
function AptitudeSection({ result }: { result: FullFlowAptitudeResult }) {
  const [showFullReport, setShowFullReport] = useState(false);
  const hasBreakdown = result.quiz?.questions?.length && result.answers != null;

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

      {result.videoUrl && (
        <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
          <h4 className="eval-sub__title">Recording</h4>
          <div className="report-video-wrapper">
            <video className="report-video" src={result.videoUrl} controls playsInline />
          </div>
          <div className="report-video-actions">
            <a className="btn btn--download" href={result.videoUrl} download="aptitude-recording.webm">
              Download recording
            </a>
          </div>
        </div>
      )}

      {hasBreakdown && (
        <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="full-flow-report__toggle"
            onClick={() => setShowFullReport(!showFullReport)}
          >
            {showFullReport ? "Hide" : "Show"} full aptitude report (question breakdown)
          </button>
          {showFullReport && result.quiz && result.answers != null && (
            <div className="apt-breakdown" style={{ marginTop: 12 }}>
              {result.quiz.questions.map((q, idx) => {
                const selected = result.answers![q.id];
                const isCorrect = selected === q.correctIndex;
                return (
                  <div
                    key={q.id}
                    className={`apt-b-card ${isCorrect ? "apt-b-card--correct" : "apt-b-card--wrong"}`}
                  >
                    <div className="apt-b-header">
                      <span className="apt-b-num">{idx + 1}</span>
                      <span className={`apt-b-icon ${isCorrect ? "apt-b-icon--correct" : "apt-b-icon--wrong"}`}>
                        {isCorrect ? "✓" : "✗"}
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
                            <span className="apt-b-opt__marker">{String.fromCharCode(65 + oi)}</span>
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
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Interview section (summary + full 20-section report)
// ---------------------------------------------------------------------------
function InterviewSection({ result }: { result: FullFlowInterviewResult }) {
  const [showFull20Section, setShowFull20Section] = useState(false);
  const report = result.report as EvaluationReport | null | undefined;
  const hasFullReport = report && typeof report === "object" && "technicalSkills" in report;
  const scoring = useMemo(() => {
    if (!hasFullReport || !report) return null;
    return computeScoring(report as EvaluationReport);
  }, [hasFullReport, report]);

  const duration = useMemo(() => {
    if (result.transcript.length < 2) return "—";
    const first = result.transcript[0]?.timestamp ?? 0;
    const last = result.transcript[result.transcript.length - 1]?.timestamp ?? 0;
    const mins = Math.round((last - first) / 60000);
    if (mins < 1) return "Less than 1 minute";
    return mins === 1 ? "1 minute" : `${mins} minutes`;
  }, [result.transcript]);

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

      {result.report && typeof result.report === "object" && "strengths" in result.report
        ? (
        <div className="full-flow-report__subsection">
          <h4 className="eval-sub__title">Strengths</h4>
          <ul className="report-list report-list--green">
            {(result.report as EvaluationReport).strengths.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        )
        : null}

      {result.videoUrl && (
        <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
          <h4 className="eval-sub__title">Recording</h4>
          <div className="report-video-wrapper">
            <video className="report-video" src={result.videoUrl} controls playsInline />
          </div>
          <div className="report-video-actions">
            <a className="btn btn--download" href={result.videoUrl} download="interview-recording.webm">
              Download recording
            </a>
          </div>
        </div>
      )}

      {hasFullReport && report && scoring && (
        <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="full-flow-report__toggle"
            onClick={() => setShowFull20Section(!showFull20Section)}
          >
            {showFull20Section ? "Hide" : "Show"} full 20-section AI interview report
          </button>
          {showFull20Section && (
            <div className="full-flow-report__nested-sections" style={{ marginTop: 16 }}>
              <FullInterviewReportSections report={report as EvaluationReport} scoring={scoring} duration={duration} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Full 20-section AI interview report (nested in Interview section)
// ---------------------------------------------------------------------------
function FullInterviewReportSections({
  report,
  scoring,
  duration,
}: {
  report: EvaluationReport;
  scoring: ComputedScoring;
  duration: string;
}) {
  const interviewDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const nextSteps = getNextSteps(scoring.recommendation);

  return (
    <>
      <ReportSectionCard n={1} title="Candidate Information">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Full Name" value={report.candidateInfo.fullName} />
          <ReportCriteriaRow label="Position Applied For" value={report.candidateInfo.positionAppliedFor} />
          <ReportCriteriaRow label="Interview Date" value={interviewDate} />
          <ReportCriteriaRow label="Interview Mode" value="AI Voice Interview" />
          <ReportCriteriaRow label="Interview Duration" value={duration} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={2} title="Interview Overview">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Interview Objective" value={report.interviewOverview.objective} />
          <ReportCriteriaRow label="Job Role Summary" value={report.interviewOverview.jobRoleSummary} />
          <ReportCriteriaRow label="Evaluation Criteria" value={report.interviewOverview.evaluationCriteria} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={14} title="Performance Summary">
        <table className="eval-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Score (0-10)</th>
            </tr>
          </thead>
          <tbody>
            <ReportScoreRow label="Technical Skills" score={report.technicalSkills.score} />
            <ReportScoreRow label="Communication" score={report.communication.score} />
            <ReportScoreRow label="Analytical Thinking" score={report.analyticalThinking.score} />
            <ReportScoreRow label="Behavioral Traits" score={report.behavioral.score} />
            <ReportScoreRow label="Domain Knowledge" score={report.domainKnowledge.score} />
            <ReportScoreRow label="Cultural Fit" score={report.culturalFit.score} />
            <ReportScoreRow label="Motivation" score={report.workEthic.score} />
            <tr className="eval-table__total">
              <td>Overall Score</td>
              <td className="eval-table__score" style={{ color: scoreClr(scoring.overallScore) }}>
                {scoring.overallScore}
              </td>
            </tr>
          </tbody>
        </table>
      </ReportSectionCard>
      <ReportSectionCard n={3} title="Technical Skills Assessment" score={report.technicalSkills.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Core Technical Knowledge" value={report.technicalSkills.coreKnowledge} />
          <ReportCriteriaRow label="Tool/Technology Proficiency" value={report.technicalSkills.toolProficiency} />
          <ReportCriteriaRow label="Problem-Solving Ability" value={report.technicalSkills.problemSolving} />
          <ReportCriteriaRow label="Coding/Practical Skills" value={report.technicalSkills.codingSkills} />
          <ReportCriteriaRow label="System Design Understanding" value={report.technicalSkills.systemDesign} />
          <ReportCriteriaRow label="Accuracy Level" value={report.technicalSkills.accuracyLevel} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={4} title="Communication Skills" score={report.communication.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Verbal Clarity" value={report.communication.verbalClarity} />
          <ReportCriteriaRow label="Language Proficiency" value={report.communication.languageProficiency} />
          <ReportCriteriaRow label="Listening Ability" value={report.communication.listeningAbility} />
          <ReportCriteriaRow label="Explanation Quality" value={report.communication.explanationQuality} />
          <ReportCriteriaRow label="Confidence Level" value={report.communication.confidenceLevel} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={5} title="Analytical & Critical Thinking" score={report.analyticalThinking.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Logical Reasoning" value={report.analyticalThinking.logicalReasoning} />
          <ReportCriteriaRow label="Decision-Making Ability" value={report.analyticalThinking.decisionMaking} />
          <ReportCriteriaRow label="Data Interpretation" value={report.analyticalThinking.dataInterpretation} />
          <ReportCriteriaRow label="Case/Scenario Handling" value={report.analyticalThinking.scenarioHandling} />
          <ReportCriteriaRow label="Innovation & Creativity" value={report.analyticalThinking.innovationCreativity} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={6} title="Behavioral & Personality Assessment" score={report.behavioral.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Professional Attitude" value={report.behavioral.professionalAttitude} />
          <ReportCriteriaRow label="Emotional Intelligence" value={report.behavioral.emotionalIntelligence} />
          <ReportCriteriaRow label="Adaptability" value={report.behavioral.adaptability} />
          <ReportCriteriaRow label="Integrity & Ethics" value={report.behavioral.integrityEthics} />
          <ReportCriteriaRow label="Stress Management" value={report.behavioral.stressManagement} />
          <ReportCriteriaRow label="Leadership Traits" value={report.behavioral.leadershipTraits} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={7} title="Domain Knowledge" score={report.domainKnowledge.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Industry Awareness" value={report.domainKnowledge.industryAwareness} />
          <ReportCriteriaRow label="Role-Specific Expertise" value={report.domainKnowledge.roleExpertise} />
          <ReportCriteriaRow label="Market/Trend Understanding" value={report.domainKnowledge.marketTrends} />
          <ReportCriteriaRow label="Compliance & Standards" value={report.domainKnowledge.complianceKnowledge} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={8} title="Work Ethic & Motivation" score={report.workEthic.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Career Goals Alignment" value={report.workEthic.careerGoalsAlignment} />
          <ReportCriteriaRow label="Initiative" value={report.workEthic.initiative} />
          <ReportCriteriaRow label="Commitment Level" value={report.workEthic.commitmentLevel} />
          <ReportCriteriaRow label="Learning Ability" value={report.workEthic.learningAbility} />
          <ReportCriteriaRow label="Growth Mindset" value={report.workEthic.growthMindset} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={9} title="Cultural Fit Assessment" score={report.culturalFit.score}>
        <div className="eval-criteria">
          <ReportCriteriaRow label="Team Compatibility" value={report.culturalFit.teamCompatibility} />
          <ReportCriteriaRow label="Organizational Values Match" value={report.culturalFit.valuesMatch} />
          <ReportCriteriaRow label="Diversity & Inclusion" value={report.culturalFit.diversityAwareness} />
          <ReportCriteriaRow label="Collaboration Skills" value={report.culturalFit.collaborationSkills} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={10} title="AI Observations">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Speech Pattern Analysis" value={report.aiObservations.speechPatterns} />
          <ReportCriteriaRow label="Response Consistency" value={report.aiObservations.responseConsistency} />
          <ReportCriteriaRow label="Emotional Indicators" value={report.aiObservations.emotionalIndicators} />
          <ReportCriteriaRow label="Engagement Level" value={report.aiObservations.engagementLevel} />
          <ReportCriteriaRow label="Stress Indicators" value={report.aiObservations.stressIndicators} />
          <ReportCriteriaRow label="Authenticity Score" value={report.aiObservations.authenticityScore} />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={11} title="Strengths Identified" variant="green">
        <ul className="report-list report-list--green">
          {report.strengths.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </ReportSectionCard>
      <ReportSectionCard n={12} title="Areas for Improvement" variant="amber">
        <ul className="report-list report-list--amber">
          {report.improvements.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </ReportSectionCard>
      <ReportSectionCard n={13} title="Risk & Red Flag Analysis" variant="red">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Behavioral Concerns" value={report.riskAnalysis.behavioralConcerns} />
          <ReportCriteriaRow label="Skill Gaps" value={report.riskAnalysis.skillGaps} />
          <ReportCriteriaRow label="Integrity Issues" value={report.riskAnalysis.integrityIssues} />
          <ReportCriteriaRow label="Performance Risks" value={report.riskAnalysis.performanceRisks} />
          <ReportCriteriaRow label="Reliability Risks" value={report.riskAnalysis.reliabilityRisks} />
        </div>
        <div className="eval-redflag-score">
          Red Flag Severity:{" "}
          <span style={{ color: report.riskAnalysis.redFlagScore > 4 ? "var(--accent-red)" : "var(--accent-green)" }}>
            {report.riskAnalysis.redFlagScore}/10
          </span>
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={"14A"} title="Automated Scoring Breakdown">
        <div className="eval-formula">
          <div className="eval-formula__row">
            <span className="eval-formula__label">Weighted Base Score</span>
            <span className="eval-formula__value">{scoring.baseScore}</span>
          </div>
          <div className="eval-formula__row">
            <span className="eval-formula__label">Red Flag Penalty</span>
            <span className="eval-formula__value" style={{ color: "var(--accent-red)" }}>-{scoring.penalty}</span>
          </div>
          <div className="eval-formula__row">
            <span className="eval-formula__label">Confidence Factor</span>
            <span className="eval-formula__value">×{scoring.confidenceFactor}</span>
          </div>
          <div className="eval-formula__row eval-formula__row--total">
            <span className="eval-formula__label">Final Overall Score</span>
            <span className="eval-formula__value" style={{ color: scoreClr(scoring.overallScore) }}>
              {scoring.overallScore} / 10 ({scoring.overallPercent}%)
            </span>
          </div>
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={15} title="AI Confidence Level">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Data Completeness" value={report.aiConfidence.dataCompleteness} />
          <ReportCriteriaRow label="Prediction Reliability" value={report.aiConfidence.predictionReliability} />
          <ReportCriteriaRow label="Bias Risk Assessment" value={report.aiConfidence.biasRisk} />
        </div>
        <div className="eval-confidence-badge">
          Confidence Level:{" "}
          <span className={`eval-confidence-pill eval-confidence-pill--${scoring.confidenceLevel.toLowerCase()}`}>
            {scoring.confidenceLevel}
          </span>
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={16} title="Recommendation">
        <div className="eval-rec-grid">
          <div className="eval-rec-item">
            <span className="eval-rec-label">Hiring Decision</span>
            <span className={`eval-rec-badge eval-rec-badge--${scoring.recommendation.toLowerCase().replace(" ", "-")}`}>
              {scoring.recommendation}
            </span>
          </div>
          <div className="eval-rec-item">
            <span className="eval-rec-label">Suitable Role Level</span>
            <span className="eval-rec-badge eval-rec-badge--neutral">{scoring.roleLevel}</span>
          </div>
          <div className="eval-rec-item">
            <span className="eval-rec-label">Training Required</span>
            <span className="eval-rec-badge eval-rec-badge--neutral">{scoring.trainingRequirement}</span>
          </div>
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={17} title="Next Steps">
        <div className="eval-criteria">
          {nextSteps.map((step, i) => (
            <ReportCriteriaRow key={i} label={step.label} value={step.action} />
          ))}
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={18} title="Interview Transcript Summary">
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
      </ReportSectionCard>
      <ReportSectionCard n={19} title="Ethical & Compliance Check">
        <div className="eval-criteria">
          <ReportCriteriaRow label="Data Privacy Compliance" value="AI analysis conducted via API with encryption in transit." />
          <ReportCriteriaRow label="Bias Mitigation" value="Standardized evaluation criteria applied uniformly." />
        </div>
      </ReportSectionCard>
      <ReportSectionCard n={20} title="Final Remarks">
        <p className="report-card__body">{report.finalRemarks}</p>
      </ReportSectionCard>
    </>
  );
}

function ReportSectionCard({
  n,
  title,
  children,
  variant,
  score,
}: {
  n: number | string;
  title: string;
  children: React.ReactNode;
  variant?: "green" | "amber" | "red";
  score?: number;
}) {
  const variantClass = variant ? ` report-card--${variant}` : "";
  return (
    <section className={`report-card full-flow-report__nested-card${variantClass}`}>
      <div className="eval-section__header">
        <span className="eval-section__num">{n}</span>
        <h3 className="report-card__title">{title}</h3>
        {score != null && (
          <span className="eval-table__score" style={{ color: scoreClr(score) }}>
            {score}/10
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function ReportCriteriaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="eval-criteria__row">
      <span className="eval-criteria__label">{label}</span>
      <span className="eval-criteria__value">{value}</span>
    </div>
  );
}

function ReportScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <tr>
      <td>{label}</td>
      <td className="eval-table__score" style={{ color: scoreClr(score) }}>
        {score}
      </td>
    </tr>
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
// Coding section (summary + full report: categories + optimized solution)
// ---------------------------------------------------------------------------
function CodingSection({ result }: { result: FullFlowCodingResult }) {
  const [showFullReport, setShowFullReport] = useState(false);
  const ev = result.evaluation as CodeEvaluation | null | undefined;
  const hasCategories = ev?.categories != null;
  const hasOptimized = ev?.optimizedSolution != null && ev.optimizedSolution.trim().length > 0;

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

      {result.videoUrl && (
        <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
          <h4 className="eval-sub__title">Recording</h4>
          <div className="report-video-wrapper">
            <video className="report-video" src={result.videoUrl} controls playsInline />
          </div>
          <div className="report-video-actions">
            <a className="btn btn--download" href={result.videoUrl} download="coding-recording.webm">
              Download recording
            </a>
          </div>
        </div>
      )}

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

          {(hasCategories || hasOptimized) && (
            <div className="full-flow-report__subsection" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="full-flow-report__toggle"
                onClick={() => setShowFullReport(!showFullReport)}
              >
                {showFullReport ? "Hide" : "Show"} full coding report
              </button>
              {showFullReport && (
                <div className="full-flow-report__nested-sections" style={{ marginTop: 12 }}>
                  {hasCategories && ev.categories && (
                    <div className="eval-criteria" style={{ marginBottom: 16 }}>
                      <h4 className="eval-sub__title">Category Scores &amp; Feedback</h4>
                      <div className="full-flow-report__subsection">
                        <div className="eval-criteria__row">
                          <span className="eval-criteria__label">Correctness</span>
                          <span className="eval-criteria__value">
                            {ev.categories.correctness.score}/100 — {ev.categories.correctness.feedback}
                          </span>
                        </div>
                        <div className="eval-criteria__row">
                          <span className="eval-criteria__label">Code Quality</span>
                          <span className="eval-criteria__value">
                            {ev.categories.codeQuality.score}/100 — {ev.categories.codeQuality.feedback}
                          </span>
                        </div>
                        <div className="eval-criteria__row">
                          <span className="eval-criteria__label">Efficiency</span>
                          <span className="eval-criteria__value">
                            {ev.categories.efficiency.score}/100 — {ev.categories.efficiency.feedback}
                          </span>
                        </div>
                        <div className="eval-criteria__row">
                          <span className="eval-criteria__label">Edge Cases</span>
                          <span className="eval-criteria__value">
                            {ev.categories.edgeCases.score}/100 — {ev.categories.edgeCases.feedback}
                          </span>
                        </div>
                        <div className="eval-criteria__row">
                          <span className="eval-criteria__label">Style</span>
                          <span className="eval-criteria__value">
                            {ev.categories.style.score}/100 — {ev.categories.style.feedback}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {hasOptimized && (
                    <div className="full-flow-report__subsection">
                      <h4 className="eval-sub__title">Optimized Solution</h4>
                      <pre className="full-flow-report__code" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                        {ev.optimizedSolution}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
