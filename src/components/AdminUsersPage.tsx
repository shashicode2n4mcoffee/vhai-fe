/**
 * AdminUsersPage — User management for ADMIN, HIRING_MANAGER, COLLEGE roles.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectUser } from "../store/authSlice";
import {
  useListUsersQuery,
  useChangeUserRoleMutation,
  useDeleteUserMutation,
} from "../store/endpoints/users";
import { useGetPricingPlansQuery, useGrantCreditsPackMutation } from "../store/endpoints/credits";
import { useToast } from "./Toast";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  HIRING_MANAGER: "Hiring Manager",
  COLLEGE: "College",
  CANDIDATE: "Candidate",
};

export function AdminUsersPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const currentUser = useAppSelector(selectUser)!;
  const isAdmin = currentUser.role === "ADMIN";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [grantModal, setGrantModal] = useState<{ userId: string; userName: string } | null>(null);
  const [grantPlan, setGrantPlan] = useState("");
  const [grantQuantity, setGrantQuantity] = useState<number>(1);

  const { data: plans } = useGetPricingPlansQuery();
  const [grantPack, { isLoading: granting }] = useGrantCreditsPackMutation();
  const { data, isLoading, refetch } = useListUsersQuery({
    page,
    limit: 20,
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
  });

  const [changeRole] = useChangeUserRoleMutation();
  const [deleteUser] = useDeleteUserMutation();

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await changeRole({ id: userId, role: newRole }).unwrap();
      toast.success("Role updated successfully");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to change role";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_users" });
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}?`)) return;
    try {
      await deleteUser(userId).unwrap();
      toast.success("User deactivated");
      refetch();
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to delete user";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_users" });
    }
  };

  const openGrantModal = (userId: string, userName: string) => {
    setGrantModal({ userId, userName });
    setGrantPlan("");
    setGrantQuantity(1);
  };

  const handleGrantPack = async () => {
    if (!grantModal || !grantPlan.trim()) return;
    const planConfig = [...(plans?.inr ?? []), ...(plans?.usd ?? [])].find((p) => p.id === grantPlan);
    const quantity = planConfig?.currency === "USD" && planConfig?.minCredits ? grantQuantity : undefined;
    try {
      await grantPack({ userId: grantModal.userId, plan: grantPlan, quantity }).unwrap();
      toast.success("Plan granted successfully");
      setGrantModal(null);
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to grant plan";
      toast.error(msg);
      logErrorToServer(msg, { source: "admin_users" });
    }
  };

  const allPlans = [...(plans?.inr ?? []), ...(plans?.usd ?? [])];
  const selectedPlanConfig = allPlans.find((p) => p.id === grantPlan);
  const isUsdWithQuantity = selectedPlanConfig?.currency === "USD" && (selectedPlanConfig?.minCredits ?? 0) > 0;

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
          <h1 className="dash__welcome-title">User Management</h1>
      <div className="admin-page__controls">
        <input
          className="auth-input"
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 300 }}
        />
        <select
          className="auth-input"
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          style={{ maxWidth: 200 }}
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="HIRING_MANAGER">Hiring Manager</option>
          <option value="COLLEGE">College</option>
          <option value="CANDIDATE">Candidate</option>
        </select>
      </div>

      {isLoading ? (
        <div className="admin-page__loading">Loading users...</div>
      ) : (
        <>
          <div className="dash__table-wrap">
            <table className="dash__table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Joined</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data?.data.map((user) => (
                  <tr key={user.id} className="dash__row">
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      {isAdmin && user.id !== currentUser.id ? (
                        <select
                          className="admin-page__role-select"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        >
                          {Object.entries(ROLE_LABELS).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`dash__badge dash__badge--${user.role.toLowerCase()}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      )}
                    </td>
                    <td>{user.organization?.name || "—"}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td>
                        {user.id !== currentUser.id && (
                          <span style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => openGrantModal(user.id, user.name)}
                            >
                              Grant plan
                            </button>
                            <button
                              className="btn btn--danger btn--sm"
                              onClick={() => handleDelete(user.id, user.name)}
                            >
                              Deactivate
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {data?.data.length === 0 && (
                  <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: "center", padding: "2rem" }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {data && data.pagination.totalPages > 1 && (
            <div className="admin-page__pagination">
              <button
                className="btn btn--ghost"
                disabled={!data.pagination.hasPrev}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {data.pagination.page} of {data.pagination.totalPages}</span>
              <button
                className="btn btn--ghost"
                disabled={!data.pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}

          {grantModal && (
            <div className="billing-modal-overlay" onClick={() => setGrantModal(null)}>
              <div className="billing-modal admin-grant-modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="billing-modal__title">Grant plan to {grantModal.userName}</h3>
                <p className="billing-modal__text">Give this user a credit pack without payment.</p>
                <div className="admin-grant-field">
                  <label className="pg-label">Plan</label>
                  <select
                    className="auth-input"
                    value={grantPlan}
                    onChange={(e) => setGrantPlan(e.target.value)}
                  >
                    <option value="">Select plan...</option>
                    {allPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.currency}) — {p.currency === "INR" ? `₹${p.priceDisplay}` : `$${p.priceDisplay}`}
                      </option>
                    ))}
                  </select>
                </div>
                {isUsdWithQuantity && selectedPlanConfig && (
                  <div className="admin-grant-field">
                    <label className="pg-label">Quantity (interviews)</label>
                    <input
                      type="number"
                      className="auth-input"
                      min={selectedPlanConfig.minCredits ?? 1}
                      max={selectedPlanConfig.maxCredits ?? 250}
                      value={grantQuantity}
                      onChange={(e) => setGrantQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />
                    <span className="pg-hint">
                      Min {selectedPlanConfig.minCredits} {selectedPlanConfig.maxCredits != null ? `, max ${selectedPlanConfig.maxCredits}` : ""}
                    </span>
                  </div>
                )}
                <div className="billing-modal__actions">
                  <button type="button" className="btn btn--ghost" onClick={() => setGrantModal(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!grantPlan || granting}
                    onClick={handleGrantPack}
                  >
                    {granting ? "Granting…" : "Grant plan"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  );
}
