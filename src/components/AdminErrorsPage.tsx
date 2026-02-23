/**
 * AdminErrorsPage — List of logged errors with user id, name, and details (ADMIN only).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectUser } from "../store/authSlice";
import { useListErrorsQuery } from "../store/endpoints/errors";
import { BoltIcon } from "./AppLogo";

export function AdminErrorsPage() {
  const navigate = useNavigate();
  const currentUser = useAppSelector(selectUser);

  const [page, setPage] = useState(1);
  const [sourceFilter, setSourceFilter] = useState("");

  const { data, isLoading } = useListErrorsQuery({
    page,
    limit: 20,
    ...(sourceFilter && { source: sourceFilter }),
  });

  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="dash">
        <p style={{ padding: "2rem", textAlign: "center" }}>You do not have permission to view this page.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate("/dashboard")}>
          Back to Dashboard
        </button>
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
        <div className="admin-page__body">
          <h1 className="dash__welcome-title">Error Log</h1>
          <p className="pg-muted" style={{ marginBottom: "1rem" }}>
            Track user-facing errors by user and source.
          </p>

          <div className="admin-page__controls" style={{ marginBottom: "1rem" }}>
            <input
              className="auth-input"
              type="text"
              placeholder="Filter by source (e.g. voice_chat)"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              style={{ maxWidth: 280 }}
            />
          </div>

          {isLoading ? (
            <div className="admin-page__loading">Loading errors...</div>
          ) : (
            <>
              <div className="dash__table-wrap">
                <table className="dash__table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Name</th>
                      <th>Error</th>
                      <th>Details</th>
                      <th>Source</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.map((entry) => (
                      <tr key={entry.id} className="dash__row">
                        <td className="dash__mono">{entry.userId ?? "—"}</td>
                        <td>
                          {entry.userName ?? entry.user?.name ?? "—"}
                          {entry.user && (
                            <>
                              <br />
                              <span className="pg-muted" style={{ fontSize: "0.85rem" }}>
                                {entry.user.email}
                              </span>
                            </>
                          )}
                        </td>
                        <td style={{ maxWidth: 280 }} title={entry.message}>
                          {entry.message.length > 80 ? `${entry.message.slice(0, 80)}…` : entry.message}
                        </td>
                        <td style={{ maxWidth: 200 }} title={entry.details ?? ""}>
                          {entry.details
                            ? entry.details.length > 60
                              ? `${entry.details.slice(0, 60)}…`
                              : entry.details
                            : "—"}
                        </td>
                        <td>{entry.source ?? "—"}</td>
                        <td>{new Date(entry.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {data?.data.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>
                          No errors recorded.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {data && data.pagination.totalPages > 1 && (
                <div className="admin-page__pagination">
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={!data.pagination.hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
                  </span>
                  <button
                    className="btn btn--ghost"
                    type="button"
                    disabled={!data.pagination.hasNext}
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
    </div>
  );
}
