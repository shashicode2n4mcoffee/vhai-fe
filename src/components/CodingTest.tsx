/**
 * CodingTest — Full online coding assessment with Monaco Editor.
 *
 * Phases:
 *   1. Setup      — Choose topic, language, difficulty
 *   2. Loading    — AI generates the coding problem
 *   3. Editor     — Solve the problem (Monaco + problem panel + timer, proctored)
 *   4. Evaluating — AI reviews submitted code
 *   5. Results    — Detailed skill rating with category breakdown
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  generateCodingProblem,
  evaluateCode,
  LANGUAGE_CONFIG,
  type CodingProblem,
  type CodingLanguage,
  type CodingDifficulty,
  type CodeEvaluation,
} from "../lib/coding-test";
import { CodeTerminal } from "./CodeTerminal";
import { useToast } from "./Toast";
import { logErrorToServer } from "../lib/logError";
import { useCreateCodingMutation, useUpdateCodingMutation } from "../store/endpoints/coding";
import { BoltIcon } from "./AppLogo";
import { useProctoring } from "../proctoring/useProctoring";
import { MalpracticeOverlay, type MalpracticeKind } from "./MalpracticeOverlay";
import { saveFullFlowCoding } from "../lib/fullFlowStorage";

type Phase = "setup" | "loading" | "editor" | "evaluating" | "results";

const LANGUAGES = Object.entries(LANGUAGE_CONFIG) as [CodingLanguage, (typeof LANGUAGE_CONFIG)[CodingLanguage]][];

/** Full flow: infer track from template name (Software, VLSI, MBA/Management, General). */
function getFullFlowTrack(templateName: string | undefined): "software" | "vlsi" | "mba" | "general" | null {
  if (!templateName) return null;
  const lower = templateName.toLowerCase();
  if (lower.startsWith("software:") || lower.startsWith("tech:")) return "software";
  if (lower.startsWith("mba:") || lower.startsWith("management:")) return "mba";
  if (lower.startsWith("vlsi:") || lower.startsWith("semiconductor:")) return "vlsi";
  if (lower.startsWith("general:")) return "general";
  if (/engineer|developer|devops|qa|cloud|cyber|architect|sre|ai\/ml|ui\/ux/i.test(lower)) return "software";
  if (/manager|analyst|consultant|marketing|hr |finance|operations|sales|product|strategy|supply|project/i.test(lower)) return "mba";
  if (/vlsi|physical design|verification|dft|analog|rtl/i.test(lower)) return "vlsi";
  return "general";
}

const FULL_FLOW_TOPIC_SOFTWARE = "Data Structures and Algorithms: arrays, strings, binary search, linked lists, stacks, queues, trees, graphs, dynamic programming; easy to medium level problems.";
const FULL_FLOW_TOPIC_VLSI_BASE = "RTL design and coding: combinational and sequential logic, finite state machines, basic timing and simulation. Platform: ";

