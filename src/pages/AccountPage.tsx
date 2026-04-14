import { FormEvent, useEffect, useState } from "react";
import { FaSave, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { authHeaders, fetchJson, resolveError } from "../lib/api";
import type { SessionUser } from "../lib/types";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  avatarUrl: string;
  preferences: {
    marketingEmails: boolean;
    productUpdates: boolean;
    darkMode: boolean;
  };
};

const DEFAULT_PREFS = { marketingEmails: false, productUpdates: true, darkMode: false };

function toForm(user: SessionUser): ProfileForm {
  return {
    name: user.name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    company: user.company ?? "",
    avatarUrl: user.avatarUrl ?? "",
    preferences: {
      ...DEFAULT_PREFS,
      ...(user.preferences ?? {}),
    },
  };
}

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>(() => (user ? toForm(user) : { name: "", email: "", phone: "", company: "", avatarUrl: "", preferences: { marketingEmails: false, productUpdates: true, darkMode: false } }));
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");

  useEffect(() => {
    if (user) setForm(toForm(user));
  }, [user]);

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setStatus("");
    try {
      const result = await fetchJson<{ user: SessionUser; message?: string }>("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: form.name, phone: form.phone, company: form.company, avatarUrl: form.avatarUrl, preferences: form.preferences }),
      });
      setUser(result.user);
      setForm(toForm(result.user));
      setStatus(result.message ?? "Profile saved successfully.");
      setStatusType("success");
    } catch (err) {
      setStatus(resolveError(err, "Unable to save profile right now."));
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="page-eyebrow">Account</p>
            <h1>My Account</h1>
            <p className="page-subtitle">Manage your profile details and communication preferences.</p>
          </div>
        </div>

        <div className="account-grid">
          {/* Profile card */}
          <section className="account-card">
            <div className="account-card-head">
              <div className="account-avatar-large">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={form.name} referrerPolicy="no-referrer" />
                ) : (
                  <FaUserCircle />
                )}
              </div>
              <div>
                <h2>{form.name || "Your Name"}</h2>
                <p>{form.email}</p>
                <span className={`plan-badge plan-badge-${user?.plan}`}>{user?.plan?.toUpperCase()}</span>
              </div>
            </div>
          </section>

          {/* Profile form */}
          <section className="account-card account-form-card">
            <h2 className="account-section-title">Profile Information</h2>
            <form onSubmit={handleSave} className="account-form" noValidate>
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="acc-name">Full Name</label>
                  <input id="acc-name" value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Your full name" required />
                </div>
                <div className="form-field">
                  <label htmlFor="acc-email">Email Address</label>
                  <input id="acc-email" value={form.email} disabled title="Email cannot be changed" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="acc-phone">Phone Number</label>
                  <input id="acc-phone" type="tel" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div className="form-field">
                  <label htmlFor="acc-company">Company / Organisation</label>
                  <input id="acc-company" value={form.company} onChange={(e) => setField("company", e.target.value)} placeholder="Acme Inc." />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="acc-avatar">Avatar URL</label>
                <input id="acc-avatar" type="url" value={form.avatarUrl} onChange={(e) => setField("avatarUrl", e.target.value)} placeholder="https://example.com/photo.jpg" />
              </div>

              {status && <p className={`alert alert-${statusType}`}>{status}</p>}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <FaSave /> {loading ? "Saving…" : "Save Profile"}
              </button>
            </form>
          </section>

          {/* Preferences */}
          <section className="account-card account-form-card">
            <h2 className="account-section-title">Preferences</h2>
            <form onSubmit={handleSave} className="prefs-form">
              <label className="pref-toggle">
                <div className="pref-toggle-text">
                  <strong>Marketing Emails</strong>
                  <span>Receive updates about new features and promotions.</span>
                </div>
                <div className="toggle-switch">
                  <input type="checkbox" checked={form.preferences.marketingEmails} onChange={(e) => setField("preferences", { ...form.preferences, marketingEmails: e.target.checked })} />
                  <span className="toggle-slider" />
                </div>
              </label>

              <label className="pref-toggle">
                <div className="pref-toggle-text">
                  <strong>Product Updates</strong>
                  <span>Get notified about tool improvements and new releases.</span>
                </div>
                <div className="toggle-switch">
                  <input type="checkbox" checked={form.preferences.productUpdates} onChange={(e) => setField("preferences", { ...form.preferences, productUpdates: e.target.checked })} />
                  <span className="toggle-slider" />
                </div>
              </label>

              <label className="pref-toggle">
                <div className="pref-toggle-text">
                  <strong>Dark Mode</strong>
                  <span>Use a darker colour scheme for the interface.</span>
                </div>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={form.preferences.darkMode}
                    onChange={(e) => {
                      // Apply immediately so user sees the effect live
                      document.documentElement.classList.toggle("dark", e.target.checked);
                      setField("preferences", { ...form.preferences, darkMode: e.target.checked });
                    }}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                <FaSave /> {loading ? "Saving…" : "Save Preferences"}
              </button>
            </form>
          </section>

          {/* Danger zone */}
          <section className="account-card danger-zone-card">
            <h2 className="account-section-title danger-title">Account Actions</h2>
            <p>These actions affect your account access.</p>
            <div className="danger-actions">
              <button type="button" className="btn btn-outline" onClick={() => { window.location.href = "/"; }}>
                Sign Out of All Devices
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
