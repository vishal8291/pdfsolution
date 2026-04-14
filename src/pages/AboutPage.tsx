import { Link } from "react-router-dom";
import { FaArrowRight, FaBolt, FaGithub, FaInstagram, FaLinkedin, FaLock, FaShieldAlt } from "react-icons/fa";
import { GITHUB_LINK, INSTAGRAM_LINK, LINKEDIN_LINK } from "../lib/api";

const VALUES = [
  { icon: <FaBolt />, title: "Speed First", desc: "Every tool is designed to be instant. PDF processing runs in-browser with zero server round trips for core features." },
  { icon: <FaLock />, title: "Privacy by Design", desc: "Your files never leave your device for basic operations. We only handle data when absolutely necessary — and always securely." },
  { icon: <FaShieldAlt />, title: "Secure Infrastructure", desc: "Authentication, billing, and support data are protected with industry-standard encryption and secure session management." },
];

const MILESTONES = [
  { year: "2024", event: "PDF Solution founded — core tools launched." },
  { year: "2024", event: "Added user authentication: password, OTP, and Google login." },
  { year: "2024", event: "Integrated Razorpay billing for Pro and Business plans." },
  { year: "2025", event: "Multi-page website with React Router and improved UX." },
  { year: "2025", event: "Adding OCR, AI Summarizer, and Translate PDF features." },
];

export default function AboutPage() {
  return (
    <main className="about-page">
      {/* Hero */}
      <section className="about-hero">
        <div className="container about-hero-inner">
          <div className="about-hero-text">
            <p className="section-eyebrow">About Us</p>
            <h1>Built to make PDF workflows simple for everyone</h1>
            <p>
              PDF Solution is a browser-based document platform that brings professional-grade PDF tools
              to individuals, freelancers, and teams — without complexity, without subscriptions locked behind walls,
              and without compromising on your privacy.
            </p>
            <div className="about-hero-actions">
              <Link to="/tools" className="btn btn-primary">Try the Tools <FaArrowRight /></Link>
              <Link to="/pricing" className="btn btn-outline">View Pricing</Link>
            </div>
          </div>
          <div className="about-hero-visual" aria-hidden="true">
            <div className="about-visual-card about-visual-card-1" />
            <div className="about-visual-card about-visual-card-2" />
            <div className="about-visual-card about-visual-card-3" />
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="about-mission">
        <div className="container about-mission-inner">
          <div className="about-mission-text">
            <h2>Our Mission</h2>
            <p>
              We believe that powerful PDF tools should be accessible to everyone —
              not locked behind expensive desktop software or subscription walls.
              PDF Solution runs entirely in your browser, which means your files stay on your device,
              your data stays private, and the tools are always available.
            </p>
            <p>
              From a single developer building tools they actually needed, PDF Solution has grown
              into a full-featured platform with auth, billing, team plans, and an ever-expanding
              library of PDF capabilities.
            </p>
          </div>
          <div className="about-mission-stats">
            <div className="about-stat"><strong>15+</strong><span>PDF Tools</span></div>
            <div className="about-stat"><strong>100%</strong><span>Browser-based</span></div>
            <div className="about-stat"><strong>3</strong><span>Plan Tiers</span></div>
            <div className="about-stat"><strong>0</strong><span>File Uploads for Core Tools</span></div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="about-values">
        <div className="container">
          <div className="section-header">
            <h2>Our Core Values</h2>
            <p>The principles we build every feature and decision around.</p>
          </div>
          <div className="values-grid">
            {VALUES.map((v) => (
              <div key={v.title} className="value-card">
                <div className="value-icon">{v.icon}</div>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="about-founder">
        <div className="container about-founder-inner">
          <div className="founder-avatar">
            <span>VT</span>
          </div>
          <div className="founder-text">
            <p className="section-eyebrow">The Creator</p>
            <h2>Vishal Tiwari</h2>
            <p>
              Full-stack developer passionate about building tools that solve real problems.
              PDF Solution started as a personal project and grew into a product used by people who
              need reliable, private, and fast document workflows.
            </p>
            <div className="founder-links">
              <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon"><FaGithub /> GitHub</a>
              <a href={LINKEDIN_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon"><FaLinkedin /> LinkedIn</a>
              <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon"><FaInstagram /> Instagram</a>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="about-timeline">
        <div className="container">
          <h2>Milestones</h2>
          <div className="timeline">
            {MILESTONES.map((m, i) => (
              <div key={i} className="timeline-item">
                <div className="timeline-year">{m.year}</div>
                <div className="timeline-dot" />
                <div className="timeline-event">{m.event}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="about-cta">
        <div className="container about-cta-inner">
          <h2>Ready to get started?</h2>
          <p>Join thousands of users who trust PDF Solution for their document workflows.</p>
          <div className="about-cta-actions">
            <Link to="/tools" className="btn btn-primary btn-lg">Start Using Tools</Link>
            <Link to="/support" className="btn btn-outline btn-lg">Contact Us</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