export function CodingTest() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromFullFlow = (location.state as { fromFullFlow?: boolean } | null)?.fromFullFlow === true;
  const templateNameFromFlow = (location.state as { templateName?: string } | null)?.templateName;
  const fullFlowTrack = fromFullFlow && templateNameFromFlow ? getFullFlowTrack(templateNameFromFlow) : null;

  const toast = useToast();
  const [createCoding] = useCreateCodingMutation();
  const [updateCoding] = useUpdateCodingMutation();

  // Setup state
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<CodingLanguage>("javascript");
  const [difficulty, setDifficulty] = useState<CodingDifficulty>("Medium");
  const [vlsiPlatform, setVlsiPlatform] = useState<"Verilog" | "SystemVerilog" | "VHDL">("Verilog");

  // Editor state
  const [phase, setPhase] = useState<Phase>("setup");
  const [problem, setProblem] = useState<CodingProblem | null>(null);
  const [codingId, setCodingId] = useState<string | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0); // Max 3 (proctoring)
  const [code, setCode] = useState("");
  const [evaluation, setEvaluation] = useState<CodeEvaluation | null>(null);
  const [error, setError] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "examples" | "hints">("description");

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef(0);

  // Proctoring (editor phase): webcam + tab/window/fullscreen
  const videoRef = useRef<HTMLVideoElement>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [pendingMalpractice, setPendingMalpractice] = useState<MalpracticeKind | null>(null);
  const editorStartTsRef = useRef(0);
  const proctoring = useProctoring({
    enabled: phase === "editor" && !!webcamStream,
    videoRef,
    interviewStartTs: editorStartTsRef.current,
    fps: 3,
  });
  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) return true;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return !!document.fullscreenElement;
      }
    } catch {
      /* user denied or not supported */
    }
    return false;
  }, []);

  // Start timer
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // Refs for full-flow: auto-trigger generate once (no setup UI shown)
  const fullFlowAutoGenerateDoneRef = useRef(false);
  const handleGenerateRef = useRef<(() => Promise<void>) | null>(null);

  // Full flow: prefill topic and difficulty by track (skip topic question)
  useEffect(() => {
    if (!fromFullFlow || !fullFlowTrack) return;
    if (fullFlowTrack === "software" || fullFlowTrack === "general") {
      setTopic(FULL_FLOW_TOPIC_SOFTWARE);
      setDifficulty("Medium");
    } else if (fullFlowTrack === "vlsi") {
      setTopic(FULL_FLOW_TOPIC_VLSI_BASE + vlsiPlatform);
      setDifficulty("Medium");
    }
  }, [fromFullFlow, fullFlowTrack, vlsiPlatform]);


  // Request webcam when entering editor phase (for proctoring)
  useEffect(() => {
    if (phase !== "editor") return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s;
        setWebcamStream(s);
      })
      .catch(() => setWebcamStream(null));
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setWebcamStream(null);
    };
  }, [phase]);

  // Attach webcam stream to video element for proctoring
  useEffect(() => {
    const el = videoRef.current;
    if (el && webcamStream) el.srcObject = webcamStream;
    return () => {
      if (el) el.srcObject = null;
    };
  }, [webcamStream]);

  // Start proctoring when stream is ready and hook is ready (editor phase).
  // Omit proctoring.isRunning from deps to avoid loop: stop() -> setState -> effect re-run -> start() again.
  useEffect(() => {
    if (phase !== "editor" || !webcamStream || !proctoring.isReady || proctoring.isRunning) return;
    proctoring.start();
    return () => proctoring.stop();
  }, [phase, webcamStream, proctoring.isReady]);

  // Malpractice listeners: tab switch, window switch, fullscreen exit (editor phase)
  useEffect(() => {
    if (phase !== "editor") return;
    const tabWasHiddenRef = { current: false };
    const windowHadBlurRef = { current: false };
    const onVisibilityChange = () => {
      if (document.hidden) tabWasHiddenRef.current = true;
      else if (tabWasHiddenRef.current) {
        tabWasHiddenRef.current = false;
        setPendingMalpractice("tab_switch");
      }
    };
    const onBlur = () => {
      windowHadBlurRef.current = true;
    };
    const onFocus = () => {
      if (windowHadBlurRef.current) {
        windowHadBlurRef.current = false;
        setPendingMalpractice("window_switch");
      }
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setPendingMalpractice("fullscreen_exit");
      else setPendingMalpractice((prev) => (prev === "fullscreen_exit" ? null : prev));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [phase]);

  // ---- Generate problem ----
  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setError("");
    setPhase("loading");
    const tid = toast.loading("Generating coding challenge...");
    try {
      const p = await generateCodingProblem(topic.trim(), language, difficulty);
      setProblem(p);
      setCode(p.starterCode);
      setHintsRevealed(0);
      setActiveTab("description");

      // Save to backend
      const created = await createCoding({
        topic: topic.trim(),
        language,
        difficulty,
        problem: {
          ...p,
          language: p.language,
          difficulty: p.difficulty,
        },
      }).unwrap();
      setCodingId(created.id);
      setSubmissionCount((created as { submissionCount?: number }).submissionCount ?? 0);

      editorStartTsRef.current = Date.now();
      setPhase("editor");
      startTimer();
      toast.update(tid, "success", `"${p.title}" ready — good luck!`);
    } catch (err: unknown) {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      if (status === 402) {
        toast.error("No coding credits. Purchase a plan to continue.");
        setTimeout(() => navigate("/billing"), 1500);
        setPhase("setup");
        toast.update(tid, "error", "No credits");
        return;
      }
      const msg = err instanceof Error ? err.message : "Failed to generate problem";
      setError(msg);
      setPhase("setup");
      toast.update(tid, "error", msg);
      logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "coding" });
    }
  };
  handleGenerateRef.current = handleGenerate;

  // Full flow: auto-start challenge when topic is prefilled (no setup UI)
  useEffect(() => {
    if (
      phase !== "setup" ||
      !fromFullFlow ||
      !fullFlowTrack ||
      fullFlowTrack === "mba" ||
      !topic.trim() ||
      fullFlowAutoGenerateDoneRef.current
    )
      return;
    fullFlowAutoGenerateDoneRef.current = true;
    handleGenerateRef.current?.();
  }, [phase, fromFullFlow, fullFlowTrack, topic]);

  // ---- Submit code for evaluation ----
  const handleSubmit = async () => {
    if (!problem || !code.trim()) return;
    stopTimer();
    proctoring.stop();
    webcamStream?.getTracks().forEach((t) => t.stop());
    setWebcamStream(null);

    const timeSpent = elapsed;
    setPhase("evaluating");
    const tid = toast.loading("AI is reviewing your code...");
    try {
      const ev = await evaluateCode(problem, code, language, timeSpent);
      setEvaluation(ev);
      setPhase("results");

      if (fromFullFlow) {
        saveFullFlowCoding({
          score: ev.overallScore,
          verdict: ev.verdict,
          problemTitle: problem.title,
          language,
          difficulty: problem.difficulty,
          timeSpentSec: timeSpent,
          codingId: codingId ?? undefined,
          evaluation: ev,
        });
      }

      if (ev.overallScore >= 75) {
        toast.update(tid, "success", `${ev.verdict}! Score: ${ev.overallScore}/100`);
      } else {
        toast.update(tid, "info", `${ev.verdict} — Score: ${ev.overallScore}/100`);
      }

      // Update backend (including proctoring data); backend enforces max 3 submissions
      if (codingId) {
        try {
          const updated = await updateCoding({
            id: codingId,
            data: {
              userCode: code,
              evaluation: ev,
              score: ev.overallScore,
              verdict: ev.verdict,
              timeSpent,
              proctoringFlags: proctoring.flags.length ? proctoring.flags : undefined,
              riskScore: proctoring.riskScore > 0 ? proctoring.riskScore : undefined,
            },
          }).unwrap();
          setSubmissionCount((updated as { submissionCount?: number }).submissionCount ?? submissionCount + 1);
        } catch (saveErr) {
          const saveMsg = saveErr && typeof saveErr === "object" && "data" in saveErr && (saveErr as { data?: { error?: string } }).data?.error
            ? (saveErr as { data: { error: string } }).data.error
            : saveErr instanceof Error ? saveErr.message : "Failed to save results";
          toast.error(saveMsg);
          logErrorToServer(saveMsg, { details: saveErr instanceof Error ? saveErr.stack : undefined, source: "coding" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Evaluation failed";
      setPhase("editor");
      startTimer();
      toast.update(tid, "error", msg);
      logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "coding" });
    }
  };

  // ---- Retake (discard) ----
  const handleRetake = () => {
    stopTimer();
    proctoring.stop();
    webcamStream?.getTracks().forEach((t) => t.stop());
    setWebcamStream(null);
    setPendingMalpractice(null);
    setProblem(null);
    setCodingId(null);
    setSubmissionCount(0);
    setCode("");
    setEvaluation(null);
    setElapsed(0);
    setPhase("setup");
  };

  const maxSubmissions = 3;
  const canSubmitAgain = submissionCount < maxSubmissions;

  // ===========================================================================
  // FULL FLOW: MBA/Management — skip coding, go to full report
  // ===========================================================================
  if (fromFullFlow && fullFlowTrack === "mba") {
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
            <h1 className="dash__welcome-title">Coding Challenge</h1>
            <p className="dash__welcome-sub">
              Coding is not part of the assessment for this track (MBA/Management). Continue to your full report.
            </p>
          </div>
          <div className="code-setup" style={{ maxWidth: 480 }}>
            <p style={{ marginBottom: 24, opacity: 0.9 }}>
              Your aptitude and interview results are saved. Click below to view your complete full interview report.
            </p>
            <button
              className="btn btn--primary apt-generate"
              onClick={() => navigate("/interview/full/report")}
            >
              Continue to Full Report
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showTopicField = !fromFullFlow || (fullFlowTrack !== "software" && fullFlowTrack !== "vlsi" && fullFlowTrack !== "general");

  // ===========================================================================
  // SETUP PHASE
  // ===========================================================================
  if (phase === "setup") {
    // Full flow (non-MBA): do not show Topic/Language/Difficulty/Generate — auto-start with "Preparing..." only
    const fullFlowHideSetup = fromFullFlow && fullFlowTrack && fullFlowTrack !== "mba";
    if (fullFlowHideSetup) {
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
              <h1 className="dash__welcome-title">Coding Challenge</h1>
              <p className="dash__welcome-sub">Preparing your coding challenge…</p>
            </div>
            <div className="code-setup" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 32 }}>
              {!error && (
                <>
                  <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} aria-hidden />
                  <p style={{ margin: 0, opacity: 0.9 }}>Generating your problem based on your interview track.</p>
                </>
              )}
              {error && (
                <>
                  <div className="apt-error">{error}</div>
                  <button type="button" className="btn btn--primary" onClick={() => { setError(""); void handleGenerate(); }}>
                    Try again
                  </button>
                </>
              )}
            </div>
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
          </div>
        </header>
        <div className="dash__content">
          <div className="dash__welcome">
            <h1 className="dash__welcome-title">Coding Challenge</h1>
            <p className="dash__welcome-sub">
              {templateNameFromFlow ? (
                <>Final step of the full interview flow (template: {templateNameFromFlow}). Get an AI-generated coding problem, solve it, and receive a detailed skill evaluation.</>
              ) : (
                <>Get an AI-generated coding problem, solve it in a professional editor, and receive a detailed skill evaluation.</>
              )}
            </p>
          </div>
          <div className="code-setup">
            {showTopicField ? (
              <div className="apt-field">
                <label className="apt-label">What topic should we test?</label>
                <textarea
                  className="apt-textarea"
                  rows={3}
                  placeholder="e.g. Array manipulation, Binary search, Linked lists, Dynamic programming, String algorithms, Graph traversal..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>
            ) : fullFlowTrack === "software" || fullFlowTrack === "general" ? (
              <div className="apt-field">
                <label className="apt-label">Topic</label>
                <p className="apt-textarea" style={{ padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, margin: 0 }}>
                  Data Structures &amp; Algorithms (Easy–Medium)
                </p>
              </div>
            ) : fullFlowTrack === "vlsi" ? (
              <>
                <div className="apt-field">
                  <label className="apt-label">Platform</label>
                  <div className="apt-pills">
                    {(["Verilog", "SystemVerilog", "VHDL"] as const).map((p) => (
                      <button
                        key={p}
                        className={`apt-pill ${vlsiPlatform === p ? "apt-pill--active" : ""}`}
                        onClick={() => setVlsiPlatform(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="apt-field">
                  <label className="apt-label">Topic</label>
                  <p className="apt-textarea" style={{ padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, margin: 0 }}>
                    RTL design · {vlsiPlatform} · combinational &amp; sequential logic, FSM
                  </p>
                </div>
              </>
            ) : null}

            <div className="apt-field">
              <label className="apt-label">Language</label>
              <div className="code-lang-grid">
                {LANGUAGES.map(([key, cfg]) => (
                  <button
                    key={key}
                    className={`code-lang-btn ${language === key ? "code-lang-btn--active" : ""}`}
                    onClick={() => setLanguage(key)}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="apt-field">
              <label className="apt-label">Difficulty</label>
              <div className="apt-pills">
                {(["Easy", "Medium", "Hard"] as CodingDifficulty[]).map((d) => (
                  <button
                    key={d}
                    className={`apt-pill ${difficulty === d ? "apt-pill--active" : ""}`}
                    onClick={() => setDifficulty(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="apt-error">{error}</div>}

            <button
              className="btn btn--primary apt-generate"
              disabled={!topic.trim()}
              onClick={() => void handleGenerate()}
            >
              Generate Challenge
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
        <div className="code-loading">
          <div className="report-loading__spinner" />
          <h2 className="code-loading__title">Generating Challenge</h2>
          <p className="code-loading__sub">
            Creating a {difficulty.toLowerCase()} {LANGUAGE_CONFIG[language].label} problem on "{topic}"...
          </p>
          <button className="btn btn--ghost code-loading__back" onClick={() => { setPhase("setup"); }}>
            Cancel
          </button>
        </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // EDITOR PHASE
  // ===========================================================================
  if (phase === "editor" && problem) {
    return (
      <div className="dash code-page--editor">
        {/* Proctoring: hidden video for face detection; overlay on malpractice */}
        <video ref={videoRef} autoPlay playsInline muted className="code-proctoring-video" aria-hidden />
        {pendingMalpractice && (
          <MalpracticeOverlay
            kind={pendingMalpractice}
            onAcknowledge={() => {
              if (pendingMalpractice === "fullscreen_exit" && !document.fullscreenElement) return;
              setPendingMalpractice(null);
            }}
            onRequestFullscreen={requestFullscreen}
            isFullscreen={!!document.fullscreenElement}
          />
        )}
        <header className="dash__topbar">
          <button type="button" className="dash__brand" onClick={() => navigate("/dashboard")} title="Dashboard">
            <div className="dash__brand-icon">
              <BoltIcon />
            </div>
            <span className="dash__brand-name">VocalHireAI</span>
          </button>
          <div className="code-topbar__left" style={{ flex: 1, marginLeft: 16, gap: 12 }}>
            <span className="code-topbar__title">{problem.title}</span>
            <span className={`code-topbar__diff code-topbar__diff--${difficulty.toLowerCase()}`}>
              {difficulty}
            </span>
            <span className="code-topbar__lang">{LANGUAGE_CONFIG[language].label}</span>
          </div>
          <div className="code-topbar__right">
            <span className="code-topbar__submissions" title="Max 3 submissions allowed">
              Submissions: {submissionCount}/{maxSubmissions}
            </span>
            <span className="code-topbar__timer">
              <TimerIcon />
              {formatTime(elapsed)}
            </span>
            <button className="btn btn--ghost" onClick={handleRetake}>
              Discard
            </button>
            <button
              className="btn btn--primary code-topbar__submit"
              disabled={!code.trim() || code === problem.starterCode || submissionCount >= maxSubmissions}
              onClick={() => void handleSubmit()}
              title={submissionCount >= maxSubmissions ? "Max 3 submissions used" : undefined}
            >
              Submit Solution
            </button>
          </div>
        </header>

        {/* Split: Problem panel | Editor */}
        <div className="code-split">
          {/* Problem panel */}
          <div className="code-problem">
            <div className="code-problem__tabs">
              <button
                className={`code-problem__tab ${activeTab === "description" ? "code-problem__tab--active" : ""}`}
                onClick={() => setActiveTab("description")}
              >
                Description
              </button>
              <button
                className={`code-problem__tab ${activeTab === "examples" ? "code-problem__tab--active" : ""}`}
                onClick={() => setActiveTab("examples")}
              >
                Examples
              </button>
              <button
                className={`code-problem__tab ${activeTab === "hints" ? "code-problem__tab--active" : ""}`}
                onClick={() => setActiveTab("hints")}
              >
                Hints {problem.hints.length > 0 && `(${hintsRevealed}/${problem.hints.length})`}
              </button>
            </div>

            <div className="code-problem__content">
              {activeTab === "description" && (
                <div className="code-desc">
                  <div className="code-desc__text">{problem.description}</div>
                  {problem.constraints.length > 0 && (
                    <>
                      <h4 className="code-desc__heading">Constraints</h4>
                      <ul className="code-desc__list">
                        {problem.constraints.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {problem.testCases.length > 0 && (
                    <>
                      <h4 className="code-desc__heading">Test Cases</h4>
                      <div className="code-test-cases">
                        {problem.testCases.map((tc, i) => (
                          <div key={i} className="code-tc">
                            <div className="code-tc__row">
                              <span className="code-tc__label">Input:</span>
                              <code className="code-tc__val">{tc.input}</code>
                            </div>
                            <div className="code-tc__row">
                              <span className="code-tc__label">Expected:</span>
                              <code className="code-tc__val">{tc.expectedOutput}</code>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "examples" && (
                <div className="code-examples">
                  {problem.examples.map((ex, i) => (
                    <div key={i} className="code-example">
                      <h4 className="code-example__title">Example {i + 1}</h4>
                      <div className="code-tc">
                        <div className="code-tc__row">
                          <span className="code-tc__label">Input:</span>
                          <code className="code-tc__val">{ex.input}</code>
                        </div>
                        <div className="code-tc__row">
                          <span className="code-tc__label">Output:</span>
                          <code className="code-tc__val">{ex.output}</code>
                        </div>
                      </div>
                      {ex.explanation && (
                        <p className="code-example__explain">{ex.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "hints" && (
                <div className="code-hints">
                  {problem.hints.length === 0 ? (
                    <p className="code-hints__empty">No hints available for this problem.</p>
                  ) : (
                    <>
                      {problem.hints.slice(0, hintsRevealed).map((h, i) => (
                        <div key={i} className="code-hint">
                          <span className="code-hint__num">Hint {i + 1}</span>
                          <p className="code-hint__text">{h}</p>
                        </div>
                      ))}
                      {hintsRevealed < problem.hints.length && (
                        <button
                          className="btn btn--ghost code-hint__reveal"
                          onClick={() => setHintsRevealed((p) => p + 1)}
                        >
                          Reveal Hint {hintsRevealed + 1} of {problem.hints.length}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Editor + Terminal vertical split */}
          <div className="code-editor-area">
            <div className="code-editor" title="Copy and paste are disabled during the assessment.">
              <Editor
                height="100%"
                language={LANGUAGE_CONFIG[language].monacoId}
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val ?? "")}
                onMount={(editor, monaco) => {
                  // Proctoring: disable copy and paste in coding round (addAction has id + run required by this Monaco version)
                  const noop = () => {};
                  editor.addAction({ id: "noop-paste", label: "", run: noop, keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, monaco.KeyMod.Shift | monaco.KeyCode.Insert] });
                  editor.addAction({ id: "noop-copy", label: "", run: noop, keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC] });
                  editor.onDidPaste(() => {
                    editor.trigger("keyboard", "undo", null);
                  });
                }}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                  fontLigatures: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  formatOnPaste: false,
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                  lineNumbers: "on",
                  renderLineHighlight: "all",
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  bracketPairColorization: { enabled: true },
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  contextmenu: false,
                }}
              />
            </div>
            <CodeTerminal
              code={code}
              language={language}
              testCases={problem.testCases}
            />
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // EVALUATING PHASE
  // ===========================================================================
  if (phase === "evaluating") {
    return (
      <div className="code-page">
        <div className="code-loading">
          <div className="report-loading__spinner" />
          <h2 className="code-loading__title">Evaluating Your Code</h2>
          <p className="code-loading__sub">
            AI is analyzing correctness, efficiency, code quality, and style...
          </p>
          <button className="btn btn--ghost code-loading__back" onClick={() => navigate("/dashboard")}>
            ← Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // RESULTS PHASE
  // ===========================================================================
  if (phase === "results" && evaluation && problem) {
    const cats = evaluation.categories;
    const categoryList: { key: string; label: string; data: { score: number; feedback: string } }[] = [
      { key: "correctness", label: "Correctness", data: cats.correctness },
      { key: "efficiency", label: "Efficiency", data: cats.efficiency },
      { key: "codeQuality", label: "Code Quality", data: cats.codeQuality },
      { key: "edgeCases", label: "Edge Cases", data: cats.edgeCases },
      { key: "style", label: "Code Style", data: cats.style },
    ];

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
        <div className="code-results-wrap">
          {/* Submissions used (max 3) */}
          <p className="code-results-submissions">
            Submissions used: {submissionCount}/{maxSubmissions}
            {canSubmitAgain && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                style={{ marginLeft: 12 }}
                onClick={() => setPhase("editor")}
              >
                Submit again
              </button>
            )}
          </p>
          {/* Score hero */}
          <div className="code-result-hero">
            <div className="code-result-ring">
              <ScoreRing value={evaluation.overallScore} />
            </div>
            <h2 className="code-result-verdict">
              {evaluation.verdict}
            </h2>
            <p className="code-result-meta">
              {problem.title} · {LANGUAGE_CONFIG[language].label} · {difficulty} · {formatTime(elapsed)}
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

          {/* Optimal solution */}
          <div className="code-optimal">
            <h3 className="code-section-title">Optimal Solution</h3>
            <div className="code-optimal__editor">
              <Editor
                height="300px"
                language={LANGUAGE_CONFIG[language].monacoId}
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/dashboard")}>
              ← Dashboard
            </button>
            {fromFullFlow ? (
              <button className="btn btn--primary" onClick={() => navigate("/interview/full/report")}>
                View final report
              </button>
            ) : (
              <button className="btn btn--primary" onClick={handleRetake}>
                Try Another Challenge
              </button>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  }

  return null;
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

function CodeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}
