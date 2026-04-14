import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FaFileContract, FaLock, FaShieldAlt, FaCookie } from "react-icons/fa";

const SECTIONS = [
  {
    id: "terms",
    icon: <FaFileContract />,
    title: "Terms of Service",
    updated: "January 2025",
    content: [
      { heading: "Acceptance of Terms", body: "By using PDF Solution, you agree to these Terms of Service. If you do not agree, please do not use the service." },
      { heading: "Use of Service", body: "PDF Solution provides browser-based PDF processing tools. You are responsible for the files you upload and process. Do not use this service to process files you do not have the right to access or modify." },
      { heading: "Intellectual Property", body: "All software, design, and content on PDF Solution is the intellectual property of Vishal Tiwari. You may not copy, reproduce, or distribute it without permission." },
      { heading: "Limitation of Liability", body: "PDF Solution is provided 'as is' without warranties of any kind. We are not liable for any direct, indirect, or consequential damages arising from the use of this service." },
      { heading: "Changes to Terms", body: "We reserve the right to update these terms at any time. Continued use of the service after changes constitutes acceptance of the updated terms." },
    ],
  },
  {
    id: "privacy-policy",
    icon: <FaShieldAlt />,
    title: "Privacy Policy",
    updated: "January 2025",
    content: [
      { heading: "Data We Collect", body: "For authenticated users, we collect name, email address, and account preferences. PDF processing for core tools runs entirely in your browser — no files are transmitted to our servers." },
      { heading: "How We Use Data", body: "Account data is used to provide authentication, subscription management, and support features. We do not sell your personal data to third parties." },
      { heading: "Data Storage", body: "User data is stored in a MongoDB database with access controls. Passwords are hashed using scrypt. Session tokens are stored in memory and expire on logout." },
      { heading: "Third-Party Services", body: "We use Razorpay for payment processing. Razorpay's privacy policy governs the handling of your payment information. We use Google OAuth for optional social login." },
      { heading: "Your Rights", body: "You may request deletion of your account and associated data by contacting us. We will process such requests within 30 days." },
    ],
  },
  {
    id: "cookie-policy",
    icon: <FaCookie />,
    title: "Cookie Policy",
    updated: "January 2025",
    content: [
      { heading: "What Are Cookies", body: "Cookies are small text files stored in your browser. We use localStorage (not cookies) to store your authentication token locally." },
      { heading: "Authentication Storage", body: "Your session token is stored in localStorage under the key 'pdfsolution-auth-token'. This is cleared when you log out." },
      { heading: "Third-Party Cookies", body: "Razorpay checkout may set cookies during payment processing. Google OAuth may set cookies during sign-in. These are governed by their respective privacy policies." },
      { heading: "Managing Storage", body: "You can clear localStorage via your browser's developer tools or privacy settings. This will log you out of PDF Solution." },
    ],
  },
  {
    id: "support-policy",
    icon: <FaLock />,
    title: "Support Policy",
    updated: "January 2025",
    content: [
      { heading: "Support Channels", body: "Support is available via the in-app support form. Email support is available at the contact address listed on our Support page." },
      { heading: "Response Times", body: "Starter (free) plan users can expect responses within 48–72 hours. Pro plan users within 24 hours. Business plan users within 8 hours on business days." },
      { heading: "Scope of Support", body: "We provide support for issues related to the PDF Solution platform and its features. We do not provide support for third-party software or general PDF editing advice." },
      { heading: "Ticket Resolution", body: "Support tickets are processed in order of receipt. Priority is given to Business plan subscribers for billing and critical issues." },
    ],
  },
];

export default function LegalPage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [location.hash]);

  return (
    <main className="legal-page">
      <section className="legal-hero">
        <div className="container">
          <p className="section-eyebrow">Legal</p>
          <h1>Legal &amp; Policies</h1>
          <p className="legal-hero-sub">Our policies are designed to be clear and fair. Please read them carefully.</p>
        </div>
      </section>

      <div className="container legal-body">
        {/* Quick nav */}
        <nav className="legal-nav" aria-label="Jump to section">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="legal-nav-link">
              {s.icon}<span>{s.title}</span>
            </a>
          ))}
        </nav>

        {/* Sections */}
        <div className="legal-sections">
          {SECTIONS.map((section) => (
            <article key={section.id} id={section.id} className="legal-section-card">
              <div className="legal-section-head">
                <div className="legal-section-icon">{section.icon}</div>
                <div>
                  <h2>{section.title}</h2>
                  <p className="legal-updated">Last updated: {section.updated}</p>
                </div>
              </div>
              <div className="legal-section-body">
                {section.content.map((item) => (
                  <div key={item.heading} className="legal-clause">
                    <h3>{item.heading}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="legal-contact-note">
          <p>Have questions about our policies? <a href="/support">Contact our support team</a> and we'll be happy to help.</p>
        </div>
      </div>
    </main>
  );
}
