/**
 * FullInterviewFlowPage — Entry point for the full interview flow.
 *
 * Flow: Select template → Aptitude (20 min) → AI Video Interview (20 min, using template) → Coding (20 min, max 3 submissions).
 * The selected template is used for the AI video interview and as context for the coding round.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../store/hooks";
import { setTemplateForFullFlow } from "../store/interviewSlice";
import { initFullFlowReport } from "../lib/fullFlowStorage";
import { useListTemplatesQuery } from "../store/endpoints/templates";
import type { Template } from "../store/endpoints/templates";
import { BoltIcon } from "./AppLogo";

const CATEGORIES = [
  { key: "software", label: "Software & Tech", icon: "💻" },
  { key: "mba", label: "MBA & Management", icon: "📊" },
  { key: "vlsi", label: "VLSI & Semiconductor", icon: "🔬" },
  { key: "general", label: "General", icon: "📋" },
] as const;

function getCategoryForTemplate(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith("software:") || lower.startsWith("tech:")) return "software";
  if (lower.startsWith("mba:") || lower.startsWith("management:")) return "mba";
  if (lower.startsWith("vlsi:") || lower.startsWith("semiconductor:")) return "vlsi";
  if (lower.startsWith("general:")) return "general";
  if (/engineer|developer|devops|qa|cloud|cyber|game|embedded|blockchain|architect|sre|crm|erp|support|ai\/ml|ui\/ux/i.test(lower)) return "software";
  if (/manager|analyst|consultant|marketing|hr |finance|operations|sales|product|strategy|supply|project/i.test(lower)) return "mba";
  if (/vlsi|physical design|verification|dft|analog/i.test(lower)) return "vlsi";
  return "general";
}

function stripPrefix(name: string): string {
  return name.replace(/^(Software|MBA|Management|VLSI|Semiconductor|General|Custom|Tech):\s*/i, "");
}

const STEPS = [
  { num: 1, title: "Aptitude Test", desc: "20 min · MCQ · Proctored" },
  { num: 2, title: "AI Video Interview", desc: "20 min · Native voice + webcam · Uses your chosen template" },
  { num: 3, title: "Coding Round", desc: "20 min · Max 3 submissions · Proctored" },
] as const;

export function FullInterviewFlowPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [activeCategory, setActiveCategory] = useState("software");
  const { data: templatesData, isLoading } = useListTemplatesQuery({ limit: 100 });

  const groupedTemplates = useMemo(() => {
    const templates = templatesData?.data || [];
    const groups: Record<string, Template[]> = {};
    for (const cat of CATEGORIES) groups[cat.key] = [];
    for (const t of templates) {
      const cat = getCategoryForTemplate(t.name);
      if (groups[cat]) groups[cat]!.push(t);
      else groups["general"]!.push(t);
    }
    return groups;
  }, [templatesData]);

  const handleSelectTemplate = (t: Template) => {
    initFullFlowReport(t.name);
    dispatch(
      setTemplateForFullFlow({
        template: {
          aiBehavior: t.aiBehavior,
          customerWants: t.customerWants,
          candidateOffers: "", // Candidate fills resume at video step
        },
        templateId: t.id,
        templateName: t.name,
      }),
    );
    navigate("/aptitude", { state: { fromFullFlow: true } });
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
        <div className="full-flow">
          <h1 className="full-flow__title">Full Interview Flow</h1>
          <p className="full-flow__sub">
            Choose a template for your AI video interview and coding round. Then complete: Aptitude → Video Interview → Coding.
          </p>

          <ol className="full-flow__steps">
            {STEPS.map((step) => (
              <li key={step.num} className="full-flow__step">
                <span className="full-flow__step-num">{step.num}</span>
                <div className="full-flow__step-body">
                  <strong className="full-flow__step-title">{step.title}</strong>
                  <span className="full-flow__step-desc">{step.desc}</span>
                </div>
              </li>
            ))}
          </ol>

          <h2 className="full-flow__pick-title">Select a template for the video interview and coding round</h2>

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

          {isLoading ? (
            <div className="tpl-loading">Loading templates...</div>
          ) : (
            <div className="tpl-grid full-flow__tpl-grid">
              {(groupedTemplates[activeCategory] || []).map((t) => (
                <button key={t.id} className="tpl-card" onClick={() => handleSelectTemplate(t)}>
                  <h3 className="tpl-card__title">{stripPrefix(t.name)}</h3>
                  <p className="tpl-card__jd">{t.customerWants.slice(0, 120)}{t.customerWants.length > 120 ? "..." : ""}</p>
                  <span className="tpl-card__arrow">Use this template →</span>
                </button>
              ))}
              {(groupedTemplates[activeCategory] || []).length === 0 && (
                <div className="tpl-empty">No templates in this category yet.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
