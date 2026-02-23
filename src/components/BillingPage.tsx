/**
 * BillingPage — Credit balance, packs, history, purchase.
 * INR (student) plans: Razorpay checkout. Students must provide college roll number.
 * Without purchase, no actions are allowed (gated on Dashboard).
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCreditsBalanceQuery,
  useGetCreditsPacksQuery,
  useGetCreditsHistoryQuery,
  useGetPricingPlansQuery,
  usePurchasePackMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
} from "../store/endpoints/credits";
import { useUpdateProfileMutation } from "../store/endpoints/users";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectUser, setUser } from "../store/authSlice";
import { useToast } from "./Toast";
import { BoltIcon } from "./AppLogo";
import { logErrorToServer } from "../lib/logError";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = RAZORPAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(s);
  });
}

export function BillingPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser)!;
  const toast = useToast();
  const { data: balance, isLoading: balanceLoading } = useGetCreditsBalanceQuery();
  const { data: packs } = useGetCreditsPacksQuery();
  const { data: history } = useGetCreditsHistoryQuery();
  const { data: plans } = useGetPricingPlansQuery();
  const [purchaseSimulate, { isLoading: purchasingSimulate }] = usePurchasePackMutation();
  const [createOrder, { isLoading: creatingOrder }] = useCreateRazorpayOrderMutation();
  const [verifyPayment, { isLoading: verifying }] = useVerifyRazorpayPaymentMutation();
  const [updateProfile] = useUpdateProfileMutation();

  const [rollModal, setRollModal] = useState<{ planId: string; planName: string } | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [rollError, setRollError] = useState("");

  const totalInterview =
    (balance?.technical ?? 0) +
    (balance?.hr ?? 0) +
    (balance?.behavioral ?? 0) +
    (balance?.general ?? 0);
  const hasAnyCredits = totalInterview > 0 || (balance?.aptitude ?? 0) > 0 || (balance?.coding ?? 0) > 0;

  const isStudent = user?.role === "CANDIDATE";
  const needsRollNumber = isStudent && !(user?.collegeRollNumber?.trim());

  const openRazorpayCheckout = useCallback(
    async (planId: "LITE" | "PRO" | "ELITE", collegeRollNumber?: string | null) => {
      try {
        await loadRazorpayScript();
        const orderData = await createOrder({
          plan: planId,
          collegeRollNumber: collegeRollNumber ?? user?.collegeRollNumber ?? undefined,
        }).unwrap();

        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          order_id: orderData.orderId,
          name: "VocalHireAI",
          description: `Credit pack: ${planId}`,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await verifyPayment({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }).unwrap();
              toast.success("Payment successful! Your credits have been added.");
            } catch (e: any) {
              const msg = e?.data?.error || "Payment verification failed.";
              toast.error(msg);
              logErrorToServer(msg, { source: "billing" });
            }
          },
          modal: {
            ondismiss: () => {},
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (e: any) {
        const msg = e?.data?.error || e?.message || "Failed to start checkout";
        toast.error(msg);
        logErrorToServer(msg, { source: "billing" });
      }
    },
    [createOrder, verifyPayment, user?.collegeRollNumber, toast],
  );

  const handleInrPurchase = async (planId: string, planName: string) => {
    if (needsRollNumber) {
      setRollModal({ planId, planName });
      setRollNumber(user?.collegeRollNumber ?? "");
      setRollError("");
      return;
    }
    await openRazorpayCheckout(planId as "LITE" | "PRO" | "ELITE");
  };

  const handleSubmitRollNumber = async () => {
    const trimmed = rollNumber.trim();
    if (!trimmed) {
      setRollError("Please enter your college roll number.");
      return;
    }
    setRollError("");
    try {
      await updateProfile({ collegeRollNumber: trimmed }).unwrap();
      dispatch(setUser({ ...user, collegeRollNumber: trimmed }));
      const planToOpen = rollModal!.planId;
      setRollModal(null);
      await openRazorpayCheckout(planToOpen as "LITE" | "PRO" | "ELITE", trimmed);
    } catch (e: any) {
      const msg = e?.data?.error || "Failed to save. Try again.";
      setRollError(msg);
      logErrorToServer(msg, { source: "billing" });
    }
  };

  const handleUsdPurchase = async (plan: string, quantity?: number) => {
    try {
      await purchaseSimulate({ plan, quantity, simulate: true }).unwrap();
      toast.success("Credits added (simulated). In production use Stripe.");
    } catch (e: any) {
      const msg = e?.data?.error || "Purchase failed.";
      toast.error(msg);
      logErrorToServer(msg, { source: "billing" });
    }
  };

  const purchasing = creatingOrder || verifying || purchasingSimulate;

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
        <div className="dash__welcome">
          <h1 className="dash__welcome-title">Billing & Credits</h1>
          <p className="dash__welcome-sub">
            View your credit balance, buy packs, and manage usage.
          </p>
        </div>

        <section className="billing-section">
          <h2 className="billing-section__title">Your credit balance</h2>
          {balanceLoading ? (
            <p>Loading…</p>
          ) : (
            <div className="billing-balance">
              <div className="billing-balance__row">
                <span>Technical</span>
                <strong>{balance?.technical ?? 0}</strong>
              </div>
              <div className="billing-balance__row">
                <span>HR</span>
                <strong>{balance?.hr ?? 0}</strong>
              </div>
              <div className="billing-balance__row">
                <span>Behavioral</span>
                <strong>{balance?.behavioral ?? 0}</strong>
              </div>
              <div className="billing-balance__row">
                <span>General</span>
                <strong>{balance?.general ?? 0}</strong>
              </div>
              <div className="billing-balance__row">
                <span>Aptitude tests</span>
                <strong>{balance?.aptitude ?? 0}</strong>
              </div>
              <div className="billing-balance__row">
                <span>Coding challenges</span>
                <strong>{balance?.coding ?? 0}</strong>
              </div>
            </div>
          )}
          {!hasAnyCredits && !balanceLoading && (
            <p className="billing-empty">No credits yet. Purchase a plan to unlock interviews, aptitude tests, and coding challenges.</p>
          )}
        </section>

        <section className="billing-section">
          <h2 className="billing-section__title">Buy credits</h2>
          {plans?.inr?.length ? (
            <>
              <h3 className="billing-section__subtitle">Student plans (INR)</h3>
              <div className="billing-plans">
            {plans.inr.map((p) => (
              <div key={p.id} className="billing-plan-card">
                <div className="billing-plan-card__name">{p.name}</div>
                <div className="billing-plan-card__price">₹{p.priceDisplay}</div>
                <div className="billing-plan-card__meta">
                  {(p.interviewAllocation?.technical ?? 0) + (p.interviewAllocation?.hr ?? 0) + (p.interviewAllocation?.behavioral ?? 0) + (p.interviewAllocation?.general ?? 0)} interviews
                  {" · "}{p.aptitudeTotal} aptitude{" · "}{p.codingTotal} coding
                </div>
                {isStudent && (
                  <p className="billing-plan-card__note">Students: college roll number required</p>
                )}
                <button
                  className="billing-plan-card__btn"
                  disabled={purchasing}
                  onClick={() => handleInrPurchase(p.id, p.name)}
                >
                  {purchasing ? "…" : "Pay with Razorpay"}
                </button>
              </div>
            ))}
              </div>
            </>
          ) : null}
          {plans?.usd?.length ? (
            <>
              <h3 className="billing-section__subtitle">Company plans (USD)</h3>
              <div className="billing-plans">
            {plans.usd.slice(0, 2).map((p) => (
              <div key={p.id} className="billing-plan-card">
                <div className="billing-plan-card__name">{p.name}</div>
                <div className="billing-plan-card__price">${p.priceDisplay}/interview</div>
                <div className="billing-plan-card__meta">
                  Min {p.minCredits ?? 1}{" · "}{p.aptitudeTotal} aptitude{" · "}{p.codingTotal} coding
                </div>
                <button
                  className="billing-plan-card__btn billing-plan-card__btn--secondary"
                  disabled={purchasing}
                  onClick={() => handleUsdPurchase(p.id, p.minCredits)}
                >
                  {purchasing ? "…" : "Get credits (test)"}
                </button>
              </div>
            ))}
              </div>
            </>
          ) : null}
          {(!plans?.inr?.length && !plans?.usd?.length) && <p className="billing-empty">No plans available.</p>}
        </section>

        {packs && packs.length > 0 && (
          <section className="billing-section">
            <h2 className="billing-section__title">Your packs</h2>
            <ul className="billing-packs">
              {packs.map((pack: any) => (
                <li key={pack.id} className="billing-pack">
                  <span>{pack.plan}</span>
                  <span>{pack.status}</span>
                  <span>Expires {new Date(pack.expiresAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {history && history.length > 0 && (
          <section className="billing-section">
            <h2 className="billing-section__title">Recent usage</h2>
            <ul className="billing-history">
              {history.slice(0, 15).map((log: any) => (
                <li key={log.id}>
                  {log.type} — {new Date(log.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* College roll number modal for students */}
      {rollModal && (
        <div className="billing-modal-overlay" onClick={() => setRollModal(null)}>
          <div className="billing-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="billing-modal__title">College roll number required</h3>
            <p className="billing-modal__text">
              Students must provide their college roll number to purchase {rollModal.planName}.
            </p>
            <input
              type="text"
              className="auth-input"
              placeholder="Enter roll number"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              autoFocus
            />
            {rollError && <p className="billing-modal__error">{rollError}</p>}
            <div className="billing-modal__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setRollModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" onClick={handleSubmitRollNumber}>
                Continue to payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
