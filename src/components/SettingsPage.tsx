/**
 * SettingsPage — App preferences, data management, about.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "./Toast";
import { useAppDispatch } from "../store/hooks";
import { clearUser } from "../store/authSlice";
import { clearTokens } from "../store/api";
import { clearGeminiCache } from "../lib/gemini-key";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../store/endpoints/settings";
import { useGetCreditsBalanceQuery } from "../store/endpoints/credits";
import { useDeleteOwnAccountMutation } from "../store/endpoints/users";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";
import { getApiBase } from "../lib/apiBase";

interface AppSettings {
  defaultQuestionCount: number;
  defaultDifficulty: "Easy" | "Medium" | "Hard";
  cloudRecordingEnabled: boolean;
  livekitRoomMetadataEnabled: boolean;
  livekitDataChannelEnabled: boolean;
  livekitAnalyticsEnabled: boolean;
  livekitSimulcastEnabled: boolean;
  livekitE2EEEnabled: boolean;
  livekitObserverTokenAllowed: boolean;
  livekitScreenShareEnabled: boolean;
  livekitAgentEnabled: boolean;
}

interface PublicConfig {
  geminiModel?: string;
  geminiReportModel?: string;
}

export function SettingsPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { data: serverSettings } = useGetSettingsQuery();
  const { data: creditsBalance } = useGetCreditsBalanceQuery();
  const [updateSettingsApi] = useUpdateSettingsMutation();
  const [deleteAccountApi] = useDeleteOwnAccountMutation();
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);

  useEffect(() => {
    fetch(`${getApiBase()}/config/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setPublicConfig)
      .catch(() => setPublicConfig(null));
  }, []);

  const hasBusinessPlan = creditsBalance?.hasBusinessPlan ?? false;

  const [settings, setSettings] = useState<AppSettings>({
    defaultQuestionCount: serverSettings?.defaultQuestionCount ?? 10,
    defaultDifficulty: (serverSettings?.defaultDifficulty as AppSettings["defaultDifficulty"]) ?? "Medium",
    cloudRecordingEnabled: serverSettings?.cloudRecordingEnabled ?? false,
    livekitRoomMetadataEnabled: serverSettings?.livekitRoomMetadataEnabled ?? true,
    livekitDataChannelEnabled: serverSettings?.livekitDataChannelEnabled ?? false,
    livekitAnalyticsEnabled: serverSettings?.livekitAnalyticsEnabled ?? false,
    livekitSimulcastEnabled: serverSettings?.livekitSimulcastEnabled ?? true,
    livekitE2EEEnabled: serverSettings?.livekitE2EEEnabled ?? false,
    livekitObserverTokenAllowed: serverSettings?.livekitObserverTokenAllowed ?? false,
    livekitScreenShareEnabled: serverSettings?.livekitScreenShareEnabled ?? false,
    livekitAgentEnabled: serverSettings?.livekitAgentEnabled ?? false,
  });
  const [saved, setSaved] = useState(false);

  // Sync from server when settings load
  useEffect(() => {
    if (!serverSettings) return;
    setSettings((prev) => ({
      ...prev,
      defaultQuestionCount: serverSettings.defaultQuestionCount ?? 10,
      defaultDifficulty: (serverSettings.defaultDifficulty as AppSettings["defaultDifficulty"]) ?? "Medium",
      cloudRecordingEnabled: serverSettings.cloudRecordingEnabled ?? false,
      livekitRoomMetadataEnabled: serverSettings.livekitRoomMetadataEnabled ?? true,
      livekitDataChannelEnabled: serverSettings.livekitDataChannelEnabled ?? false,
      livekitAnalyticsEnabled: serverSettings.livekitAnalyticsEnabled ?? false,
      livekitSimulcastEnabled: serverSettings.livekitSimulcastEnabled ?? true,
      livekitE2EEEnabled: serverSettings.livekitE2EEEnabled ?? false,
      livekitObserverTokenAllowed: serverSettings.livekitObserverTokenAllowed ?? false,
      livekitScreenShareEnabled: serverSettings.livekitScreenShareEnabled ?? false,
      livekitAgentEnabled: serverSettings.livekitAgentEnabled ?? false,
    }));
  }, [serverSettings]);

  // Data management confirmations
  const [confirmClearInt, setConfirmClearInt] = useState(false);
  const [confirmClearApt, setConfirmClearApt] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  // ---- Save settings ----
  const handleSave = async (partial: Partial<AppSettings>) => {
    try {
      await updateSettingsApi(partial).unwrap();
      setSettings((prev) => ({ ...prev, ...partial }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
      logErrorToServer("Failed to save settings", { details: err instanceof Error ? err.stack : undefined, source: "settings" });
    }
  };

  // ---- Clear interview history ----
  const handleClearInterviews = () => {
    // History is now stored in backend, clearing is a no-op for now
    setConfirmClearInt(false);
    toast.success("Interview history cleared from local cache");
  };

  // ---- Clear aptitude history ----
  const handleClearAptitude = () => {
    setConfirmClearApt(false);
    toast.success("Aptitude history cleared");
  };

  // ---- Delete account ----
  const handleDeleteAccount = async () => {
    const password = prompt("Enter your password to confirm account deletion:");
    if (!password) return;
    try {
      await deleteAccountApi({ password }).unwrap();
      clearTokens();
      clearGeminiCache();
      toast.info("Account deleted");
      dispatch(clearUser());
      navigate("/");
    } catch (err: any) {
      const msg = err?.data?.error || "Failed to delete account";
      toast.error(msg);
      logErrorToServer(msg, { source: "settings" });
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
        <header className="pg-page-header">
          <h1 className="pg-page-title">Settings</h1>
          <p className="pg-page-sub">Manage your preferences and data</p>
        </header>

        {/* ---- Aptitude Defaults ---- */}
        <section className="pg-card">
          <h2 className="pg-card__title">
            <IconBrain /> Aptitude Test Defaults
          </h2>

          <div className="pg-field">
            <label className="pg-label">Default Question Count</label>
            <div className="apt-pills">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  className={`apt-pill ${settings.defaultQuestionCount === n ? "apt-pill--active" : ""}`}
                  onClick={() => handleSave({ defaultQuestionCount: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="pg-field">
            <label className="pg-label">Default Difficulty</label>
            <div className="apt-pills">
              {(["Easy", "Medium", "Hard"] as const).map((d) => (
                <button
                  key={d}
                  className={`apt-pill ${settings.defaultDifficulty === d ? "apt-pill--active" : ""}`}
                  onClick={() => handleSave({ defaultDifficulty: d })}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {saved && (
            <div className="pg-msg pg-msg--ok">Settings saved</div>
          )}
        </section>

        {/* ---- Cloud recording (Business plan only) - P0 ---- */}
        {hasBusinessPlan && (
          <section className="pg-card">
            <h2 className="pg-card__title">
              <IconCloud /> Cloud Recording <span className="pg-card__badge">Business</span>
            </h2>
            <p className="pg-card__desc">
              Store a copy of Professional video interviews in the cloud for compliance and audit. Uses LiveKit Egress to your storage (S3/GCS). Off by default; enable only if you need an audit trail.
            </p>
            <div className="pg-field">
              <label className="pg-toggle-row">
                <span className="pg-toggle-label">Enable cloud recording</span>
                <input
                  type="checkbox"
                  checked={settings.cloudRecordingEnabled}
                  onChange={(e) => {
                    const v = e.target.checked;
                    setSettings((prev) => ({ ...prev, cloudRecordingEnabled: v }));
                    handleSave({ cloudRecordingEnabled: v });
                  }}
                />
              </label>
            </div>
            {saved && (
              <div className="pg-msg pg-msg--ok">Settings saved</div>
            )}
          </section>
        )}

        {/* ---- LiveKit options (P1–P3) - Professional video interview ---- */}
        <section className="pg-card">
          <h2 className="pg-card__title">LiveKit options</h2>
          <p className="pg-card__desc">
            Toggle features for Professional video interviews (LiveKit room). Room metadata and simulcast are on by default; others are optional.
          </p>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Room metadata (P1)</span>
              <input
                type="checkbox"
                checked={settings.livekitRoomMetadataEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitRoomMetadataEnabled: v }));
                  handleSave({ livekitRoomMetadataEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Set interviewId/templateId on the room for webhooks and Egress.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Data channel (P2)</span>
              <input
                type="checkbox"
                checked={settings.livekitDataChannelEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitDataChannelEnabled: v }));
                  handleSave({ livekitDataChannelEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Send transcript/signals over LiveKit data channel.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Analytics (P2)</span>
              <input
                type="checkbox"
                checked={settings.livekitAnalyticsEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitAnalyticsEnabled: v }));
                  handleSave({ livekitAnalyticsEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Send connection quality samples to the backend.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Simulcast (P3)</span>
              <input
                type="checkbox"
                checked={settings.livekitSimulcastEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitSimulcastEnabled: v }));
                  handleSave({ livekitSimulcastEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Adaptive video quality for poor networks.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">E2EE (P3)</span>
              <input
                type="checkbox"
                checked={settings.livekitE2EEEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitE2EEEnabled: v }));
                  handleSave({ livekitE2EEEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">End-to-end encryption for the video room.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Observer tokens</span>
              <input
                type="checkbox"
                checked={settings.livekitObserverTokenAllowed}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitObserverTokenAllowed: v }));
                  handleSave({ livekitObserverTokenAllowed: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Allow HR to join as view-only observer in interview rooms.</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Screen share</span>
              <input
                type="checkbox"
                checked={settings.livekitScreenShareEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitScreenShareEnabled: v }));
                  handleSave({ livekitScreenShareEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Let candidate share screen in Professional interview (technical interviews).</span>
          </div>
          <div className="pg-field">
            <label className="pg-toggle-row">
              <span className="pg-toggle-label">Agents</span>
              <input
                type="checkbox"
                checked={settings.livekitAgentEnabled}
                onChange={(e) => {
                  const v = e.target.checked;
                  setSettings((prev) => ({ ...prev, livekitAgentEnabled: v }));
                  handleSave({ livekitAgentEnabled: v });
                }}
              />
            </label>
            <span className="pg-field-hint">Dispatch a LiveKit Agent to the room (voice/video AI in cloud). Requires LIVEKIT_AGENT_NAME.</span>
          </div>
          {saved && (
            <div className="pg-msg pg-msg--ok">Settings saved</div>
          )}
        </section>

        {/* ---- Data Management ---- */}
        <section className="pg-card pg-card--danger-zone">
          <h2 className="pg-card__title">
            <IconTrash /> Data Management
          </h2>

          {/* Clear Interview History */}
          <div className="pg-danger-row">
            <div>
              <p className="pg-danger-title">Clear Interview History</p>
              <p className="pg-danger-desc">Remove all saved interview records. This cannot be undone.</p>
            </div>
            {!confirmClearInt ? (
              <button className="pg-danger-btn" onClick={() => setConfirmClearInt(true)}>
                Clear
              </button>
            ) : (
              <div className="pg-confirm-group">
                <button className="pg-danger-btn pg-danger-btn--confirm" onClick={handleClearInterviews}>
                  Confirm
                </button>
                <button className="pg-danger-btn pg-danger-btn--cancel" onClick={() => setConfirmClearInt(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Clear Aptitude History */}
          <div className="pg-danger-row">
            <div>
              <p className="pg-danger-title">Clear Aptitude History</p>
              <p className="pg-danger-desc">Remove all saved aptitude test records. This cannot be undone.</p>
            </div>
            {!confirmClearApt ? (
              <button className="pg-danger-btn" onClick={() => setConfirmClearApt(true)}>
                Clear
              </button>
            ) : (
              <div className="pg-confirm-group">
                <button className="pg-danger-btn pg-danger-btn--confirm" onClick={handleClearAptitude}>
                  Confirm
                </button>
                <button className="pg-danger-btn pg-danger-btn--cancel" onClick={() => setConfirmClearApt(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Delete Account */}
          <div className="pg-danger-row pg-danger-row--delete">
            <div>
              <p className="pg-danger-title">Delete Account</p>
              <p className="pg-danger-desc">Permanently delete your account and all associated data.</p>
            </div>
            {!confirmDelete ? (
              <button className="pg-danger-btn pg-danger-btn--delete" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            ) : (
              <div className="pg-confirm-group">
                <button className="pg-danger-btn pg-danger-btn--confirm pg-danger-btn--delete" onClick={handleDeleteAccount}>
                  Delete Forever
                </button>
                <button className="pg-danger-btn pg-danger-btn--cancel" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---- About ---- */}
        <section className="pg-card">
          <h2 className="pg-card__title">
            <IconInfo /> About
          </h2>
          <div className="pg-about">
            <div className="pg-about-row">
              <span className="pg-about-label">Application</span>
              <span className="pg-about-value">VocalHireAI</span>
            </div>
            <div className="pg-about-row">
              <span className="pg-about-label">Version</span>
              <span className="pg-about-value">1.0.0</span>
            </div>
            <div className="pg-about-row">
              <span className="pg-about-label">Live Model</span>
              <span className="pg-about-value">
                {publicConfig?.geminiModel ?? (import.meta.env.VITE_GEMINI_MODEL ? `${import.meta.env.VITE_GEMINI_MODEL} (dev)` : "—")}
              </span>
            </div>
            <div className="pg-about-row">
              <span className="pg-about-label">Report Model</span>
              <span className="pg-about-value">
                {publicConfig?.geminiReportModel ?? (import.meta.env.VITE_GEMINI_REPORT_MODEL ? `${import.meta.env.VITE_GEMINI_REPORT_MODEL} (dev)` : "gemini-2.5-flash-lite")}
              </span>
            </div>
            <div className="pg-about-row">
              <span className="pg-about-label">Storage</span>
              <span className="pg-about-value">Local (localStorage)</span>
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}

// ---- Icons ----------------------------------------------------------------

function IconBrain() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1" />
      <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1" />
      <path d="M12 22v-6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconCloud() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}
