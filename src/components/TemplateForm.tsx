/**
 * TemplateForm — Interview setup page.
 *
 * Two-step flow:
 *   Step 1: Browse pre-built templates by category, select one (or custom)
 *   Step 2: Edit 3 sections:
 *     1. AI Behavior — how the AI interviewer should behave (pre-filled)
 *     2. Job Description — 300 char JD (pre-filled from template)
 *     3. Candidate Resume — paste resume text (candidate fills in)
 *
 * On submit: creates template + interview via API, stores in Redux, navigates to VoiceChat.
 */

import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { ConversationTemplate } from "../types/gemini";
import { useAppDispatch } from "../store/hooks";
import { setTemplate as storeTemplate, setInterviewId, setGuardrails } from "../store/interviewSlice";
import { useCreateTemplateMutation } from "../store/endpoints/templates";
import { useCreateInterviewMutation } from "../store/endpoints/interviews";
import { useListTemplatesQuery } from "../store/endpoints/templates";
import { BoltIcon } from "./AppLogo";

// ── Category definitions ──────────────────────────────────────

const CATEGORIES = [
  { key: "software", label: "Software & Tech", icon: "💻", range: [1, 20] },
  { key: "mba", label: "MBA & Management", icon: "📊", range: [21, 30] },
  { key: "vlsi", label: "VLSI & Semiconductor", icon: "🔬", range: [31, 35] },
  { key: "general", label: "General", icon: "📋", range: [36, 40] },
  { key: "custom", label: "Custom", icon: "✏️", range: [41, 41] },
] as const;

function getCategoryForTemplate(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("software:") || lower.startsWith("tech:")) return "software";
  if (lower.startsWith("mba:") || lower.startsWith("management:")) return "mba";
  if (lower.startsWith("vlsi:") || lower.startsWith("semiconductor:")) return "vlsi";
  if (lower.startsWith("general:")) return "general";
  if (lower.startsWith("custom:")) return "custom";
  // Fallback: detect by keywords
  if (/engineer|developer|devops|qa|cloud|cyber|game|embedded|blockchain|architect|sre|crm|erp|support|ai\/ml|ui\/ux/i.test(lower)) return "software";
  if (/manager|analyst|consultant|marketing|hr |finance|operations|sales|product|strategy|supply|project/i.test(lower)) return "mba";
  if (/vlsi|physical design|verification|dft|analog/i.test(lower)) return "vlsi";
  if (/remote|intern|immediate|general|position/i.test(lower)) return "general";
  return "general";
}

function stripPrefix(name: string): string {
  return name.replace(/^(Software|MBA|Management|VLSI|Semiconductor|General|Custom|Tech):\s*/i, "");
}

// ── Component ─────────────────────────────────────────────────

export interface TemplateFormProps {
  /** When "professional", submit goes to Professional consent (LiveKit flow) instead of standard session. */
  variant?: "standard" | "professional";
}

