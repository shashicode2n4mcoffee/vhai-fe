/**
 * CodingQuestionsPage — Browse coding questions (LeetCode-style) with company associations.
 * Paginated list with filters: difficulty, topic, company.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useListCodingQuestionsQuery,
  useListQuestionCompaniesQuery,
} from "../store/endpoints/codingQuestions";
import { BoltIcon } from "./AppLogo";

const DIFFICULTY_OPTIONS = [
  { value: "", label: "All" },
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
];

export function CodingQuestionsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState("");
  const [topic, setTopic] = useState("");
  const [companyId, setCompanyId] = useState("");

  const { data, isLoading, isError, error } = useListCodingQuestionsQuery({
    page,
    limit: 20,
    ...(difficulty && { difficulty }),
    ...(topic.trim() && { topic: topic.trim() }),
    ...(companyId && { companyId }),
  });
  const { data: companies } = useListQuestionCompaniesQuery();

  const questions = data?.data ?? [];
  const pagination = data?.pagination;

  const handleFilter = () => {
    setPage(1);
  };

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
          <h1 className="dash__welcome-title">Coding Questions</h1>
          <p className="dash__welcome-sub">
            Browse questions by topic and see which companies ask them (US & India IT).
          </p>
        </div>

        <section className="questions-filters">
          <div className="questions-filters__row">
            <div className="questions-filters__field">
              <label className="questions-filters__label">Difficulty</label>
              <select
                className="auth-input"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                {DIFFICULTY_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="questions-filters__field">
              <label className="questions-filters__label">Topic</label>
              <input
                type="text"
                className="auth-input"
                placeholder="e.g. array, dynamic-programming"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
            <div className="questions-filters__field">
              <label className="questions-filters__label">Company</label>
              <select
                className="auth-input"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                <option value="">All companies</option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.country})
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn--primary questions-filters__apply" onClick={handleFilter}>
              Apply
            </button>
          </div>
        </section>

        {isLoading ? (
          <div className="questions-page__loading">Loading questions…</div>
        ) : isError ? (
          <div className="questions-page__error">
            Failed to load questions. Make sure the backend is running and the API is available.
            <br />
            <small>{(error as any)?.data?.error ?? (error as any)?.message ?? ""}</small>
          </div>
        ) : questions.length === 0 ? (
          <div className="questions-page__empty">
            No questions found. Try changing filters or run the seed: <code>cd backend && npm run db:seed-questions</code>
          </div>
        ) : (
          <>
            <div className="dash__table-wrap">
              <table className="dash__table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Difficulty</th>
                    <th>Topics</th>
                    <th>Companies</th>
                    <th>AC Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => (
                    <tr
                      key={q.id}
                      className="dash__row dash__row--clickable"
                      onClick={() => navigate(`/questions/${q.id}`)}
                    >
                      <td>{q.leetcodeId}</td>
                      <td>
                        <span className="questions-page__q-title">{q.title}</span>
                        {q.paidOnly && <span className="questions-page__paid">Premium</span>}
                      </td>
                      <td>
                        <span className={`dash__badge questions-page__diff questions-page__diff--${q.difficulty.toLowerCase()}`}>
                          {q.difficulty}
                        </span>
                      </td>
                      <td className="questions-page__topics">
                        {q.topicTags ? q.topicTags.split(";").slice(0, 3).join(", ") : "—"}
                      </td>
                      <td className="questions-page__companies">
                        {q.companies.length > 0
                          ? q.companies.slice(0, 3).map((c) => c.name).join(", ") +
                            (q.companies.length > 3 ? ` +${q.companies.length - 3}` : "")
                          : "—"}
                      </td>
                      <td>{q.acRate != null ? `${(q.acRate * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="admin-page__pagination">
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
