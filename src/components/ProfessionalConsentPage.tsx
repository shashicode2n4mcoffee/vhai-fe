/**
 * ProfessionalConsentPage — Consent step before LiveKit + Gemini Live session.
 * User arrives here after completing the template form (professional variant).
 * On "I agree and start" we fetch LiveKit token and navigate to session.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetLiveKitConfigQuery, useGetLiveKitTokenMutation } from "../store/endpoints/livekit";
import { Navigate } from "react-router-dom";
import { useAppSelector } from "../store/hooks";
import { selectTemplate, selectInterviewId } from "../store/interviewSlice";

export function ProfessionalConsentPage() {
  const navigate = useNavigate();
  const template = useAppSelector(selectTemplate);
  const interviewId = useAppSelector(selectInterviewId);
  const { data: config } = useGetLiveKitConfigQuery();
  const [getToken, { isLoading }] = useGetLiveKitTokenMutation();
  const [error, setError] = useState<string | null>(null);
  const [dataSaver, setDataSaver] = useState(false);

  // Must have completed template step (template + interview in Redux)
  if (!template) {
    return <Navigate to="/interview/professional/new" replace />;
  }
  if (!interviewId) {
    return <Navigate to="/interview/professional/new" replace />;
  }

  if (!config?.enabled) {
    return (
      <div className="pro-landing">
        <div className="pro-landing__card">
          <h1 className="pro-landing__title">LiveKit not configured</h1>
          <p className="pro-landing__desc">Professional video interview is not available. Contact your administrator.</p>
          <button type="button" className="btn btn--secondary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleStart = async () => {
    setError(null);
    try {
      const { token, url, roomName, agentDispatched } = await getToken({
        interviewId,
        templateId: template.id,
        participantName: "Candidate",
      }).unwrap();
      navigate("/interview/professional/session", {
        state: { token, url, roomName, dataSaver, agentDispatched: agentDispatched === true },
      });
    } catch (e) {
      const msg =
        e && typeof e === "object" && "data" in e
          ? (e as { data?: { error?: string } }).data?.error
          : null;
      setError(msg || "Failed to start. Please try again.");
    }
  };

  return (
    <div className="pro-landing">
      <div className="pro-landing__card pro-consent-card">
        <h1 className="pro-landing__title">Interview consent</h1>
        <p className="pro-landing__desc">
          Before we begin your <strong>Professional Video Interview</strong>, please read and accept the following.
        </p>
        <ul className="voice-chat__consent-list" style={{ textAlign: "left", marginBottom: "1.5rem" }}>
          <li>
            <strong>Recording:</strong> This session will be recorded (audio and video). The recording may be shared with the hiring organization and used for evaluation.
          </li>
          <li>
            <strong>AI evaluation:</strong> Your responses will be transcribed and evaluated using AI. The report may be shared with the hiring organization.
          </li>
          <li>
            <strong>Video call:</strong> You will join a live video room (LiveKit) and an AI voice interview (Gemini Live). Camera and microphone are required.
          </li>
          <li>
            <strong>Your consent:</strong> By clicking &quot;I agree and start interview&quot;, you confirm that you have read this notice and consent to recording and the above data practices.
          </li>
        </ul>
        <label className="pro-consent__data-saver">
          <input
            type="checkbox"
            checked={dataSaver}
            onChange={(e) => setDataSaver(e.target.checked)}
          />
          <span>Use <strong>data saver</strong> (lower video quality for slow or mobile networks)</span>
        </label>
        {error && <p className="pro-landing__error">{error}</p>}
        <div className="pro-landing__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleStart}
            disabled={isLoading}
          >
            {isLoading ? "Starting…" : "I agree and start interview"}
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => navigate("/interview/professional/new")}>
            Back to templates
          </button>
        </div>
      </div>
    </div>
  );
}
