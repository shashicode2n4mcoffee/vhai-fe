/**
 * AptitudeTest — Full aptitude test flow in a single component.
 *
 * Phases:
 *  1. Setup   — User enters topic, selects difficulty & question count
 *  2. Loading — Generating questions via single API call
 *  3. Quiz    — User answers MCQs
 *  4. Results — Client-side scored results with explanations
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  generateQuiz,
  evaluateQuiz,
  type AptitudeQuiz,
  type AptitudeResult,
} from "../lib/aptitude";
import { useToast } from "./Toast";
import { useCreateAptitudeMutation, useUpdateAptitudeMutation } from "../store/endpoints/aptitude";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

type Phase = "setup" | "loading" | "quiz" | "results";
type Difficulty = "Easy" | "Medium" | "Hard" | "Mixed";

const RS_AGGARWAL_TOPIC = "R.S. Aggarwal Quantitative Aptitude (Number System, HCF-LCM, Simplification, Surds, Percentages, Profit & Loss, SI-CI, Ratio, Partnership, Averages, Ages, Time & Work, Pipes, Time Speed Distance, Boats, Mixture & Alligation, Algebra, Linear/Quadratic Equations, Inequalities, AP-GP, Geometry, Mensuration, Trigonometry, Heights & Distances, Data Interpretation, Data Sufficiency, Statistics, P&C, Probability, Sets, Logarithms, Functions, Matrices, Complex Numbers)";
const QUIZ_TIME_LIMIT_MS = 25 * 60 * 1000; // 25 minutes

function formatTimer(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function AptitudeTest() {
  const navigate = useNavigate();
  const [createAptitude] = useCreateAptitudeMutation();
  const [updateAptitude] = useUpdateAptitudeMutation();
  // Setup state
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Mixed");
  const [questionCount, setQuestionCount] = useState(20);

  // Quiz state
  const [phase, setPhase] = useState<Phase>("setup");
  const [quiz, setQuiz] = useState<AptitudeQuiz | null>(null);
  const [aptitudeId, setAptitudeId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<AptitudeResult | null>(null);
  const [error, setError] = useState("");
  const toast = useToast();

  // Timer state
  const [remainingMs, setRemainingMs] = useState(QUIZ_TIME_LIMIT_MS);
  const quizStartRef = useRef(0);
  const autoSubmittedRef = useRef(false);

  // ---- Generate quiz ----
  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setError("");
    setPhase("loading");
    const tid = toast.loading("Generating questions...");
    try {
      const q = await generateQuiz(topic.trim(), questionCount, difficulty);
      setQuiz(q);
      setAnswers({});
      // Reset timer
      quizStartRef.current = Date.now();
      autoSubmittedRef.current = false;
      setRemainingMs(QUIZ_TIME_LIMIT_MS);

      // Save to backend (topic max 500 chars, difficulty: Easy | Medium | Hard | Mixed)
      const topicForApi = topic.trim().slice(0, 500);
      const created = await createAptitude({
        topic: topicForApi,
        difficulty,
        quiz: q,
        total: q.questions.length,
      }).unwrap();
      setAptitudeId(created.id);

      setPhase("quiz");
      toast.update(tid, "success", `${q.questions.length} questions ready!`);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      if (status === 402) {
        toast.error("No aptitude credits. Purchase a plan to continue.");
        setTimeout(() => navigate("/billing"), 1500);
        setPhase("setup");
        toast.update(tid, "error", "No credits");
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to generate quiz";
      setError(msg);
      setPhase("setup");
      toast.update(tid, "error", msg);
      logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "aptitude" });
    }
  };

  // ---- Select answer ----
  const handleSelect = (questionId: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  // ---- Submit & evaluate (client-side) ----
  const handleSubmit = async () => {
    if (!quiz) return;
    const res = evaluateQuiz(quiz, answers);
    setResult(res);
    setPhase("results");

    if (res.passed) {
      toast.success(`Passed! You scored ${res.percentage}%`);
    } else {
      toast.error(`Scored ${res.percentage}% — need 60% to pass`);
    }

    // Update backend
    if (aptitudeId) {
      try {
        await updateAptitude({
          id: aptitudeId,
          data: {
            answers: Object.fromEntries(
              Object.entries(res.answers).map(([k, v]) => [String(k), v]),
            ),
            score: res.score,
            percentage: res.percentage,
            passed: res.passed,
          },
        }).unwrap();
      } catch (err) {
        const msg = err && typeof err === "object" && "data" in err && (err as { data?: { error?: string } }).data?.error
          ? (err as { data: { error: string } }).data.error
          : err instanceof Error ? err.message : "Failed to save results";
        toast.error(msg);
        logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "aptitude" });
      }
    }
  };

  // ---- Auto-submit when time runs out ----
  const handleAutoSubmit = useCallback(() => {
    if (!quiz || autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    toast.error("Time's up! Your answers have been auto-submitted.");
    // Trigger same logic as manual submit
    const res = evaluateQuiz(quiz, answers);
    setResult(res);
    setPhase("results");

    if (aptitudeId) {
      updateAptitude({
        id: aptitudeId,
        data: {
          answers: Object.fromEntries(
            Object.entries(res.answers).map(([k, v]) => [String(k), v]),
          ),
          score: res.score,
          percentage: res.percentage,
          passed: res.passed,
        },
      }).catch(() => {});
    }
  }, [quiz, answers, aptitudeId, toast, updateAptitude]);

  // Timer countdown during quiz phase
  useEffect(() => {
    if (phase !== "quiz") return;
    if (quizStartRef.current === 0) quizStartRef.current = Date.now();

    const id = setInterval(() => {
      const elapsed = Date.now() - quizStartRef.current;
      const remaining = QUIZ_TIME_LIMIT_MS - elapsed;
      setRemainingMs(remaining);

      if (remaining <= 0) {
        clearInterval(id);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [phase, handleAutoSubmit]);

  // ---- Retake ----
  const handleRetake = () => {
    setQuiz(null);
    setAptitudeId(null);
    setAnswers({});
    setResult(null);
    setRemainingMs(QUIZ_TIME_LIMIT_MS);
    quizStartRef.current = 0;
    autoSubmittedRef.current = false;
    setPhase("setup");
  };

  // ===========================================================================
  // SETUP PHASE
  // ===========================================================================
  if (phase === "setup") {
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
          </div>
        </header>
        <div className="dash__content">
          <div className="dash__welcome">
            <h1 className="dash__welcome-title">Aptitude Test</h1>
            <p className="dash__welcome-sub">
              Enter a topic and we'll generate an MCQ quiz for you.
            </p>
          </div>
          <div className="apt-setup">
            {/* Quick preset */}
            <div className="apt-preset-bar">
              <button
                className={`apt-preset-btn ${topic === RS_AGGARWAL_TOPIC ? "apt-preset-btn--active" : ""}`}
                onClick={() => {
                  setTopic(RS_AGGARWAL_TOPIC);
                  setQuestionCount(20);
                  setDifficulty("Mixed");
                }}
              >
                <BookIcon /> R.S. Aggarwal — 20 Qs (8 Easy + 8 Med + 4 Hard)
              </button>
            </div>

            <div className="apt-field">
              <label className="apt-label">What do you want to test?</label>
              <textarea
                className="apt-textarea"
                rows={3}
                placeholder="e.g. R.S. Aggarwal Quantitative Aptitude, Data Interpretation, Geometry & Mensuration..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div className="apt-row">
              <div className="apt-field apt-field--half">
                <label className="apt-label">Difficulty</label>
                <div className="apt-pills">
                  {(["Easy", "Medium", "Hard", "Mixed"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      className={`apt-pill ${difficulty === d ? "apt-pill--active" : ""}`}
                      onClick={() => setDifficulty(d)}
                    >
                      {d === "Mixed" ? "Mixed (8E+8M+4H)" : d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="apt-field apt-field--half">
                <label className="apt-label">Questions</label>
                <div className="apt-pills">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      className={`apt-pill ${questionCount === n ? "apt-pill--active" : ""}`}
                      onClick={() => setQuestionCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Timer info */}
            <div className="apt-timer-info">
              <ClockIcon /> You will have <strong>25 minutes</strong> to complete the quiz. Auto-submits when time runs out.
            </div>

            {error && <div className="apt-error">{error}</div>}

            <button
              className="btn btn--primary apt-generate"
              disabled={!topic.trim()}
              onClick={() => void handleGenerate()}
            >
              Generate Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // LOADING PHASE
  // ===========================================================================
  if (phase === "loading") {
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
          </div>
        </header>
        <div className="dash__content">
        <div className="apt-loading">
          <div className="report-loading__spinner" />
          <h2 className="apt-loading__title">Generating Questions</h2>
          <p className="apt-loading__sub">
            Creating {questionCount} {difficulty.toLowerCase()} questions on "{topic}"...
          </p>
        </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // QUIZ PHASE
  // ===========================================================================
  if (phase === "quiz" && quiz) {
    const answeredCount = Object.keys(answers).length;
    const allAnswered = answeredCount === quiz.questions.length;

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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
          </div>
        </header>
        <div className="dash__content">
        <div className="apt-wrapper">
          {/* Header with timer */}
          <div className="apt-quiz-header">
            <div className="apt-quiz-header__left">
              <h1 className="apt-quiz-title">{quiz.title}</h1>
              <div className="apt-quiz-meta">
                <span className="apt-quiz-badge">{difficulty === "Mixed" ? "Mixed" : difficulty}</span>
                <span className="apt-quiz-progress">
                  {answeredCount}/{quiz.questions.length} answered
                </span>
              </div>
            </div>
            <div className={`apt-quiz-timer ${remainingMs <= 5 * 60 * 1000 ? "apt-quiz-timer--warning" : ""} ${remainingMs <= 2 * 60 * 1000 ? "apt-quiz-timer--danger" : ""}`}>
              <ClockIcon />
              <span className="apt-quiz-timer__value">{formatTimer(remainingMs)}</span>
              <span className="apt-quiz-timer__label">/ 25:00</span>
            </div>
          </div>

          {/* Questions */}
          <div className="apt-questions">
            {quiz.questions.map((q, idx) => (
              <div key={q.id} className="apt-q-card">
                <div className="apt-q-num">{idx + 1}</div>
                <p className="apt-q-text">{q.question}</p>
                <div className="apt-q-options">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`apt-q-option ${answers[q.id] === oi ? "apt-q-option--selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === oi}
                        onChange={() => handleSelect(q.id, oi)}
                      />
                      <span className="apt-q-option__marker">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span className="apt-q-option__text">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Submit */}
          <div className="apt-actions">
            <button type="button" className="dash__topbar-btn" onClick={handleRetake}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              Submit Answers ({answeredCount}/{quiz.questions.length})
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RESULTS PHASE
  // ===========================================================================
  if (phase === "results" && result) {
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
          </div>
        </header>
        <div className="dash__content">
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
            <button className="btn btn--primary" onClick={handleRetake}>
              Take Another Test
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return null;
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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={sw}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        fontSize="28"
        fontWeight="800"
        fontFamily="inherit"
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
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1" />
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1" />
      <path d="M12 22v-6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}
