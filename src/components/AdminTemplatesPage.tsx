/**
 * AdminTemplatesPage — List and update job (interview) templates.
 * For ADMIN, HIRING_MANAGER, COLLEGE. Admins see all templates; others see org + own + public.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectUser } from "../store/authSlice";
import {
  useListTemplatesQuery,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  type Template,
} from "../store/endpoints/templates";
import { useToast } from "./Toast";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

const LIMIT = 20;

export function AdminTemplatesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const currentUser = useAppSelector(selectUser)!;

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editModal, setEditModal] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState<Partial<Pick<Template, "name" | "aiBehavior" | "customerWants" | "candidateOffers" | "isPublic">>>({});

  const { data, isLoading, refetch } = useListTemplatesQuery({ page, limit: LIMIT });
  const [updateTemplate, { isLoading: updating }] = useUpdateTemplateMutation();
  const [deleteTemplate, { isLoading: deleting }] = useDeleteTemplateMutation();

  const templates = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const hasNext = pagination?.hasNext ?? false;
  const hasPrev = pagination?.hasPrev ?? false;

  const openEdit = useCallback((t: Template) => {
    setEditModal(t);
    setEditForm({
      name: t.name,
      aiBehavior: t.aiBehavior,
      customerWants: t.customerWants,
      candidateOffers: t.candidateOffers,
      isPublic: t.isPublic,
    });
  }, []);

  const closeEdit = useCallback(() => {
    setEditModal(null);
    setEditForm({});
  }, []);

  const handleSave = async () => {
    if (!editModal) return;
    const payload = {
      name: editForm.name ?? editModal.name,
      aiBehavior: editForm.aiBehavior ?? editModal.aiBehavior,
      customerWants: editForm.customerWants ?? editModal.customerWants,
      candidateOffers: editForm.candidateOffers ?? editModal.candidateOffers,
      isPublic: editForm.isPublic ?? editModal.isPublic,
    };
    if (!payload.name?.trim() || !payload.aiBehavior?.trim() || !payload.customerWants?.trim() || !payload.candidateOffers?.trim()) {
      toast.error("Name, AI behavior, customer wants, and candidate offers are required.");
      return;
    }
    try {
      await updateTemplate({ id: editModal.id, data: payload }).unwrap();
      toast.success("Template updated");
      closeEdit();
      refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to update template";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_templates" });
    }
  };

  const handleDelete = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"? This cannot be undone.`)) return;
    try {
      await deleteTemplate(t.id).unwrap();
      toast.success("Template deleted");
      if (editModal?.id === t.id) closeEdit();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(t.id);
        return next;
      });
      refetch();
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Failed to delete template";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_templates" });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === templates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(templates.map((t) => t.id)));
    }
  };

  const handleEditSelected = () => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const t = templates.find((x) => x.id === id);
    if (t) openEdit(t);
  };

  const singleSelected = selectedIds.size === 1;

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
            <div>
              <h1 className="dash__welcome-title">Job Templates</h1>
              <p className="admin-page__subtitle">
                Select a template and edit to update name, AI behavior, job description, and visibility. Only admins can edit any template; others can edit their own.
              </p>
            </div>
          </div>

          <div className="admin-page__controls">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!singleSelected}
              onClick={handleEditSelected}
              title={singleSelected ? "Edit selected template" : "Select exactly one template to edit"}
            >
              Edit selected
            </button>
          </div>

          {isLoading ? (
            <div className="admin-page__loading">Loading templates...</div>
          ) : (
            <>
              <div className="dash__table-wrap">
                <table className="dash__table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={templates.length > 0 && selectedIds.size === templates.length}
                          onChange={selectAll}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th>Name</th>
                      <th>Creator</th>
                      <th>Public</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((t) => (
                      <tr key={t.id} className="dash__row">
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(t.id)}
                            onChange={() => toggleSelect(t.id)}
                            aria-label={`Select ${t.name}`}
                          />
                        </td>
                        <td>
                          <span title={t.name}>
                            {t.name.length > 50 ? t.name.slice(0, 50) + "…" : t.name}
                          </span>
                        </td>
                        <td>{t.creator?.name ?? "—"}</td>
                        <td>{t.isPublic ? "Yes" : "No"}</td>
                        <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
                        <td>
                          <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button type="button" className="btn btn--primary btn--sm" onClick={() => openEdit(t)}>
                              Edit
                            </button>
                            {currentUser.role === "ADMIN" && (
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() => handleDelete(t)}
                                disabled={deleting}
                              >
                                Delete
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {templates.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem" }}>No templates found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="admin-page__pagination">
                  <button type="button" className="btn btn--ghost" disabled={!hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  <span>Page {page} of {totalPages}</span>
                  <button type="button" className="btn btn--ghost" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editModal && (
        <div
          className="billing-modal-overlay"
          onClick={closeEdit}
          onKeyDown={(e) => e.key === "Escape" && closeEdit()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-template-modal-title"
        >
          <div className="billing-modal admin-template-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="admin-template-modal-title" className="billing-modal__title">
              Edit template: {editModal.name}
            </h2>
            <div className="admin-template-modal__form">
              <label className="admin-template-modal__label">
                Name
                <input
                  type="text"
                  className="auth-input"
                  value={editForm.name ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  maxLength={200}
                />
              </label>
              <label className="admin-template-modal__label">
                AI behavior
                <textarea
                  className="auth-input"
                  rows={4}
                  style={{ resize: "vertical", minHeight: "80px" }}
                  value={editForm.aiBehavior ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, aiBehavior: e.target.value }))}
                  maxLength={5000}
                />
              </label>
              <label className="admin-template-modal__label">
                Customer wants (job description)
                <textarea
                  className="auth-input"
                  rows={3}
                  style={{ resize: "vertical", minHeight: "60px" }}
                  value={editForm.customerWants ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, customerWants: e.target.value }))}
                  maxLength={5000}
                />
              </label>
              <label className="admin-template-modal__label">
                Candidate offers (resume prompt)
                <textarea
                  className="auth-input"
                  rows={3}
                  style={{ resize: "vertical", minHeight: "60px" }}
                  value={editForm.candidateOffers ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, candidateOffers: e.target.value }))}
                  maxLength={5000}
                />
              </label>
              <label className="admin-template-modal__label admin-template-modal__label--row">
                <input
                  type="checkbox"
                  checked={editForm.isPublic ?? false}
                  onChange={(e) => setEditForm((f) => ({ ...f, isPublic: e.target.checked }))}
                />
                <span>Public (visible to all candidates)</span>
              </label>
            </div>
            <div className="admin-template-modal__actions">
              <button type="button" className="btn btn--secondary" onClick={closeEdit}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSave} disabled={updating}>
                {updating ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
