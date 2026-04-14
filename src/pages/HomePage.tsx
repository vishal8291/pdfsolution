import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowRight, FaBolt, FaCheckCircle, FaLock, FaShieldAlt, FaStar } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";

type Category = "All" | "Organize PDF" | "Optimize PDF" | "Convert PDF" | "Edit PDF" | "PDF Security" | "Content";

const CATEGORIES: Category[] = ["All", "Organize PDF", "Optimize PDF", "Convert PDF", "Edit PDF", "PDF Security", "Content"];

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
  { id: "merge",       title: "Merge PDF",         description: "Combine multiple PDFs into one document with drag-and-drop page ordering.",  icon: "MG",  category: "Organize PDF", routeId: "merge" },
  { id: "split",       title: "Split PDF",          description: "Extract specific pages or split every page into its own PDF file.",           icon: "SP",  category: "Organize PDF", routeId: "split" },
  { id: "rotate",      title: "Rotate PDF",         description: "Rotate all pages 90°, 180°, or 270° in a single click.",                     icon: "RT",  category: "Organize PDF", routeId: "rotate", isNew: true },
  { id: "compress",    title: "Compress PDF",       description: "Reduce file size while preserving quality — entirely in your browser.",       icon: "CP",  category: "Optimize PDF", routeId: "compress" },
  { id: "word",        title: "PDF to Word",        description: "Convert PDF text into a fully editable DOCX file.",                          icon: "WD",  category: "Convert PDF",  routeId: "word" },
  { id: "pdfToJpg",    title: "PDF to JPG",         description: "Export every PDF page as a high-quality JPG image.",                         icon: "JPG", category: "Convert PDF",  routeId: "pdfToJpg", isNew: true },
  { id: "imageToPdf",  title: "Image to PDF",       description: "Turn JPG or PNG images into a polished PDF document.",                       icon: "IMG", category: "Convert PDF",  routeId: "imageToPdf" },
  { id: "edit",        title: "Edit PDF",           description: "Rotate pages, remove pages, and add a watermark in one pass.",               icon: "ED",  category: "Edit PDF",     routeId: "edit" },
  { id: "pageNumbers", title: "Add Page Numbers",   description: "Stamp numbered page labels at the bottom of every page.",                    icon: "PN",  category: "Edit PDF",     routeId: "pageNumbers", isNew: true },
  { id: "unlock",      title: "Unlock PDF",         description: "Remove PDF restrictions and re-save as a fully open, shareable file.",       icon: "UL",  category: "PDF Security", routeId: "unlock" },
  { id: "extract",     title: "Extract Text",       description: "Pull readable text out of any PDF and download it as a TXT file.",           icon: "TX",  category: "Content",      routeId: "extract" },
  { id: "ocr",         title: "OCR PDF",            description: "Use optical character recognition to extract text from scanned PDFs.",        icon: "OCR", category: "Content",      routeId: "ocr" },
];

const STATS = [
  { value: "12",   label: "PDF Tools" },
  { value: "100%", label: "Browser-based" },
  { value: "Free", label: "To Get Started" },
  { value: "Zero", label: "File Uploads" },
];

const TRUST_POINTS = [
  { icon: <FaBolt />,      title: "Lightning Fast",   desc: "All tools run directly in your browser using WebAssembly — no uploads, no waiting." },
  { icon: <FaLock />,      title: "Privacy First",    desc: "Your files never leave your device. PDF processing is 100% local." },
  { icon: <FaShieldAlt />, title: "Enterprise Ready", desc: "OTP login, Google OAuth, team billing plans, and Razorpay payments — all built in." },
];

export default function HomePage() {
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const { openAuth, user } = useAuth();
  const navigate = useNavigate();

  const filtered = activeCategory === "All" ? TOOLS : TOOLS.filter((t) => t.category === activeCategory);

  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="container hero-inner">
          <div className="hero-badge"><FaStar /><span>Free PDF Tools — No Signup Required</span></div>
          <h1 className="hero-title">
            Every PDF tool you need,<br />
            <span className="hero-title-accent">all in one place</span>
          </h1>
          <p className="hero-subtitle">
            Merge, split, compress, rotate, convert, and unlock PDFs in seconds —
            directly in your browser with zero file uploads and zero privacy risk.
          </p>
          <div className="hero-actions">
            <Link to="/tools" className="btn btn-primary btn-lg">Start Using Tools <FaArrowRight /></Link>
            {!user && (<button type="button" className="btn btn-ghost btn-lg" onClick={() => openAuth("signup")}>Create Free Account</button>)}
          </div>
          <div className="hero-stats">
            {STATS.map((s) => (<div key={s.label} className="hero-stat"><strong>{s.value}</strong><span>{s.label}</span></div>))}
          </div>
        </div>
      </section>

      <section className="tools-grid-section">
        <div className="container">
          <div className="section-header">
            <h2>Browse All PDF Tools</h2>
            <p>Click any tool to get started instantly — no account required for core tools.</p>
          </div>
          <div className="category-tabs">
            {CATEGORIES.map((cat) => (<button key={cat} type="button" className={`category-tab ${activeCategory === cat ? "active" : ""}`} onClick={() => setActiveCategory(cat)}>{cat}</button>))}
          </div>
          <div className="tool-cards-grid">
            {filtered.map((tool) => (
              <button key={tool.id} type="button" className="tool-card" onClick={() => navigate(`/tools?tool=${tool.routeId}`)}>
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

      <section className="trust-section">
        <div className="container">
          <div className="section-header">
            <h2>Why PDF Solution?</h2>
            <p>Built for people who need reliable, private, and fast PDF workflows.</p>
          </div>
          <div className="trust-cards">
            {TRUST_POINTS.map((t) => (<div key={t.title} className="trust-card"><div className="trust-card-icon">{t.icon}</div><h3>{t.title}</h3><p>{t.desc}</p></div>))}
          </div>
        </div>
      </section>

      <section className="how-section">
        <div className="container">
          <div className="section-header"><h2>How It Works</h2><p>Three steps and your PDF is ready.</p></div>
          <div className="how-steps">
            <div className="how-step"><div className="how-step-num">1</div><h3>Choose a Tool</h3><p>Pick the PDF operation you need from our tool library.</p></div>
            <div className="how-step-arrow"><FaArrowRight /></div>
            <div className="how-step"><div className="how-step-num">2</div><h3>Upload Your File</h3><p>Drag and drop or browse to select your PDF or image files.</p></div>
            <div className="how-step-arrow"><FaArrowRight /></div>
            <div className="how-step"><div className="how-step-num">3</div><h3>Download Result</h3><p>Processing runs instantly in your browser — download immediately.</p></div>
          </div>
        </div>
      </section>

      <section className="premium-cta-section">
        <div className="container premium-cta-inner">
          <div className="premium-cta-text">
            <h2>Unlock the full PDF Solution experience</h2>
            <ul className="premium-cta-list">
              <li><FaCheckCircle /> Priority processing and personal dashboard</li>
              <li><FaCheckCircle /> Account history, team workflows, and billing management</li>
              <li><FaCheckCircle /> Premium support with faster response times</li>
            </ul>
            <div className="premium-cta-actions">
              <Link to="/pricing" className="btn btn-primary btn-lg">View Pricing Plans</Link>
              {!user && (<button type="button" className="btn btn-outline btn-lg" onClick={() => openAuth("signup")}>Start Free</button>)}
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