export function TemplateForm({ variant = "standard" }: TemplateFormProps) {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [createTemplate] = useCreateTemplateMutation();
  const [createInterview] = useCreateInterviewMutation();

  // Fetch public templates from backend
  const { data: templatesData, isLoading: loadingTemplates } = useListTemplatesQuery({ limit: 100 });

  // State
  const [step, setStep] = useState<"pick" | "edit">("pick");
  const [activeCategory, setActiveCategory] = useState("software");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [template, setTemplate] = useState<ConversationTemplate>({
    aiBehavior: "",
    customerWants: "",
    candidateOffers: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interviewType, setInterviewType] = useState<"TECHNICAL" | "HR" | "BEHAVIORAL" | "GENERAL">("GENERAL");

  // Group templates by category
  const groupedTemplates = useMemo(() => {
    const templates = templatesData?.data || [];
    const groups: Record<string, typeof templates> = {};
    for (const cat of CATEGORIES) groups[cat.key] = [];
    for (const t of templates) {
      const cat = getCategoryForTemplate(t.name);
      if (groups[cat]) groups[cat]!.push(t);
      else groups["general"]!.push(t);
    }
    return groups;
  }, [templatesData]);

  // Handlers
  const handleSelectTemplate = (t: { aiBehavior: string; customerWants: string; id: string }) => {
    setSelectedTemplateId(t.id);
    setTemplate({
      aiBehavior: t.aiBehavior,
      customerWants: t.customerWants,
      candidateOffers: "", // Candidate fills in resume
    });
    setStep("edit");
  };

  const handleCustom = () => {
    setSelectedTemplateId(null);
    setTemplate({
      aiBehavior: "You are a professional AI interviewer. Conduct a thorough and fair interview. Ask relevant questions based on the job description and candidate's resume. Be professional, friendly, and probe for depth.",
      customerWants: "",
      candidateOffers: "",
    });
    setStep("edit");
  };

  const handleChange = (key: keyof ConversationTemplate, value: string) => {
    if (key === "customerWants" && value.length > 300) return; // 300 char limit on JD
    setTemplate((prev) => ({ ...prev, [key]: value }));
  };

  const allFilled = template.aiBehavior.trim() && template.customerWants.trim() && template.candidateOffers.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allFilled || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const createdTemplate = await createTemplate({
        name: `Interview ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`,
        aiBehavior: template.aiBehavior,
        customerWants: template.customerWants,
        candidateOffers: template.candidateOffers,
      }).unwrap();
      const interview = await createInterview({
        templateId: createdTemplate.id,
        interviewType,
      }).unwrap();
      dispatch(storeTemplate(template));
      dispatch(setInterviewId(interview.id));
      dispatch(setGuardrails(interview.guardrails ?? null));
      if (variant === "professional") {
        navigate("/interview/professional/consent");
      } else {
        navigate("/interview/session");
      }
    } catch (err: unknown) {
      const anyErr = err as { status?: number; data?: { error?: string; upgradeUrl?: string } };
      if (anyErr.status === 402 || (anyErr.data?.upgradeUrl && anyErr.data?.error)) {
        setError("No interview credits. Please purchase a plan.");
        setTimeout(() => navigate("/billing"), 1500);
      } else {
        const msg = anyErr.data?.error ?? (err instanceof Error ? err.message : "Failed to start interview");
        setError(msg);
        const { logErrorToServer } = await import("../lib/logError");
        logErrorToServer(msg, { details: err instanceof Error ? err.stack : undefined, source: "interview" });
      }
    } finally {
      setIsSubmitting(false);
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
          <button type="button" className="dash__topbar-btn" onClick={() => step === "edit" ? setStep("pick") : navigate(variant === "professional" ? "/interview/professional" : "/dashboard")}>
            {step === "edit" ? "← Back to Templates" : variant === "professional" ? "← Professional Interview" : "← Dashboard"}
          </button>
        </div>
      </header>

      <div className="dash__content">
        <div className="template-form-wrapper">
        {/* ───── STEP 1: Template Picker ───── */}
        {step === "pick" && (
          <>
            <header className="template-header">
              <h1 className="template-header__title">
                {variant === "professional" ? "Professional Video Interview — Choose Template" : "Choose Interview Template"}
              </h1>
              <p className="template-header__subtitle">
                {variant === "professional"
                  ? "Select a template for your LiveKit video + AI voice interview. You will see consent next, then join the video call."
                  : "Select a job role template to get started. The AI interviewer will be configured automatically."}
              </p>
            </header>

            {/* Category Tabs */}
            <div className="tpl-categories">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={`tpl-category-tab ${activeCategory === cat.key ? "tpl-category-tab--active" : ""}`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  <span className="tpl-category-tab__icon">{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="tpl-category-tab__count">{groupedTemplates[cat.key]?.length || 0}</span>
                </button>
              ))}
            </div>

            {/* Template Cards */}
            {loadingTemplates ? (
              <div className="tpl-loading">Loading templates...</div>
            ) : (
              <div className="tpl-grid">
                {(groupedTemplates[activeCategory] || []).map((t) => (
                  <button key={t.id} className="tpl-card" onClick={() => handleSelectTemplate(t)}>
                    <h3 className="tpl-card__title">{stripPrefix(t.name)}</h3>
                    <p className="tpl-card__jd">{t.customerWants.slice(0, 120)}{t.customerWants.length > 120 ? "..." : ""}</p>
                    <span className="tpl-card__arrow">Select &rarr;</span>
                  </button>
                ))}

                {/* Custom card always visible */}
                {activeCategory === "custom" && (
                  <button className="tpl-card tpl-card--custom" onClick={handleCustom}>
                    <h3 className="tpl-card__title">Create Custom Template</h3>
                    <p className="tpl-card__jd">Define your own job description, AI behavior, and interview criteria from scratch.</p>
                    <span className="tpl-card__arrow">Create &rarr;</span>
                  </button>
                )}

                {(groupedTemplates[activeCategory] || []).length === 0 && activeCategory !== "custom" && (
                  <div className="tpl-empty">No templates in this category yet.</div>
                )}
              </div>
            )}
          </>
        )}

        {/* ───── STEP 2: 3-Section Form ───── */}
        {step === "edit" && (
          <>
            <header className="template-header">
              <h1 className="template-header__title">
                {variant === "professional" ? "Configure Professional Interview" : "Configure Interview"}
              </h1>
              <p className="template-header__subtitle">
                Review the AI behavior, edit the job description, and paste your resume.
              </p>
            </header>

            <form className="template-form" onSubmit={handleSubmit}>
              {/* Interview type (for credit deduction) */}
              <div className="template-section">
                <label className="template-section__header">
                  <span className="template-section__number">0</span>
                  Interview type
                </label>
                <p className="template-section__hint">One credit will be deducted for the selected type.</p>
                <div className="tpl-interview-types">
                  {(["GENERAL", "TECHNICAL", "HR", "BEHAVIORAL"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`tpl-type-btn ${interviewType === type ? "tpl-type-btn--active" : ""}`}
                      onClick={() => setInterviewType(type)}
                    >
                      {type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              {/* Section 1: AI Behavior */}
              <div className="template-section">
                <div className="template-section__header">
                  <span className="template-section__number">1</span>
                  <span className="template-section__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" />
                      <path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="template-section__label">AI Interviewer Behavior</h2>
                    <p className="template-section__desc">How the AI interviewer should conduct this interview. This is strictly followed.</p>
                  </div>
                </div>
                <textarea
                  className="template-section__textarea"
                  rows={4}
                  placeholder="e.g. You are a senior technical interviewer. Ask questions about system design, algorithms, and coding. Be professional and probe for depth."
                  value={template.aiBehavior}
                  onChange={(e) => handleChange("aiBehavior", e.target.value)}
                />
              </div>

              {/* Section 2: Job Description */}
              <div className="template-section">
                <div className="template-section__header">
                  <span className="template-section__number">2</span>
                  <span className="template-section__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="template-section__label">Job Description</h2>
                    <p className="template-section__desc">Brief JD for the role (max 300 characters). AI uses this to ask relevant questions.</p>
                  </div>
                </div>
                <textarea
                  className="template-section__textarea"
                  rows={3}
                  maxLength={300}
                  placeholder="e.g. Software Engineer. Skills: React, Node.js, TypeScript. Build scalable web apps, collaborate with teams. 3+ years experience required."
                  value={template.customerWants}
                  onChange={(e) => handleChange("customerWants", e.target.value)}
                />
                <div className="template-section__charcount">
                  {template.customerWants.length}/300
                </div>
              </div>

              {/* Section 3: Candidate Resume */}
              <div className="template-section">
                <div className="template-section__header">
                  <span className="template-section__number">3</span>
                  <span className="template-section__icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="template-section__label">Your Resume</h2>
                    <p className="template-section__desc">Paste your resume in plain text. AI will reference this to ask personalized questions.</p>
                  </div>
                </div>
                <textarea
                  className="template-section__textarea template-section__textarea--tall"
                  rows={8}
                  placeholder={"Paste your resume here...\n\nExample:\nJohn Doe | Software Engineer | 4 years experience\nSkills: React, Node.js, TypeScript, AWS\nEducation: B.Tech Computer Science, XYZ University\nExperience:\n- Built scalable microservices at ABC Corp\n- Led a team of 5 developers\n- Implemented CI/CD pipelines"}
                  value={template.candidateOffers}
                  onChange={(e) => handleChange("candidateOffers", e.target.value)}
                />
              </div>

              {/* Interview Info Banner */}
              <div className="tpl-info-banner">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <strong>Interview Rules:</strong> Maximum 30 minutes with automatic wrap-up.
                  Your video is recorded locally for your review only — we do not save it on our servers.
                </div>
              </div>

              {error && <div className="apt-error">{error}</div>}

              <button
                type="submit"
                className="btn btn--start template-form__submit"
                disabled={!allFilled || isSubmitting}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
                <span>
                  {isSubmitting
                    ? (variant === "professional" ? "Continuing..." : "Starting Interview...")
                    : variant === "professional"
                      ? "Continue to consent"
                      : "Start Interview"}
                </span>
              </button>
            </form>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
