import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaBars, FaChevronDown, FaTimes, FaUserCircle } from "react-icons/fa";
import { useAuth } from "../lib/AuthContext";

export default function Navbar() {
  const { user, openAuth, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    setAccountOpen(false);
    logout().then(() => navigate("/"));
  }

  return (
    <header className="navbar">
      <div className="navbar-inner container">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src="/logo.png" alt="PDF Solution" className="navbar-logo" />
          <span className="navbar-brand-name">PDF Solution</span>
        </Link>

        <nav className={`navbar-links ${menuOpen ? "open" : ""}`} aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/tools" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Tools</NavLink>
          <NavLink to="/pricing" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Pricing</NavLink>
          <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>About</NavLink>
          <NavLink to="/support" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`} onClick={() => setMenuOpen(false)}>Support</NavLink>
        </nav>

        <div className="navbar-actions">
          {user ? (
            <div className="account-menu-wrap">
              <button
                type="button"
                className="account-menu-trigger"
                onClick={() => setAccountOpen((prev) => !prev)}
                aria-haspopup="true"
                aria-expanded={accountOpen}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="account-avatar" referrerPolicy="no-referrer" />
                ) : (
                  <FaUserCircle className="account-avatar-icon" />
                )}
                <span className="account-name">{user.name.split(" ")[0]}</span>
                <FaChevronDown className={`account-chevron ${accountOpen ? "open" : ""}`} />
              </button>
              {accountOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-header">
                    <p className="account-dropdown-name">{user.name}</p>
                    <p className="account-dropdown-email">{user.email}</p>
                    <span className={`plan-badge plan-badge-${user.plan}`}>{user.plan.toUpperCase()}</span>
                  </div>
                  <Link to="/dashboard" className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>Dashboard</Link>
                  <Link to="/account" className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>My Account</Link>
                  <Link to="/pricing" className="account-dropdown-item" role="menuitem" onClick={() => setAccountOpen(false)}>Upgrade Plan</Link>
                  <div className="account-dropdown-divider" />
                  <button type="button" className="account-dropdown-item account-dropdown-logout" role="menuitem" onClick={handleLogout}>Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="navbar-auth-buttons">
              <button type="button" className="btn btn-ghost" onClick={() => openAuth("login")}>Login</button>
              <button type="button" className="btn btn-primary" onClick={() => openAuth("signup")}>Get Started</button>
            </div>
          )}

          <button
            type="button"
            className="navbar-hamburger"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {menuOpen && <div className="navbar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      {accountOpen && <div className="navbar-backdrop" onClick={() => setAccountOpen(false)} aria-hidden="true" />}
    </header>
  );
}
