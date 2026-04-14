import { Link } from "react-router-dom";
import { FaGithub, FaInstagram, FaLinkedin, FaEnvelope, FaPhoneAlt, FaMapMarkerAlt } from "react-icons/fa";
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE, GITHUB_LINK, INSTAGRAM_LINK, LINKEDIN_LINK } from "../lib/api";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer-inner container">
        <div className="footer-brand-col">
          <Link to="/" className="footer-brand">
            <img src="/logo.png" alt="PDF Solution" className="footer-logo" />
            <span>PDF Solution</span>
          </Link>
          <p className="footer-tagline">Every PDF tool you need, all in one place. Fast, secure, and free to start.</p>
          <div className="footer-socials">
            <a href={GITHUB_LINK} target="_blank" rel="noopener noreferrer" aria-label="GitHub"><FaGithub /></a>
            <a href={LINKEDIN_LINK} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FaLinkedin /></a>
            <a href={INSTAGRAM_LINK} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FaInstagram /></a>
          </div>
        </div>

        <div className="footer-links-col">
          <h4>Tools</h4>
          <Link to="/tools?tool=merge">Merge PDF</Link>
          <Link to="/tools?tool=split">Split PDF</Link>
          <Link to="/tools?tool=compress">Compress PDF</Link>
          <Link to="/tools?tool=word">PDF to Word</Link>
          <Link to="/tools?tool=imageToPdf">Image to PDF</Link>
          <Link to="/tools?tool=edit">Edit PDF</Link>
        </div>

        <div className="footer-links-col">
          <h4>Company</h4>
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/support">Support</Link>
          <Link to="/legal">Legal &amp; Privacy</Link>
        </div>

        <div className="footer-contact-col">
          <h4>Contact</h4>
          <a href={`mailto:${CONTACT_EMAIL}`} className="footer-contact-item">
            <FaEnvelope /><span>{CONTACT_EMAIL}</span>
          </a>
          <a href={`tel:${CONTACT_PHONE}`} className="footer-contact-item">
            <FaPhoneAlt /><span>+91 {CONTACT_PHONE}</span>
          </a>
          <p className="footer-contact-item footer-address">
            <FaMapMarkerAlt /><span>{CONTACT_ADDRESS}</span>
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>&copy; {year} PDF Solution. All rights reserved.</p>
          <div className="footer-bottom-links">
            <Link to="/legal#privacy-policy">Privacy Policy</Link>
            <Link to="/legal#terms">Terms of Service</Link>
            <Link to="/legal#cookie-policy">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
