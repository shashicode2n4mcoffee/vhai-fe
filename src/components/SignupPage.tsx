/**
 * SignupPage — Registration form with name, email, password, confirm password.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../store/hooks";
import { setUser } from "../store/authSlice";
import { setTokens } from "../store/api";
import { useSignupMutation } from "../store/endpoints/auth";
import { useToast } from "./Toast";

export function SignupPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [signupApi, { isLoading }] = useSignupMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"CANDIDATE" | "HIRING_MANAGER" | "COLLEGE">("CANDIDATE");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    try {
      const result = await signupApi({
        name, email, password, role,
        ...(organizationName && { organizationName }),
      }).unwrap();
      setTokens(result.tokens.accessToken, result.tokens.refreshToken);
      dispatch(setUser(result.user));
      toast.success("Account created successfully!");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg = err?.data?.error || err?.message || "Signup failed";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <button type="button" className="auth-logo" onClick={() => navigate("/")} title="Home" style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
          <div className="auth-logo__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h1 className="auth-logo__title">VocalHireAI</h1>
        </button>

        <h2 className="auth-heading">Create your account</h2>
        <p className="auth-subheading">Get started with AI video interviews</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-name">Full name</label>
            <input id="signup-name" className="auth-input" type="text" placeholder="John Doe" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-email">Email address</label>
            <input id="signup-email" className="auth-input" type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-role">I am a</label>
            <select id="signup-role" className="auth-input" value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="CANDIDATE">Candidate</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="COLLEGE">College / University</option>
            </select>
          </div>

          {(role === "HIRING_MANAGER" || role === "COLLEGE") && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="signup-org">Organization Name</label>
              <input id="signup-org" className="auth-input" type="text" placeholder={role === "COLLEGE" ? "University name" : "Company name"} value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} required />
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-password">Password</label>
            <div className="auth-input-wrap">
              <input id="signup-password" className="auth-input" type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <button type="button" className="auth-pwd-toggle" onClick={() => setShowPwd(!showPwd)} tabIndex={-1} aria-label={showPwd ? "Hide password" : "Show password"}>
                {showPwd ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="signup-confirm">Confirm password</label>
            <input id="signup-confirm" className="auth-input" type="password" placeholder="Re-enter your password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn btn--primary auth-submit" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="auth-footer-text">
          Already have an account?{" "}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

// ---- Icons ----------------------------------------------------------------

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );
}
