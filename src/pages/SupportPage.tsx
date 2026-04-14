import { FormEvent, useState } from "react";
import { FaCheckCircle, FaEnvelope, FaHeadset, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { authHeaders, CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, resolveError } from "../lib/api";

type SupportForm = { name: string; email: string; subject: string; message: string };

const TOPICS = [
  { icon: <FaHeadset />, title: "General Support", desc: "Questions about how to use any PDF tool or feature." },
  { icon: <FaCheckCircle />, title: "Billing & Plans", desc: "Questions about subscriptions, payments, or plan changes." },
  { icon: <FaEnvelope />, title: "Bug Reports", desc: "Something not working as expected? Let us know." },
];

export default function SupportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<SupportForm>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);

  function setField<K extends keyof SupportForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setStatus("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          subject: form.subject.trim() || "General support request",
          message: form.message.trim(),
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Unable to submit support request.");
      setStatus(data.message ?? "Support request submitted successfully.");
      setSuccess(true);
      setForm({ name: user?.name ?? "", email: user?.email ?? "", subject: "", message: "" });
    } catch (err) {
      setStatus(resolveError(err, "Support server is not available right now."));
      setSuccess(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="support-page">
      {/* Hero */}
      <section className="support-hero">
        <div className="container">
          <p className="section-eyebrow">Support</p>
          <h1>How can we help?</h1>
          <p className="support-hero-sub">
            Our team is here to help you get the most out of PDF Solution.
            Submit a ticket and we'll get back to you as soon as possible.
          </p>
        </div>
      </section>

      <div className="container support-body">
        {/* Topic cards */}
        <div className="support-topics">
          {TOPICS.map((t) => (
            <div key={t.title} className="support-topic-card">
              <div className="support-topic-icon">{t.icon}</div>
              <h3>{t.title}</h3>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>

        <div className="support-grid">
          {/* Contact info */}
          <div className="support-info-col">
            <h2>Contact Information</h2>
            <p>Reach out directly or use the form to submit a support ticket.</p>

            <div className="contact-info-list">
              <a href={`mailto:${CONTACT_EMAIL}`} className="contact-info-item">
                <div className="contact-info-icon"><FaEnvelope /></div>
                <div>
                  <strong>Email</strong>
                  <span>{CONTACT_EMAIL}</span>
                </div>
              </a>
              <a href={`tel:${CONTACT_PHONE}`} className="contact-info-item">
                <div className="contact-info-icon"><FaPhoneAlt /></div>
                <div>
                  <strong>Phone</strong>
                  <span>+91 {CONTACT_PHONE}</span>
                </div>
              </a>
              <div className="contact-info-item">
                <div className="contact-info-icon"><FaMapMarkerAlt /></div>
                <div>
                  <strong>Address</strong>
                  <span>{CONTACT_ADDRESS}</span>
                </div>
              </div>
            </div>

            <div className="support-hours">
              <h3>Response Times</h3>
              <div className="hours-grid">
                <div className="hours-item">
                  <span>Starter Plan</span>
                  <strong>48–72 hours</strong>
                </div>
                <div className="hours-item">
                  <span>Pro Plan</span>
                  <strong>24 hours</strong>
                </div>
                <div className="hours-item">
                  <span>Business Plan</span>
                  <strong>8 hours</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="support-form-col">
            <h2>Submit a Ticket</h2>
            {success && status ? (
              <div className="support-success">
                <FaCheckCircle />
                <p>{status}</p>
                <button type="button" className="btn btn-outline" onClick={() => { setSuccess(false); setStatus(""); }}>
                  Submit another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="support-form" noValidate>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="sup-name">Full Name *</label>
                    <input id="sup-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Your name" required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="sup-email">Email Address *</label>
                    <input id="sup-email" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="you@example.com" required />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="sup-subject">Subject</label>
                  <input id="sup-subject" value={form.subject} onChange={(e) => setField("subject", e.target.value)} placeholder="Brief description of your issue" />
                </div>

                <div className="form-field">
                  <label htmlFor="sup-message">Message *</label>
                  <textarea id="sup-message" value={form.message} onChange={(e) => setField("message", e.target.value)} placeholder="Describe your issue in detail…" required rows={6} />
                </div>

                {status && !success && <p className="alert alert-error">{status}</p>}

                <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Support Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
