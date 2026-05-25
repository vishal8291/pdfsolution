import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaArrowRight, FaBolt, FaCheckCircle, FaLock,
  FaShieldAlt, FaStar, FaFileAlt, FaClock,
  FaBrain, FaGlobe, FaRocket,
} from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";
import AdBanner from "../components/AdBanner";

type Category = "All" | "Organize PDF" | "Optimize PDF" | "Convert PDF" | "Edit PDF" | "PDF Security" | "Content";

const CATEGORIES: Category[] = [
  "All", "Organize PDF", "Optimize PDF", "Convert PDF", "Edit PDF", "PDF Security", "Content",
];

type ToolCard = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: Category;
  isNew?: boolean;
  routeId: string;
};

const TOOLS: ToolCard[] = [
  { id: "merge",       title: "Merge PDF",       description: "Combine multiple PDFs into one document with drag-and-drop page ordering.",  icon: "MG",  category: "Organize PDF",  routeId: "merge" },
  { id: "split",       title: "Split PDF",        description: "Extract specific pages or split every page into its own PDF file.",          icon: "SP",  category: "Organize PDF",  routeId: "split" },
  { id: "rotate",      title: "Rotate PDF",       description: "Rotate all pages 90°, 180°, or 270° in a single click.",                    icon: "RT",  category: "Organize PDF",  routeId: "rotate",      isNew: true },
  { id: "compress",    title: "Compress PDF",     description: "Reduce file size while preserving quality — entirely in your browser.",      icon: "CP",  category: "Optimize PDF",  routeId: "compress" },
  { id: "word",        title: "PDF to Word",      description: "Convert PDF text into a fully editable DOCX file.",                         icon: "WD",  category: "Convert PDF",   routeId: "word" },
  { id: "pdfToJpg",    title: "PDF to JPG",       description: "Export every PDF page as a high-quality JPG image.",                        icon: "JPG", category: "Convert PDF",   routeId: "pdfToJpg",    isNew: true },
  { id: "imageToPdf",  title: "Image to PDF",     description: "Turn JPG or PNG images into a polished PDF document.",                      icon: "IMG", category: "Convert PDF",   routeId: "imageToPdf" },
  { id: "edit",        title: "Edit PDF",         description: "Rotate pages, remove pages, and add a watermark in one pass.",              icon: "ED",  category: "Edit PDF",      routeId: "edit" },
  { id: "pageNumbers", title: "Add Page Numbers", description: "Stamp numbered page labels at the bottom of every page.",                   icon: "PN",  category: "Edit PDF",      routeId: "pageNumbers", isNew: true },
  { id: "unlock",      title: "Unlock PDF",       description: "Remove PDF restrictions and re-save as a fully open, shareable file.",      icon: "UL",  category: "PDF Security",  routeId: "unlock" },
  { id: "extract",     title: "Extract Text",     description: "Pull readable text out of any PDF and download it as a TXT file.",          icon: "TX",  category: "Content",       routeId: "extract" },
  { id: "ocr",         title: "OCR PDF",          description: "Use optical character recognition to extract text from scanned PDFs.",       icon: "OCR", category: "Content",       routeId: "ocr" },
];

/* ── Honest stats — only things that are actually true ─────── */
const STATS = [
  { value: "12",    label: "PDF Tools",      icon: <FaFileAlt /> },
  { value: "100%",  label: "Browser-based",  icon: <FaBolt /> },
  { value: "0",     label: "Files uploaded", icon: <FaShieldAlt /> },
  { value: "Free",  label: "To start",       icon: <FaStar /> },
];

