/**
 * Dashboard — Main landing page after login.
 *
 * Shows welcome message, interview stats, a CTA to start
 * a new interview, and a history table of past interviews.
 */

import { Link, useNavigate } from "react-router-dom";
import { LANGUAGE_CONFIG } from "../lib/coding-test";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { clearUser, selectUser } from "../store/authSlice";
import { clearTokens } from "../store/api";
import { clearGeminiCache } from "../lib/gemini-key";
import { useGetDashboardQuery } from "../store/endpoints/analytics";
import { useGetCreditsBalanceQuery } from "../store/endpoints/credits";
import { BoltIcon } from "./AppLogo";

export function Dashboard() {
  const user = useAppSelector(selectUser)!;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data: dashData, isLoading } = useGetDashboardQuery();
  const { data: credits } = useGetCreditsBalanceQuery();

  const stats = dashData?.stats ?? { totalInterviews: 0, completedInterviews: 0, totalAptitude: 0, totalCoding: 0, totalUsers: 0, avgInterviewScore: 0, avgAptitudeScore: 0, avgCodingScore: 0 };
  const recent = dashData?.recent ?? { interviews: [], aptitude: [], coding: [] };
  const firstName = user.name.split(" ")[0];
  const isManager = user.role === "ADMIN" || user.role === "HIRING_MANAGER" || user.role === "COLLEGE";
  const totalInterviewCredits = (credits?.technical ?? 0) + (credits?.hr ?? 0) + (credits?.behavioral ?? 0) + (credits?.general ?? 0);
  const hasInterviewCredits = totalInterviewCredits > 0;
  const hasAptitudeCredits = (credits?.aptitude ?? 0) > 0;
  const hasCodingCredits = (credits?.coding ?? 0) > 0;
  const canStartInterview = isManager || hasInterviewCredits;
  const canStartAptitude = isManager || hasAptitudeCredits;
  const canStartCoding = isManager || hasCodingCredits;

  const handleLogout = () => {
    clearTokens();
    clearGeminiCache();
    dispatch(clearUser());
    navigate("/");
  };

  return (
    <div className="dash">
      {/* ---- Top Bar ---- */}
      <header className="dash__topbar">
        <Link to="/dashboard" className="dash__brand" title="Home">
          <div className="dash__brand-icon">
            <BoltIcon />
          </div>
          <span className="dash__brand-name">VocalHireAI</span>
        </Link>
        <div className="dash__user-section">
          <Link to="/profile" className="dash__topbar-btn" title="Profile" aria-label="Profile">
            <div className="dash__avatar">{user.name.charAt(0).toUpperCase()}</div>
            <span className="dash__user-name">{user.name}</span>
          </Link>
          {isManager && (
            <>
              <Link to="/admin/users" className="dash__topbar-btn" title="Users" aria-label="Users">
                <span style={{ fontSize: "0.8rem" }}>Users</span>
              </Link>
              <Link to="/admin/assignments" className="dash__topbar-btn" title="Assignments" aria-label="Assignments">
                <span style={{ fontSize: "0.8rem" }}>Assignments</span>
              </Link>
              <Link to="/admin/templates" className="dash__topbar-btn" title="Job templates" aria-label="Job templates">
                <span style={{ fontSize: "0.8rem" }}>Templates</span>
              </Link>
              {user.role === "ADMIN" && (
                <Link to="/admin/errors" className="dash__topbar-btn" title="Error log" aria-label="Error log">
                  <span style={{ fontSize: "0.8rem" }}>Errors</span>
                </Link>
              )}
            </>
          )}
          <Link to="/billing" className="dash__topbar-btn" title="Billing & Credits" aria-label="Billing & Credits">
            <span style={{ fontSize: "0.8rem" }}>Credits</span>
            {((credits?.technical ?? 0) + (credits?.hr ?? 0) + (credits?.behavioral ?? 0) + (credits?.general ?? 0)) > 0 && (
              <span className="dash__credits-badge">
                {(credits?.technical ?? 0) + (credits?.hr ?? 0) + (credits?.behavioral ?? 0) + (credits?.general ?? 0)}
              </span>
            )}
          </Link>
          <Link to="/settings" className="dash__topbar-btn dash__topbar-btn--icon" title="Settings" aria-label="Settings">
            <GearIcon />
          </Link>
          <button className="dash__logout" onClick={handleLogout}>
            <LogoutIcon />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* ---- Content ---- */}
      <div className="dash__content">
        {/* Credits strip */}
        <div className="dash__credits-strip">
          <span className="dash__credits-label">Credits:</span>
          <span>Interviews {(credits?.technical ?? 0) + (credits?.hr ?? 0) + (credits?.behavioral ?? 0) + (credits?.general ?? 0)}</span>
          <span>Aptitude {credits?.aptitude ?? 0}</span>
          <span>Coding {credits?.coding ?? 0}</span>
          <button className="dash__credits-link" onClick={() => navigate("/billing")}>Get more</button>
          <button className="dash__credits-link" onClick={() => navigate("/questions")}>Question Bank</button>
        </div>

        {/* Welcome */}
        <div className="dash__welcome">
          <h1 className="dash__welcome-title">
            Welcome back, {firstName}!
          </h1>
          <p className="dash__welcome-sub">
            Here's your interview overview
          </p>
        </div>

        {/* Stats */}
        <div className="dash__stats">
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--purple">
              <ClipboardIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">{stats.totalInterviews}</span>
              <span className="dash__stat-label">Interviews</span>
            </div>
          </div>
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--cyan">
              <ChartIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">
                {stats.totalInterviews > 0 ? stats.avgInterviewScore : "—"}
              </span>
              <span className="dash__stat-label">Avg. Interview</span>
            </div>
          </div>
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--amber">
              <BrainIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">{stats.totalAptitude}</span>
              <span className="dash__stat-label">Aptitude Tests</span>
            </div>
          </div>
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--green">
              <TrophyIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">
                {stats.totalAptitude > 0 ? `${stats.avgAptitudeScore}%` : "—"}
              </span>
              <span className="dash__stat-label">Avg. Aptitude</span>
            </div>
          </div>
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--rose">
              <CodeBracketIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">{stats.totalCoding}</span>
              <span className="dash__stat-label">Coding Tests</span>
            </div>
          </div>
          <div className="dash__stat-card">
            <div className="dash__stat-icon dash__stat-icon--teal">
              <TrophyIcon />
            </div>
            <div className="dash__stat-info">
              <span className="dash__stat-value">
                {stats.totalCoding > 0 ? `${stats.avgCodingScore}/100` : "—"}
              </span>
              <span className="dash__stat-label">Avg. Coding</span>
            </div>
          </div>
        </div>

        {/* CTA — gated: no credits = go to billing */}
        <div
          className={`dash__cta ${!canStartInterview ? "dash__cta--locked" : ""}`}
          onClick={() => (canStartInterview ? navigate("/interview/new") : navigate("/billing"))}
        >
          <div className="dash__cta-left">
            <div className="dash__cta-icon">
              <MicIcon />
            </div>
            <div>
              <h3 className="dash__cta-title">Start New Interview</h3>
              <p className="dash__cta-desc">
                {canStartInterview
                  ? "Begin an AI video interview with real-time voice, video recording, and 20-section evaluation."
                  : "Purchase credits to unlock interviews."}
              </p>
            </div>
          </div>
          <button className="btn btn--start dash__cta-btn" type="button">
            {canStartInterview ? "Start Interview" : "Get credits"}
            <ArrowIcon />
          </button>
        </div>

        {/* Aptitude CTA */}
        <div
          className={`dash__cta dash__cta--apt ${!canStartAptitude ? "dash__cta--locked" : ""}`}
          onClick={() => (canStartAptitude ? navigate("/aptitude") : navigate("/billing"))}
        >
          <div className="dash__cta-left">
            <div className="dash__cta-icon dash__cta-icon--apt">
              <BrainIcon />
            </div>
            <div>
              <h3 className="dash__cta-title">Aptitude Test</h3>
              <p className="dash__cta-desc">
                {canStartAptitude
                  ? "Generate MCQ quizzes on any topic. AI creates the questions, you answer, instant results."
                  : "Purchase credits to unlock aptitude tests."}
              </p>
            </div>
          </div>
          <button className="btn btn--start dash__cta-btn" type="button">
            {canStartAptitude ? "Take Test" : "Get credits"}
            <ArrowIcon />
          </button>
        </div>

        {/* Coding Test CTA */}
        <div
          className={`dash__cta dash__cta--code ${!canStartCoding ? "dash__cta--locked" : ""}`}
          onClick={() => (canStartCoding ? navigate("/coding") : navigate("/billing"))}
        >
          <div className="dash__cta-left">
            <div className="dash__cta-icon dash__cta-icon--code">
              <CodeBracketIcon />
            </div>
            <div>
              <h3 className="dash__cta-title">Coding Challenge</h3>
              <p className="dash__cta-desc">
                {canStartCoding
                  ? "Solve AI-generated coding problems in a professional editor. Get detailed skill ratings on correctness, efficiency, and style."
                  : "Purchase credits to unlock coding challenges."}
              </p>
            </div>
          </div>
          <button className="btn btn--start dash__cta-btn" type="button">
            {canStartCoding ? "Start Coding" : "Get credits"}
            <ArrowIcon />
          </button>
        </div>

        {/* Question Bank */}
        <div className="dash__cta dash__cta--apt" onClick={() => navigate("/questions")}>
          <div className="dash__cta-left">
            <div className="dash__cta-icon dash__cta-icon--apt">
              <ClipboardIcon />
            </div>
            <div>
              <h3 className="dash__cta-title">Question Bank</h3>
              <p className="dash__cta-desc">
                Browse 3,800+ coding questions by topic and difficulty. See which companies (US & India IT) ask each question.
              </p>
            </div>
          </div>
          <button className="btn btn--start dash__cta-btn" type="button">
            Browse questions
            <ArrowIcon />
          </button>
        </div>

        {/* Aptitude History */}
        {recent.aptitude.length > 0 && (
          <div className="dash__history">
            <h2 className="dash__section-title">Recent Aptitude Tests</h2>
            <div className="dash__table-wrap">
              <table className="dash__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Topic</th>
                    <th>Score</th>
                    <th>Result</th>
                    {isManager && <th>Candidate</th>}
                  </tr>
                </thead>
                <tbody>
                  {recent.aptitude.map((r) => (
                    <tr key={r.id} className="dash__row dash__row--clickable" onClick={() => navigate(`/aptitude/report/${r.id}`)}>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>{r.topic}</td>
                      <td>{r.score ?? "—"}/{r.total}</td>
                      <td><span className={`dash__badge ${r.passed ? "dash__badge--green" : "dash__badge--red"}`}>{r.passed ? "Passed" : r.passed === false ? "Failed" : "Pending"}</span></td>
                      {isManager && <td>{r.candidate.name}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Coding History */}
        {recent.coding.length > 0 && (
          <div className="dash__history">
            <h2 className="dash__section-title">Recent Coding Challenges</h2>
            <div className="dash__table-wrap">
              <table className="dash__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Problem</th>
                    <th>Language</th>
                    <th>Score</th>
                    <th>Verdict</th>
                    {isManager && <th>Candidate</th>}
                  </tr>
                </thead>
                <tbody>
                  {recent.coding.map((r) => (
                    <tr key={r.id} className="dash__row dash__row--clickable" onClick={() => navigate(`/coding/report/${r.id}`)}>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>{r.topic}</td>
                      <td>{LANGUAGE_CONFIG[r.language as keyof typeof LANGUAGE_CONFIG]?.label || r.language}</td>
                      <td>{r.score ?? "—"}</td>
                      <td><span className={`dash__badge ${getVerdictClass(r.verdict)}`}>{r.verdict ?? "Pending"}</span></td>
                      {isManager && <td>{r.candidate.name}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interview History */}
        <div className="dash__history">
          <h2 className="dash__section-title">Recent Interviews</h2>

          {recent.interviews.length === 0 ? (
            <div className="dash__empty">
              <div className="dash__empty-icon">
                <ClipboardIcon />
              </div>
              <p className="dash__empty-text">{isLoading ? "Loading..." : "No interviews yet"}</p>
              <p className="dash__empty-sub">
                Start your first video interview to see results here.
              </p>
            </div>
          ) : (
            <div className="dash__table-wrap">
              <table className="dash__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Template</th>
                    <th>Score</th>
                    <th>Recommendation</th>
                    {isManager && <th>Candidate</th>}
                  </tr>
                </thead>
                <tbody>
                  {recent.interviews.map((record) => (
                    <tr key={record.id} className="dash__row dash__row--clickable" onClick={() => navigate(`/interview/report/${record.id}`)}>
                      <td>{new Date(record.createdAt).toLocaleDateString()}</td>
                      <td>{record.template.name}</td>
                      <td>{record.overallScore != null ? `${record.overallScore}/10` : "—"}</td>
                      <td><span className={`dash__badge ${getRecBadge(record.recommendation)}`}>{record.recommendation ?? "Pending"}</span></td>
                      {isManager && <td>{record.candidate.name}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ----------------------------------------------------------------

function getRecBadge(rec: string | null): string {
  if (!rec) return "";
  const r = rec.toLowerCase();
  if (r.includes("strong")) return "dash__badge--green";
  if (r.includes("hire")) return "dash__badge--cyan";
  if (r.includes("consider")) return "dash__badge--amber";
  return "dash__badge--red";
}

function getVerdictClass(verdict: string | null): string {
  if (!verdict) return "";
  const v = verdict.toLowerCase();
  if (v.includes("excellent") || v.includes("good")) return "dash__badge--green";
  if (v.includes("average")) return "dash__badge--amber";
  return "dash__badge--red";
}

// ---- SVG Icons --------------------------------------------------------------

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}


function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 22V8a6 6 0 0 0-6-6h16a6 6 0 0 0-6 6v14" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1" />
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1" />
      <path d="M12 22v-6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CodeBracketIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
