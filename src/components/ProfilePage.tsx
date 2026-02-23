/**
 * ProfilePage — View and edit profile, change password, view stats.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./Toast";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectUser, setUser } from "../store/authSlice";
import { useUpdateProfileMutation, useChangePasswordMutation } from "../store/endpoints/users";
import { useGetDashboardQuery } from "../store/endpoints/analytics";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

export function ProfilePage() {
  const user = useAppSelector(selectUser)!;
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [updateProfileApi] = useUpdateProfileMutation();
  const [changePasswordApi] = useChangePasswordMutation();
  const { data: dashData } = useGetDashboardQuery();

  // Edit name and college roll (students)
  const [name, setName] = useState(user.name);
  const [collegeRollNumber, setCollegeRollNumber] = useState(user.collegeRollNumber ?? "");
  const [nameMsg, setNameMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Change password
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const toast = useToast();
  const stats = dashData?.stats;
  const iStats = { total: stats?.totalInterviews ?? 0, avgScore: stats?.avgInterviewScore ?? 0, bestScore: 0 };
  const aStats = { total: stats?.totalAptitude ?? 0, avgScore: stats?.avgAptitudeScore ?? 0, bestScore: 0 };

  const handleSaveProfile = async () => {
    setNameMsg(null);
    try {
      const updated = await updateProfileApi({
        name,
        collegeRollNumber: collegeRollNumber.trim() || null,
      }).unwrap();
      dispatch(
        setUser({
          ...user,
          name: updated.name,
          collegeRollNumber: updated.collegeRollNumber ?? null,
        }),
      );
      setNameMsg({ type: "ok", text: "Profile updated successfully" });
      toast.success("Profile updated successfully");
    } catch (err: any) {
      const msg = err?.data?.error || "Update failed";
      setNameMsg({ type: "err", text: msg });
      toast.error(msg);
      logErrorToServer(msg, { source: "profile" });
    }
  };

  const handleChangePwd = async () => {
    setPwdMsg(null);
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: "err", text: "Passwords do not match" });
      toast.error("Passwords do not match");
      return;
    }
    try {
      await changePasswordApi({ currentPassword: curPwd, newPassword: newPwd }).unwrap();
      setCurPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setPwdMsg({ type: "ok", text: "Password changed successfully" });
      toast.success("Password changed successfully");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed";
      setPwdMsg({ type: "err", text: msg });
      toast.error(msg);
      logErrorToServer(msg, { source: "profile" });
    }
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
        <div className="pg-wrapper pg-wrapper--wide">
        {/* ---- Avatar + Info ---- */}
        <div className="pg-hero">
          <div className="pg-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="pg-name">{user.name}</h1>
          <p className="pg-email">{user.email}</p>
        </div>

        {/* ---- Stats ---- */}
        <div className="pg-stats">
          <div className="pg-stat">
            <span className="pg-stat__value">{iStats.total}</span>
            <span className="pg-stat__label">Interviews</span>
          </div>
          <div className="pg-stat">
            <span className="pg-stat__value">{iStats.total > 0 ? iStats.avgScore : "—"}</span>
            <span className="pg-stat__label">Avg. Score</span>
          </div>
          <div className="pg-stat">
            <span className="pg-stat__value">{aStats.total}</span>
            <span className="pg-stat__label">Aptitude Tests</span>
          </div>
          <div className="pg-stat">
            <span className="pg-stat__value">{aStats.total > 0 ? `${aStats.bestScore}%` : "—"}</span>
            <span className="pg-stat__label">Best Aptitude</span>
          </div>
        </div>

        {/* ---- Edit Profile ---- */}
        <section className="pg-card">
          <h2 className="pg-card__title">
            <IconUser /> Edit Profile
          </h2>
          <div className="pg-field">
            <label className="pg-label">Full Name</label>
            <input
              className="pg-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="pg-field">
            <label className="pg-label">Email</label>
            <input
              className="pg-input pg-input--disabled"
              type="email"
              value={user.email}
              disabled
            />
            <span className="pg-hint">Email cannot be changed</span>
          </div>
          {user.role === "CANDIDATE" && (
            <div className="pg-field">
              <label className="pg-label">College roll number</label>
              <input
                className="pg-input"
                type="text"
                placeholder="Required for student plans (INR)"
                value={collegeRollNumber}
                onChange={(e) => setCollegeRollNumber(e.target.value)}
              />
              <span className="pg-hint">Required when purchasing INR (student) credit packs</span>
            </div>
          )}
          {nameMsg && (
            <div className={`pg-msg pg-msg--${nameMsg.type}`}>{nameMsg.text}</div>
          )}
          <button
            className="btn btn--primary pg-save"
            disabled={
              !name.trim() ||
              (name.trim() === user.name && (collegeRollNumber || "").trim() === (user.collegeRollNumber || ""))
            }
            onClick={handleSaveProfile}
          >
            Save Changes
          </button>
        </section>

        {/* ---- Change Password ---- */}
        <section className="pg-card">
          <h2 className="pg-card__title">
            <IconLock /> Change Password
          </h2>
          <div className="pg-field">
            <label className="pg-label">Current Password</label>
            <input
              className="pg-input"
              type="password"
              placeholder="Enter current password"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
            />
          </div>
          <div className="pg-field">
            <label className="pg-label">New Password</label>
            <input
              className="pg-input"
              type="password"
              placeholder="Min. 6 characters"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
            />
          </div>
          <div className="pg-field">
            <label className="pg-label">Confirm New Password</label>
            <input
              className="pg-input"
              type="password"
              placeholder="Re-enter new password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />
          </div>
          {pwdMsg && (
            <div className={`pg-msg pg-msg--${pwdMsg.type}`}>{pwdMsg.text}</div>
          )}
          <button
            className="btn btn--primary pg-save"
            disabled={!curPwd || !newPwd || !confirmPwd}
            onClick={handleChangePwd}
          >
            Update Password
          </button>
        </section>
        </div>
      </div>
    </div>
  );
}

// ---- Icons ----------------------------------------------------------------

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
