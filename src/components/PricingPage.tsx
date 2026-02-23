/**
 * PricingPage — Public pricing with USD (Companies) and INR (Students) tabs.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGetPricingPlansQuery } from "../store/endpoints/credits";
import { BoltIcon } from "./AppLogo";

export function PricingPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"usd" | "inr">("usd");
  const { data: plans, isLoading } = useGetPricingPlansQuery();

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <div className="pricing-header__inner">
          <a href="/" className="lp-nav__brand pricing-header__brand" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <div className="lp-nav__logo">
              <BoltIcon />
            </div>
            <span className="lp-nav__name">VocalHireAI</span>
          </a>
          <div className="pricing-header__actions">
            <button className="pricing-header__btn" onClick={() => navigate("/login")}>Log In</button>
            <button className="pricing-header__btn pricing-header__btn--primary" onClick={() => navigate("/signup")}>Sign Up</button>
          </div>
        </div>
      </header>

      <main className="pricing-main">
        <h1 className="pricing-title">Simple, transparent pricing</h1>
        <p className="pricing-sub">Pay per interview. No subscriptions. Credits valid 1 year.</p>

        <div className="pricing-tabs">
          <button
            className={`pricing-tab ${tab === "usd" ? "pricing-tab--active" : ""}`}
            onClick={() => setTab("usd")}
          >
            Companies & Professionals (USD)
          </button>
          <button
            className={`pricing-tab ${tab === "inr" ? "pricing-tab--active" : ""}`}
            onClick={() => setTab("inr")}
          >
            Students (INR)
          </button>
        </div>

        {isLoading ? (
          <div className="pricing-loading">Loading plans…</div>
        ) : (
          <div className="pricing-grid">
            {(tab === "usd" ? plans?.usd : plans?.inr)?.map((plan) => (
              <div key={plan.id} className="pricing-card">
                <h2 className="pricing-card__name">{plan.name}</h2>
                <p className="pricing-card__desc">{plan.description}</p>
                <div className="pricing-card__price">
                  {plan.currency === "USD" ? "$" : "₹"}
                  {plan.priceDisplay}
                  {plan.packSizes ? (
                    <span className="pricing-card__price-note">/interview (min {plan.minCredits})</span>
                  ) : plan.packSize ? (
                    <span className="pricing-card__price-note"> per pack of {plan.packSize} interviews</span>
                  ) : null}
                </div>
                <ul className="pricing-card__features">
                  <li>Interviews: {plan.interviewAllocation.technical + plan.interviewAllocation.hr + plan.interviewAllocation.behavioral + plan.interviewAllocation.general}</li>
                  <li>Aptitude: {plan.aptitudeTotal} tests</li>
                  <li>Coding: {plan.codingTotal} challenges</li>
                  <li>Report: {plan.reportSections} sections</li>
                </ul>
                <button
                  className="pricing-card__cta"
                  onClick={() => navigate("/signup")}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