/* ── Why use us — factually accurate points ─────────────────── */
const TRUST_POINTS = [
  {
    icon: <FaBolt />,
    title: "Runs in your browser",
    desc:  "Every tool uses WebAssembly and runs 100% locally. No server upload. No waiting. No file size caps.",
  },
  {
    icon: <FaLock />,
    title: "Your files stay private",
    desc:  "Nothing is sent to any server. Your PDF never leaves your device — ever. Not even for paid users.",
  },
  {
    icon: <FaShieldAlt />,
    title: "No hidden limits (Pro)",
    desc:  "Free plan: 3 PDFs per day. Pro (₹199/mo): unlimited PDFs, all 12 tools, priority support.",
  },
  {
    icon: <FaBrain />,
    title: "OCR for scanned PDFs",
    desc:  "Built-in Tesseract OCR can extract text from image-based PDFs — no external service needed.",
  },
  {
    icon: <FaGlobe />,
    title: "Works anywhere",
    desc:  "Any device, any OS — Windows, Mac, Linux, Android, iOS. Just open a browser and go.",
  },
  {
    icon: <FaRocket />,
    title: "Built by one developer",
    desc:  "This is an independent project, not a corporate tool. Feedback goes directly to the builder.",
  },
];

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const { openAuth, user } = useAuth();
  const navigate = useNavigate();

  const filtered = activeCategory === "All"
    ? TOOLS
    : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <main className="home-page">

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="container hero-inner">

          <div className="hero-badge">
            <FaRocket />
            <span>Launching 2025 — free to use, no account needed</span>
          </div>

          <h1 className="hero-title">
            Free PDF tools that run<br />
            <span className="hero-title-accent">entirely in your browser</span>
          </h1>

          <p className="hero-subtitle">
            Merge, split, compress, OCR, convert — 12 tools, zero uploads,
            100% private. Your files never leave your device.
          </p>

          <div className="hero-actions">
            <Link to="/tools" className="btn btn-primary btn-lg">
              Try the Tools — Free <FaArrowRight />
            </Link>
            <Link to="/pricing" className="btn btn-ghost btn-lg">
              See Pro plan — ₹199/mo
            </Link>
          </div>

          {/* Honest stats bar */}
          <div className="hero-stats">
            {STATS.map((s) => (
              <div key={s.label} className="hero-stat">
                <span className="hero-stat-icon">{s.icon}</span>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Tools grid ─────────────────────────────────────── */}
      <section className="tools-grid-section">
        <div className="container">
          <div className="section-header">
            <h2>Browse All 12 PDF Tools</h2>
            <p>No signup required for most tools. Pick one and start immediately.</p>
          </div>

          <div className="category-tabs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-tab ${activeCategory === cat ? "active" : ""}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="tool-cards-grid">
            {filtered.map((tool) => (
              <button
                key={tool.id}
                type="button"
                className="tool-card"
                onClick={() => navigate(`/tools?tool=${tool.routeId}`)}
              >
                <div className="tool-card-header">
                  <span className="tool-card-icon">{tool.icon}</span>
                  {tool.isNew && <span className="tool-card-badge">New</span>}
                </div>
                <h3 className="tool-card-title">{tool.title}</h3>
                <p className="tool-card-desc">{tool.description}</p>
                <span className="tool-card-arrow"><FaArrowRight /></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ad Banner (free/guest users only) ─────────────── */}
      <div className="container ad-slot-horizontal">
        <AdBanner slot="1234567890" format="horizontal" />
      </div>

      {/* ── Why PDF Solution ───────────────────────────────── */}
      <section className="trust-section">
        <div className="container">
          <div className="section-header">
            <h2>Why use PDF Solution?</h2>
            <p>Six honest reasons — no marketing fluff.</p>
          </div>
          <div className="trust-cards">
            {TRUST_POINTS.map((t) => (
              <div key={t.title} className="trust-card">
                <div className="trust-card-icon">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="how-section">
        <div className="container">
          <div className="section-header">
            <h2>How it works</h2>
            <p>Three steps. No account needed to start.</p>
          </div>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-step-num">1</div>
              <h3>Choose a tool</h3>
              <p>Pick the PDF operation you need from the grid above.</p>
            </div>
            <div className="how-step-arrow"><FaArrowRight /></div>
            <div className="how-step">
              <div className="how-step-num">2</div>
              <h3>Select your file</h3>
              <p>Drag and drop or browse. Everything processes locally — no upload.</p>
            </div>
            <div className="how-step-arrow"><FaArrowRight /></div>
            <div className="how-step">
              <div className="how-step-num">3</div>
              <h3>Download instantly</h3>
              <p>Processing runs in your browser. Download the result in seconds.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Review CTA — honest, invites real reviews ──────── */}
      <section className="review-invite-section">
        <div className="container">
          <div className="review-invite-card">
            <div className="review-invite-icon"><FaStar /></div>
            <div className="review-invite-body">
              <h2>Used PDF Solution? Share your feedback.</h2>
              <p>
                This is a new, independent project. Real reviews from real users help
                improve it and help others find it. If you've used any of the tools,
                drop an honest opinion below or reach out directly.
              </p>
              <div className="review-invite-actions">
                <Link to="/support" className="btn btn-primary">
                  Send Feedback <FaArrowRight />
                </Link>
                <a
                  href="mailto:vishaltiwari101999@gmail.com?subject=PDF Solution feedback"
                  className="btn btn-outline"
                >
                  Email the builder
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pro upgrade CTA ────────────────────────────────── */}
      <section className="premium-cta-section">
        <div className="container premium-cta-inner">
          <div className="premium-cta-text">
            <div className="cta-eyebrow"><FaClock /> Early adopter pricing — locked in for life</div>
            <h2>Upgrade to Pro — ₹199/month</h2>
            <ul className="premium-cta-list">
              <li><FaCheckCircle /> Unlimited PDFs every day (no 3/day cap)</li>
              <li><FaCheckCircle /> All 12 tools including OCR and bulk processing</li>
              <li><FaCheckCircle /> Zero ads — completely clean experience</li>
              <li><FaCheckCircle /> Priority support — direct line to the builder</li>
              <li><FaCheckCircle /> Cancel anytime, no questions asked</li>
            </ul>
            <div className="premium-cta-actions">
              <Link to="/pricing" className="btn btn-primary btn-lg">
                See Pricing Plans
              </Link>
              {!user && (
                <button
                  type="button"
                  className="btn btn-outline btn-lg"
                  onClick={() => openAuth("signup")}
                >
                  Create Free Account
                </button>
              )}
            </div>
          </div>
          <div className="premium-cta-visual" aria-hidden="true">
            <div className="cta-visual-card cta-visual-card-1" />
            <div className="cta-visual-card cta-visual-card-2" />
            <div className="cta-visual-card cta-visual-card-3" />
          </div>
        </div>
      </section>

    </main>
  );
}
