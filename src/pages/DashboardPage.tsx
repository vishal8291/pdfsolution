import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaCreditCard, FaHeadset, FaCheckCircle, FaUser } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import { authHeaders, fetchJson } from "../lib/api";
import type { DashboardSummary } from "../lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true); setError("");
      try {
        const data = await fetchJson<{ dashboard: DashboardSummary }>("/api/dashboard", { headers: authHeaders() });
        setDashboard(data.dashboard);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load dashboard.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <main className="dashboard-page"><div className="container"><div className="loading-state">Loading your dashboard…</div></div></main>;

  return (
    <main className="dashboard-page">
      <div className="container">
        <div className="page-header">
          <div>
            <p className="page-eyebrow">Dashboard</p>
            <h1>Welcome back, {user?.name?.split(" ")[0]}</h1>
            <p className="page-subtitle">Here's an overview of your account activity and status.</p>
          </div>
          <Link to="/account" className="btn btn-outline">Edit Profile <FaArrowRight /></Link>
        </div>

        {error && <p className="alert alert-error">{error}</p>}

        {/* Stats */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-card-icon stat-icon-plan"><FaCreditCard /></div>
            <div className="stat-card-body">
              <p className="stat-label">Current Plan</p>
              <p className="stat-value">{dashboard?.stats.currentPlan ?? user?.plan ?? "free"}</p>
              <Link to="/pricing" className="stat-link">Upgrade <FaArrowRight /></Link>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon stat-icon-billing"><FaCheckCircle /></div>
            <div className="stat-card-body">
              <p className="stat-label">Billing Status</p>
              <p className="stat-value">{dashboard?.stats.billingStatus ?? "Free"}</p>
              <Link to="/pricing" className="stat-link">Manage billing <FaArrowRight /></Link>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon stat-icon-support"><FaHeadset /></div>
            <div className="stat-card-body">
              <p className="stat-label">Support Tickets</p>
              <p className="stat-value">{dashboard?.stats.supportTickets ?? 0}</p>
              <Link to="/support" className="stat-link">View support <FaArrowRight /></Link>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon stat-icon-profile"><FaUser /></div>
            <div className="stat-card-body">
              <p className="stat-label">Account</p>
              <p className="stat-value">{user?.email}</p>
              <Link to="/account" className="stat-link">Edit profile <FaArrowRight /></Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <section className="dashboard-section">
          <h2>Quick Actions</h2>
          <div className="quick-actions">
            <Link to="/tools" className="quick-action-card">
              <strong>Use PDF Tools</strong>
              <p>Merge, split, compress, convert PDFs</p>
              <FaArrowRight />
            </Link>
            <Link to="/pricing" className="quick-action-card">
              <strong>Upgrade Plan</strong>
              <p>Unlock premium tools and priority support</p>
              <FaArrowRight />
            </Link>
            <Link to="/support" className="quick-action-card">
              <strong>Get Support</strong>
              <p>Submit a ticket or contact the team</p>
              <FaArrowRight />
            </Link>
            <Link to="/account" className="quick-action-card">
              <strong>Account Settings</strong>
              <p>Update profile and preferences</p>
              <FaArrowRight />
            </Link>
          </div>
        </section>

        {/* Plan info */}
        <section className="dashboard-section">
          <h2>Your Plan</h2>
          <div className="plan-info-card">
            <div className="plan-info-left">
              <span className={`plan-badge plan-badge-lg plan-badge-${user?.plan}`}>{user?.plan?.toUpperCase()}</span>
              <div>
                <p className="plan-info-name">{user?.plan === "free" ? "Starter Plan" : user?.plan === "pro" ? "Professional Plan" : "Business Plan"}</p>
                <p className="plan-info-sub">{user?.plan === "free" ? "Upgrade to unlock premium features" : "Thank you for being a premium member"}</p>
              </div>
            </div>
            {user?.plan === "free" && (
              <Link to="/pricing" className="btn btn-primary">Upgrade Now</Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
