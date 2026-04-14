import { useMemo, useState } from "react";

type HomeOverviewProps = {
  onStartTools: () => void;
  onOpenPlans: () => void;
};

type HomeCard = {
  title: string;
  description: string;
  icon: string;
  category: string;
  isNew?: boolean;
};

const categories = [
  "All",
  "Workflows",
  "Organize PDF",
  "Optimize PDF",
  "Convert PDF",
  "Edit PDF",
  "PDF Security",
  "PDF Intelligence",
] as const;

const cards: HomeCard[] = [
  { title: "Merge PDF", description: "Combine PDFs in the order you want with an easy merge flow.", icon: "MG", category: "Organize PDF" },
  { title: "Split PDF", description: "Separate pages or ranges into independent PDF files.", icon: "SP", category: "Organize PDF" },
  { title: "Compress PDF", description: "Reduce file size while preserving output quality.", icon: "CP", category: "Optimize PDF" },
  { title: "PDF to Word", description: "Convert PDF files into editable DOCX quickly.", icon: "W", category: "Convert PDF" },
  { title: "PDF to PowerPoint", description: "Turn your PDFs into editable PPT files.", icon: "P", category: "Convert PDF" },
  { title: "PDF to Excel", description: "Extract table data into spreadsheet-ready format.", icon: "X", category: "Convert PDF" },
  { title: "Word to PDF", description: "Create clean PDFs from DOC or DOCX files.", icon: "WP", category: "Convert PDF" },
  { title: "JPG to PDF", description: "Convert JPG images into polished PDF documents.", icon: "J", category: "Convert PDF" },
  { title: "Edit PDF", description: "Edit and rework page content with practical controls.", icon: "ED", category: "Edit PDF" },
  { title: "Unlock PDF", description: "Remove PDF protection where authorization exists.", icon: "UL", category: "PDF Security" },
  { title: "Protect PDF", description: "Apply password protection for secure sharing.", icon: "PR", category: "PDF Security" },
  { title: "Organize PDF", description: "Sort, reorder and clean up pages as needed.", icon: "OR", category: "Organize PDF" },
  { title: "OCR PDF", description: "Make scanned PDFs searchable and selectable.", icon: "OCR", category: "PDF Intelligence" },
  { title: "AI Summarizer", description: "Generate concise key points from long PDF text.", icon: "AI", category: "PDF Intelligence", isNew: true },
  { title: "Translate PDF", description: "Translate PDF content while preserving structure.", icon: "TR", category: "PDF Intelligence", isNew: true },
];

export default function HomeOverview({ onStartTools, onOpenPlans }: HomeOverviewProps) {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");

  const filteredCards = useMemo(
    () => (activeCategory === "All" ? cards : cards.filter((card) => card.category === activeCategory)),
    [activeCategory],
  );

  return (
    <section className="home-overview home-overview-redesign" id="home">
      <div className="home-hero-wrap">
        <h1>Every tool you need to work with PDFs in one place</h1>
        <p>
          Every tool you need to use PDFs at your fingertips. Merge, split, compress, convert, rotate,
          unlock and watermark PDFs in just a few clicks.
        </p>
        <div className="home-category-row">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`home-category-chip ${activeCategory === category ? "active" : ""}`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="home-card-grid">
        {filteredCards.map((card) => (
          <button key={card.title} type="button" className="home-tool-card" onClick={onStartTools}>
            <div className="home-card-head">
              <span className="home-card-icon">{card.icon}</span>
              {card.isNew ? <span className="home-card-new">New!</span> : null}
            </div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
          </button>
        ))}
      </div>

      <section className="home-work-way" aria-label="Work your way">
        <h2>Work your way</h2>
        <div className="home-work-grid">
          <article>
            <strong>Single file flow</strong>
            <p>Upload, run, and download in seconds.</p>
          </article>
          <article>
            <strong>Team workflow</strong>
            <p>Use shared plans and reusable settings.</p>
          </article>
          <article>
            <strong>Secure processing</strong>
            <p>Manage legal and support-ready workflows.</p>
          </article>
        </div>
      </section>

      <div className="home-premium-panel">
        <div>
          <h2>Get more with Premium</h2>
          <ul>
            <li>Get full access and work offline with desktop-ready workflows</li>
            <li>Edit PDFs, run advanced OCR and request secure eSignatures</li>
            <li>Connect tools and create custom workflows for your team</li>
          </ul>
          <button type="button" className="home-premium-btn" onClick={onOpenPlans}>
            Get Premium
          </button>
        </div>
        <div className="home-premium-visual" aria-hidden="true">
          <div className="premium-sheet" />
          <div className="premium-accent" />
        </div>
      </div>
    </section>
  );
}
