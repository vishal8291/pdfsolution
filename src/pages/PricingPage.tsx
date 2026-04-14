import { useState } from "react";
import { FaCheckCircle, FaShieldAlt, FaStar } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { authHeaders, fetchJson, loadRazorpayScript, resolveError } from "../lib/api";
import type { RazorpayCheckoutPayload, RazorpayResponse, SessionUser } from "../lib/types";

const FAQ = [
  { q: "Can I cancel my plan anytime?", a: "Yes. You can cancel at any time from your account dashboard. Your access continues until the end of the billing period." },
  { q: "Is there a free trial for paid plans?", a: "Our Starter plan is free forever. You can try all core tools without a credit card." },
  { q: "How is billing handled?", a: "We use Razorpay for secure billing. Your card details are never stored on our servers." },
  { q: "What happens to my data?", a: "Core PDF tools run entirely in your browser. For account features, data is stored securely with encryption." },
  { q: "Do I need an account to use PDF tools?", a: "No. All core tools are available without an account. An account unlocks the dashboard, history, and premium features." },
];

export default function PricingPage() {
  const { user, plans, openAuth, setUser } = useAuth();
  const [planStatus, setPlanStatus] = useState("");
  const [planSuccess, setPlanSuccess] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleCheckout(planId: "pro" | "team") {
    if (!user) { openAuth("login"); return; }
    setLoadingPlanId(planId); setPlanStatus(""); setPlanSuccess(false);
    try {
      const ready = await loadRazorpayScript();
      if (!ready || !window.Razorpay) throw new Error("Unable to load Razorpay checkout. Please try again.");

      const result = await fetchJson<RazorpayCheckoutPayload>("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ planId }),
      });

      const rp = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: result.name,
        description: result.description,
        order_id: result.orderId,
        prefill: result.prefill,
        notes: result.notes,
        theme: { color: "#ef4444" },
        handler: async (response: RazorpayResponse) => {
          try {
            // Verify payment on server and upgrade user plan
            const verified = await fetchJson<{ success: boolean; user?: SessionUser; message: string }>(
              "/api/billing/verify-payment",
              {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  planId,
                }),
              }
            );
            if (verified.user) setUser(verified.user);
            setPlanSuccess(true);
            setPlanStatus(`🎉 ${verified.message ?? "You're now on the " + planId + " plan!"}`);
          } catch (err) {
            setPlanStatus("Payment received but verification failed. Please contact support with Payment ID: " + response.razorpay_payment_id);
          }
        },
        modal: { ondismiss: () => setPlanStatus("Checkout cancelled. You can try again anytime.") },
      });
      rp.open();
    } catch (err) {
      setPlanStatus(resolveError(err, "Billing service is not available right now."));
    } finally {
      setLoadingPlanId(null);
    }
  }

  return (
    <main className="pricing-page">
      {/* Header */}
      <section className="pricing-hero">
        <div className="container">
          <p className="section-eyebrow">Pricing</p>
          <h1>Simple, transparent pricing</h1>
          <p className="pricing-hero-sub">Start free and upgrade when you need more. No hidden fees, no surprises.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="pricing-plans-section">
        <div className="container">
          <div className="plans-grid">
            {plans.map((plan) => (
              <article key={plan.id} className={`plan-card ${plan.id === "pro" ? "plan-featured" : ""}`}>
                {plan.id === "pro" && <div className="plan-popular-badge"><FaStar /> Most Popular</div>}
                <div className="plan-header">
                  <h2 className="plan-title">{plan.title}</h2>
                  <div className="plan-price">
                    <span className="plan-price-amount">{plan.priceLabel}</span>
                    <span className="plan-price-interval">/{plan.interval}</span>
                  </div>
                  <p className="plan-desc">{plan.description}</p>
                </div>
                <ul className="plan-features">
                  {plan.features.map((f) => (
                    <li key={f}><FaCheckCircle className="plan-check" />{f}</li>
                  ))}
                </ul>
                <div className="plan-action">
                  {plan.id === "free" ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-full"
                      onClick={() => !user && openAuth("signup")}
                    >
                      {user ? "Current Plan" : "Get Started Free"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-full"
                      onClick={() => void handleCheckout(plan.id as "pro" | "team")}
                      disabled={loadingPlanId === plan.id}
                    >
                      {loadingPlanId === plan.id ? "Opening checkout…" : plan.cta}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {planStatus && (
            <p className={`pricing-status-msg ${planSuccess ? "success" : "error"}`}>{planStatus}</p>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="pricing-trust-strip">
        <div className="container trust-strip-inner">
          <div className="trust-strip-item"><FaShieldAlt /><span>Secure Razorpay billing</span></div>
          <div className="trust-strip-item"><FaCheckCircle /><span>Cancel anytime</span></div>
          <div className="trust-strip-item"><FaCheckCircle /><span>No credit card for Starter</span></div>
          <div className="trust-strip-item"><FaShieldAlt /><span>256-bit encrypted payments</span></div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pricing-faq-section">
        <div className="container">
          <h2 className="faq-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQ.map((item, i) => (
              <div key={i} className={`faq-item ${openFaq === i ? "open" : ""}`}>
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  {item.q}
                  <span className="faq-chevron">{openFaq === i ? "−" : "+"}</span>
                </button>
                {openFaq === i && <p className="faq-answer">{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
