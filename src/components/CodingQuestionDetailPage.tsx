/**
 * CodingQuestionDetailPage — Single question view with full company list and topics.
 * Layout and styles aligned with Dashboard.
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetCodingQuestionQuery } from "../store/endpoints/codingQuestions";
import { BoltIcon } from "./AppLogo";

const PROGRAMIZ_BASE = "https://www.programiz.com";
const PROGRAMIZ_COMPILER_LANGUAGES: { label: string; path: string }[] = [
  { label: "JavaScript", path: "javascript/online-compiler" },
  { label: "Python", path: "python-programming/online-compiler" },
  { label: "Java", path: "java-programming/online-compiler" },
  { label: "C", path: "c-programming/online-compiler" },
  { label: "C++", path: "cpp-programming/online-compiler" },
  { label: "C#", path: "csharp-programming/online-compiler" },
  { label: "TypeScript", path: "typescript/online-compiler" },
  { label: "Go", path: "golang/online-compiler" },
  { label: "Rust", path: "rust/online-compiler" },
  { label: "PHP", path: "php/online-compiler" },
  { label: "Swift", path: "swift/online-compiler" },
];

export function CodingQuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [compilerLang, setCompilerLang] = useState(PROGRAMIZ_COMPILER_LANGUAGES[0].path);
  const { data: question, isLoading, error } = useGetCodingQuestionQuery(id!, { skip: !id });

  const openCompiler = () => {
    const url = `${PROGRAMIZ_BASE}/${compilerLang}/`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!id) {
    navigate("/questions");
    return null;
  }

  if (isLoading) {
    return (
      <div className="dash">
        <div className="dash__content">
          <div className="questions-page__loading">Loading…</div>
        </div>
      </div>
    );
  }
  if (error || !question) {
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
            <button type="button" className="dash__topbar-btn" onClick={() => navigate("/questions")}>← Back to list</button>
          </div>
        </header>
        <div className="dash__content">
          <p className="dash__welcome-sub">Question not found.</p>
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/questions")}>← Back to list</button>
        </div>
      </div>
    );
  }

  const topics = question.topicTags ? question.topicTags.split(";").map((t) => t.trim()) : [];
  const usCompanies = question.companies.filter((c) => c.country === "US");
  const indiaCompanies = question.companies.filter((c) => c.country === "INDIA");

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
          <button type="button" className="dash__topbar-btn" onClick={() => navigate("/questions")}>
            ← Back to list
          </button>
        </div>
      </header>

      <div className="dash__content">
        <div className="dash__welcome">
          <h1 className="dash__welcome-title">{question.title}</h1>
          <div className="questions-detail__meta">
            <span className={`dash__badge questions-page__diff questions-page__diff--${question.difficulty.toLowerCase()}`}>
              {question.difficulty}
            </span>
            {question.paidOnly && <span className="questions-page__paid">Premium</span>}
            <span className="dash__welcome-sub" style={{ margin: 0 }}>LeetCode #{question.leetcodeId}</span>
          </div>
        </div>

        <section className="questions-detail__section questions-detail__try-now">
          <h2 className="dash__section-title">Try now</h2>
          <p className="questions-detail__sub">Pick a language and open the online compiler to practice.</p>
          <div className="questions-detail__try-now-row">
            <label htmlFor="compiler-lang" className="questions-detail__try-now-label">Language</label>
            <select
              id="compiler-lang"
              className="questions-detail__try-now-select"
              value={compilerLang}
              onChange={(e) => setCompilerLang(e.target.value)}
            >
              {PROGRAMIZ_COMPILER_LANGUAGES.map(({ label, path }) => (
                <option key={path} value={path}>{label}</option>
              ))}
            </select>
            <button type="button" className="btn btn--primary" onClick={openCompiler}>
              Open compiler
            </button>
          </div>
        </section>

        <section className="questions-detail__section">
          <h2 className="dash__section-title">Topics</h2>
          <p className="questions-detail__topics">
            {topics.length > 0 ? topics.join(", ") : "—"}
          </p>
        </section>

        <section className="questions-detail__section">
          <h2 className="dash__section-title">Asked at companies</h2>
          <p className="questions-detail__sub">These companies have been reported to ask this question (US & India IT).</p>
          {usCompanies.length > 0 && (
            <div className="questions-detail__company-group">
              <h3 className="questions-detail__company-group-title">US (Top America)</h3>
              <ul className="questions-detail__company-list">
                {usCompanies.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          )}
          {indiaCompanies.length > 0 && (
            <div className="questions-detail__company-group">
              <h3 className="questions-detail__company-group-title">India (Top IT)</h3>
              <ul className="questions-detail__company-list">
                {indiaCompanies.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          )}
          {question.companies.length === 0 && <p className="dash__welcome-sub" style={{ margin: 0 }}>No company data.</p>}
        </section>

        <section className="questions-detail__section">
          <h2 className="dash__section-title">Stats</h2>
          <div className="questions-detail__stats">
            {question.acRate != null && (
              <div className="questions-detail__stat-item">
                <span className="questions-detail__stat-label">AC Rate</span>
                <span>{(question.acRate * 100).toFixed(1)}%</span>
              </div>
            )}
            {question.frequency != null && (
              <div className="questions-detail__stat-item">
                <span className="questions-detail__stat-label">Frequency</span>
                <span>{question.frequency.toFixed(2)}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
