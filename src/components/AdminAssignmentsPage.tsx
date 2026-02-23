/**
 * AdminAssignmentsPage — Test assignment management for ADMIN, HIRING_MANAGER, COLLEGE.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectUser } from "../store/authSlice";
import {
  useListAssignmentsQuery,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
} from "../store/endpoints/assignments";
import { useListUsersQuery } from "../store/endpoints/users";
import { useToast } from "./Toast";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

export function AdminAssignmentsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const currentUser = useAppSelector(selectUser)!;

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [type, setType] = useState<"interview" | "aptitude" | "coding">("aptitude");
  const [candidateId, setCandidateId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [configTopic, setConfigTopic] = useState("");
  const [configDifficulty, setConfigDifficulty] = useState("Medium");

  const { data: assignments, isLoading, refetch } = useListAssignmentsQuery({ page, limit: 20 });
  const { data: usersData } = useListUsersQuery({ role: "CANDIDATE", limit: 100 });
  const [createAssignment, { isLoading: creating }] = useCreateAssignmentMutation();
  const [deleteAssignment] = useDeleteAssignmentMutation();

  const candidates = usersData?.data || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) {
      toast.error("Please select a candidate");
      return;
    }

    try {
      await createAssignment({
        type,
        candidateId,
        config: { topic: configTopic, difficulty: configDifficulty },
        ...(deadline && { deadline: new Date(deadline).toISOString() }),
      }).unwrap();
      toast.success("Assignment created!");
      setShowCreate(false);
      setCandidateId("");
      setConfigTopic("");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to create assignment";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_assignments" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this assignment?")) return;
    try {
      await deleteAssignment(id).unwrap();
      toast.success("Assignment deleted");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to delete";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_assignments" });
    }
  };

  const statusColor = (s: string) => {
    if (s === "COMPLETED") return "dash__badge--green";
    if (s === "IN_PROGRESS") return "dash__badge--amber";
    if (s === "EXPIRED") return "dash__badge--red";
    return "dash__badge--cyan";
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
        <div className="admin-page__body">
          <div className="admin-page__title-row">
            <h1 className="dash__welcome-title">Test Assignments</h1>
            <button className="btn btn--primary" onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Cancel" : "+ New Assignment"}
            </button>
          </div>

      {showCreate && (
        <form className="admin-page__form" onSubmit={handleCreate}>
          <div className="admin-page__form-row">
            <div className="auth-field">
              <label className="auth-label">Test Type</label>
              <select className="auth-input" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="interview">Interview</option>
                <option value="aptitude">Aptitude Test</option>
                <option value="coding">Coding Test</option>
              </select>
            </div>
            <div className="auth-field">
              <label className="auth-label">Candidate</label>
              <select className="auth-input" value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
                <option value="">Select candidate...</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin-page__form-row">
            <div className="auth-field">
              <label className="auth-label">Topic / Description</label>
              <input className="auth-input" placeholder="e.g. Data Structures" value={configTopic} onChange={(e) => setConfigTopic(e.target.value)} />
            </div>
            <div className="auth-field">
              <label className="auth-label">Difficulty</label>
              <select className="auth-input" value={configDifficulty} onChange={(e) => setConfigDifficulty(e.target.value)}>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div className="auth-field">
              <label className="auth-label">Deadline (optional)</label>
              <input className="auth-input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <button className="btn btn--primary" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create Assignment"}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="admin-page__loading">Loading assignments...</div>
      ) : (
        <>
          <div className="dash__table-wrap">
            <table className="dash__table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments?.data.map((a) => (
                  <tr key={a.id} className="dash__row">
                    <td><span className="dash__badge">{a.type}</span></td>
                    <td>{a.candidate.name}</td>
                    <td><span className={`dash__badge ${statusColor(a.status)}`}>{a.status}</span></td>
                    <td>{a.deadline ? new Date(a.deadline).toLocaleDateString() : "—"}</td>
                    <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn--danger btn--sm" onClick={() => handleDelete(a.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {assignments?.data.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>No assignments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {assignments && assignments.pagination.totalPages > 1 && (
            <div className="admin-page__pagination">
              <button className="btn btn--ghost" disabled={!assignments.pagination.hasPrev} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span>Page {assignments.pagination.page} of {assignments.pagination.totalPages}</span>
              <button className="btn btn--ghost" disabled={!assignments.pagination.hasNext} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
