# PDF Solution — Complete Project Documentation

> **Last reviewed:** April 2026  
> **Version:** 1.0.0  
> **Author:** Vishal Tiwari

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Features](#4-features)
5. [Architecture](#5-architecture)
6. [API Reference](#6-api-reference)
7. [Setup & Running Locally](#7-setup--running-locally)
8. [Environment Variables](#8-environment-variables)
9. [Security Model](#9-security-model)
10. [Performance & Efficiency](#10-performance--efficiency)
11. [Cost Analysis](#11-cost-analysis)
12. [Revenue Model & Earnings Potential](#12-revenue-model--earnings-potential)
13. [Deployment Guide](#13-deployment-guide)
14. [Crash Prevention & Reliability](#14-crash-prevention--reliability)
15. [Known Limitations & Roadmap](#15-known-limitations--roadmap)

---

## 1. Project Overview

**PDF Solution** is a full-stack, browser-based PDF productivity platform. Users can merge, split, compress, convert, and OCR PDF files — all processed locally in the browser using WebAssembly — with no file uploads to any server. Authenticated users get a personal dashboard, billing via Razorpay, OTP-based login, and Google OAuth.

### Core Value Proposition
- **Privacy-first**: PDF operations run 100% in the browser. No PDF data ever leaves the user's device.
- **Zero-install**: Works in any modern browser without plugins.
- **Freemium**: Free tier covers all core tools; paid plans unlock priority support and advanced features.

---

## 2. Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| React Router v7 | Client-side routing (multipage SPA) |
| TypeScript 5 | Type safety |
| Vite 5 | Build tool & dev server |
| pdf-lib 1.x | PDF creation, merging, splitting (WASM) |
| pdfjs-dist 5.x | PDF rendering & thumbnails (WASM) |
| tesseract.js 7 | OCR — text extraction from scanned PDFs |
| react-icons | SVG icon library |
| CSS Custom Properties | Design system (no external CSS framework) |

### Backend
| Technology | Purpose |
|---|---|
| Node.js (raw `http`) | HTTP server — no Express/Fastify overhead |
| TypeScript + tsx | Type-safe server, zero-transpile dev |
| MongoDB Atlas | Persistent storage (users, sessions, billing) |
| nodemailer | OTP email delivery via SMTP |
| google-auth-library | Google ID token verification |
| Razorpay Node SDK | Payment order creation + HMAC verification |
| scrypt (Node built-in) | Password hashing (memory-hard, DoS-resistant) |

### Infrastructure (Dev)
| Service | Cost | Purpose |
|---|---|---|
| MongoDB Atlas M0 | Free | Database (512 MB) |
| Gmail SMTP | Free | OTP / transactional emails |
| Google OAuth | Free | Social login |
| Razorpay | 2% per transaction | Payment processing |
| localhost:5173 + 3001 | Free | Dev |

---

## 3. Project Structure

```
pdfsolution/
├── server/
│   └── index.ts              # Full backend — auth, billing, profile, support APIs
├── src/
│   ├── App.tsx               # Router shell — lazy pages, AuthProvider, ErrorBoundary
│   ├── styles.css            # Full design system — CSS custom properties
│   ├── lib/
│   │   ├── api.ts            # fetchJson, token helpers, contact constants
│   │   ├── AuthContext.tsx   # Global auth state — user, config, plans, modals
│   │   └── types.ts          # Shared TypeScript types (frontend + server contract)
│   ├── layout/
│   │   ├── Navbar.tsx        # Sticky nav, account dropdown, mobile menu
│   │   ├── Footer.tsx        # 4-column footer with social links
│   │   └── ProtectedRoute.tsx # Auth guard — redirects to login if unauthenticated
│   ├── components/
│   │   ├── AuthModal.tsx     # Login / Signup / OTP / Forgot password modal
│   │   └── ErrorBoundary.tsx # React error boundary — prevents white screens
│   └── pages/
│       ├── HomePage.tsx      # Landing page — hero, features, social proof
│       ├── ToolsPage.tsx     # PDF workspace — merge, split, compress, OCR, etc.
│       ├── PricingPage.tsx   # Plan cards + Razorpay checkout + FAQ
│       ├── DashboardPage.tsx # User dashboard — stats, quick actions, plan info
│       ├── AccountPage.tsx   # Profile form + preference toggles
│       ├── SupportPage.tsx   # Support ticket form + contact info
│       ├── AboutPage.tsx     # Mission, values, team, milestones
│       ├── LegalPage.tsx     # Terms, Privacy, Cookie, Support policies
│       └── NotFoundPage.tsx  # 404 fallback
├── .env                      # Environment variables (never commit)
├── vite.config.ts            # Vite — manual chunks for code splitting
├── tsconfig.json             # TypeScript — moduleResolution: bundler
└── package.json
```

---

## 4. Features

### PDF Tools (browser-side, no upload)
| Tool | Library | Description |
|---|---|---|
| Merge | pdf-lib | Combine multiple PDFs into one |
| Split | pdf-lib | Extract specific pages as new PDF |
| Compress | pdf-lib | Reduce PDF file size |
| Reorder | pdf-lib | Drag-and-drop page reordering |
| Extract Text | pdfjs-dist | Copy all text content from PDF |
| OCR | tesseract.js | Extract text from scanned/image PDFs |
| Convert to DOCX | docx + pdfjs-dist | Export PDF content as Word document |

### Authentication
- Email + password signup/login (scrypt hashed)
- Google OAuth 2.0 (one-tap popup via GIS)
- OTP login (email-based, 10-minute expiry)
- OTP password reset
- 24-hour session tokens (auto-expire, purged every 30 minutes)

### Account & Billing
- Profile management (name, phone, company, avatar)
- User preferences (marketing emails, product updates, dark mode)
- Dashboard with live stats (support tickets, billing status, plan)
- Razorpay checkout with server-side HMAC payment verification
- Auto plan upgrade on successful payment
- Three tiers: Free / Pro (₹499/mo) / Business (₹1499/mo)

### Security
- Rate limiting: 60 req/min global, 20 req/min on auth endpoints
- Request body size limit: 100 KB (DoS prevention)
- 30-second request timeout (hung connection prevention)
- CORS origin allowlist (no wildcard `*`)
- Security headers: HSTS, X-Frame-Options DENY, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy
- Timing-safe password comparison (prevents timing attacks)
- Graceful shutdown on SIGINT/SIGTERM
- Process stays alive on uncaughtException/unhandledRejection (no crash on stray errors)

---

## 5. Architecture

```
Browser (React SPA)
     │
     │  HTTP/JSON (localhost:3001 in dev)
     ▼
Node.js HTTP Server (server/index.ts)
     │
     ├── MongoDB Atlas (users, sessions, tickets, subscriptions, OTPs)
     ├── Google OAuth2Client (verifyIdToken)
     ├── Razorpay SDK (order creation + HMAC verify)
     └── Nodemailer → Gmail SMTP (OTP emails)
```

### Request lifecycle
1. Browser calls `/api/*`
2. Rate limit check (IP-based, in-memory)
3. CORS origin validation
4. Route handler executes
5. MongoDB operation(s)
6. JSON response with security headers

### Session model
- Token: 24-byte cryptographic random hex string stored in `localStorage`
- Server: in-memory `Map<token, { user, expiresAt }>` — 24h TTL
- Purge interval: every 30 minutes removes expired entries
- On profile update: session refreshed (TTL reset)

### PDF processing
- Entirely browser-side using WebAssembly
- `pdf-lib` for manipulation, `pdfjs-dist` for rendering, `tesseract.js` for OCR
- Vite manual chunks ensure each library loads lazily (no 2MB initial bundle)

---

## 6. API Reference

All endpoints return `Content-Type: application/json`.  
Protected routes require `Authorization: Bearer <token>` header.

### Public

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/app/config` | Feature flags (Google enabled, OTP enabled, billing enabled) |
| GET | `/api/subscriptions/plans` | Public plan list |
| POST | `/api/auth/signup` | Register with email + password |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/auth/google` | Login/register with Google ID token |
| POST | `/api/auth/otp/request` | Send OTP email (login or reset) |
| POST | `/api/auth/otp/verify` | Verify OTP — returns session or resets password |
| POST | `/api/contact` | Submit contact message |

### Protected (requires Bearer token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/me` | Get current session user |
| POST | `/api/auth/logout` | Invalidate session token |
| GET | `/api/profile` | Get full profile from DB |
| PUT | `/api/profile` | Update name, phone, company, avatar, preferences |
| GET | `/api/dashboard` | Stats: support tickets, billing status, plan |
| POST | `/api/support` | Submit support ticket |
| POST | `/api/billing/create-checkout-session` | Create Razorpay order |
| POST | `/api/billing/verify-payment` | Verify HMAC + upgrade user plan |

### Error format
```json
{ "message": "Human-readable error description." }
```

### HTTP status codes used
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized |
| 404 | Not found |
| 409 | Conflict (duplicate email) |
| 413 | Request body too large |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service not configured |

---

## 7. Setup & Running Locally

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account (free tier works)
- Gmail account with App Password enabled
- Google Cloud project with OAuth 2.0 Client ID
- Razorpay test account

### Step 1 — Clone and install
```bash
git clone <your-repo>
cd pdfsolution
npm install
```

### Step 2 — Configure environment
Copy `.env.example` to `.env` and fill in all values (see Section 8).

### Step 3 — Run dev servers (two terminals)

**Terminal 1 — Frontend:**
```bash
npm run dev
```
Opens at `http://localhost:5173`

**Terminal 2 — Backend:**
```bash
npm run dev:server
```
Runs at `http://localhost:3001`

### Step 4 — Build for production
```bash
npm run build
```
Output in `dist/` — serve with any static host.

---

## 8. Environment Variables

```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/db?retryWrites=true&w=majority
MONGODB_DB_NAME=pdfsolution

# Server
PORT=3001
APP_BASE_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Google OAuth
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-<your-secret>

# Email (OTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (not your account password)
SMTP_FROM=your@gmail.com

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_PLAN_AMOUNT_PRO=49900    # paise (₹499) — optional, this is the default
RAZORPAY_PLAN_AMOUNT_TEAM=149900  # paise (₹1499) — optional, this is the default

# Production
NODE_ENV=production
```

> **Security:** Never commit `.env` to git. Add it to `.gitignore`.

### Gmail App Password setup
1. Google Account → Security → 2-Step Verification (enable it)
2. Security → App passwords → Generate for "Mail"
3. Use the 16-character code as `SMTP_PASS` (spaces are fine)

### Google OAuth setup
1. console.cloud.google.com → Create project
2. APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Authorized JavaScript origins: `http://localhost:5173`, `https://yourdomain.com`
4. Authorized redirect URIs: `http://localhost:5173`
5. Copy Client ID → `GOOGLE_CLIENT_ID`

---

## 9. Security Model

### Authentication security
| Threat | Mitigation |
|---|---|
| Brute-force login | Auth rate limit: 20 req/min per IP |
| Password leaks | scrypt with random 16-byte salt per user |
| Timing attacks | `crypto.timingSafeEqual()` for all secret comparisons |
| Session theft | 24-byte cryptographic random tokens, 24h expiry |
| Stale sessions | Server-side purge every 30 min |
| CSRF | Bearer token in Authorization header (not cookies) |

### Transport security
| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | Force HTTPS for 2 years |
| `X-Frame-Options` | `DENY` | Block clickjacking iframes |
| `X-Content-Type-Options` | `nosniff` | Block MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Browser XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |

### Payment security
- Order created server-side (amount can't be tampered by client)
- Payment verified using Razorpay HMAC-SHA256 signature before plan upgrade
- Razorpay key secret never sent to frontend

### What's NOT yet implemented (roadmap)
- Webhook signature verification for async Razorpay events
- Email verification on signup
- 2FA (TOTP)
- Account lockout after N failed logins
- Audit log

---

## 10. Performance & Efficiency

### Bundle splitting (Vite)
| Chunk | Libraries | Approx Size |
|---|---|---|
| `react-vendor` | react, react-dom | ~140 KB |
| `router-vendor` | react-router-dom | ~35 KB |
| `pdf-lib` | pdf-lib | ~420 KB |
| `pdfjs` | pdfjs-dist | ~450 KB |
| `tesseract` | tesseract.js | ~180 KB |
| App code | All pages + components | ~80 KB |

Each chunk loads **only when needed** (React.lazy + Suspense). A user on the homepage downloads only `react-vendor` + app code (~220 KB). `pdfjs` only loads when they visit `/tools`.

### Server performance
- Raw `http` module — no Express overhead
- MongoDB connection pool: max 10, idle timeout 15s
- In-memory sessions: O(1) lookup
- Rate limiters: O(1) per IP using Map
- Request timeout: 30s (prevents Slowloris attacks)

### Frontend performance
- All PDF processing in browser (no round-trips for file operations)
- `useSearchParams` syncs tool state to URL (shareable, no re-mount)
- AuthModal loaded only when needed (lazy dynamic import)
- CSS-only animations (no JS animation libraries)

---

## 11. Cost Analysis

### Monthly infrastructure costs

| Service | Free Tier | Paid Tier | Your Current Usage |
|---|---|---|---|
| **MongoDB Atlas** | M0: 512 MB, shared | M2: $9/mo (2 GB), M10: $57/mo | M0 (Free) |
| **Gmail SMTP** | 500 emails/day | Google Workspace: $6/user/mo | Free |
| **Google OAuth** | Unlimited | — | Free |
| **Razorpay** | No monthly fee | 2% per transaction | Pay-per-use |
| **Hosting frontend** | Vercel/Netlify free | $20/mo (Pro) | Free |
| **Hosting backend** | Railway free: 500hr/mo | $5/mo (Hobby) | Free / $5 |
| **Domain** | — | ~$10–15/year | ~₹1,000/year |

### Current monthly cost (development)
```
MongoDB Atlas M0:    ₹0
Gmail SMTP:          ₹0
Google OAuth:        ₹0
Razorpay:            ₹0 (2% only on actual payments)
Hosting (dev):       ₹0
─────────────────────────
Total (dev):         ₹0/month
```

### Production cost estimate (up to 1,000 users)
```
MongoDB Atlas M2:    ~₹750/month   ($9)
Railway backend:     ~₹420/month   ($5)
Vercel Pro (CDN):    ₹0            (free tier sufficient)
Domain:              ~₹85/month    (₹1,000/year)
Razorpay (2%):       Variable      (₹10 per ₹499 sale)
─────────────────────────────────────────
Fixed costs:         ~₹1,255/month
```

### Scale-up costs
| Users | DB Tier | Server | Est. Monthly Cost |
|---|---|---|---|
| 0–500 | Atlas M0 (free) | Railway free | ₹500/mo (domain only) |
| 500–2,000 | Atlas M2 ($9) | Railway Hobby ($5) | ₹1,255/mo |
| 2,000–10,000 | Atlas M10 ($57) | Railway Pro ($20) | ₹6,800/mo |
| 10,000+ | Atlas M30 ($189) | Dedicated VPS | ₹20,000+/mo |

---

## 12. Revenue Model & Earnings Potential

### Pricing structure
| Plan | Price | Target User |
|---|---|---|
| **Free** | ₹0/month | Students, occasional users |
| **Pro** | ₹499/month | Freelancers, professionals |
| **Business** | ₹1,499/month | Small teams, SMBs |

### Revenue calculation

**Conservative scenario (100 paid users):**
```
60 Pro users    × ₹499  = ₹29,940/month
15 Business     × ₹1499 = ₹22,485/month
Razorpay 2%              = -₹1,049/month
Infrastructure           = -₹1,255/month
─────────────────────────────────────────
Net profit:              = ₹50,121/month  (~₹6 lakh/year)
```

**Growth scenario (500 paid users):**
```
300 Pro users   × ₹499  = ₹1,49,700/month
100 Business    × ₹1499 = ₹1,49,900/month
Razorpay 2%              = -₹5,992/month
Infrastructure           = -₹6,800/month
─────────────────────────────────────────
Net profit:              = ₹2,86,808/month  (~₹34 lakh/year)
```

### How to grow revenue

1. **SEO / content marketing** — Write blogs like "How to merge PDF files free" — these rank well and drive organic traffic
2. **Referral program** — Give users 1 month free Pro for each referral that converts
3. **Annual billing discount** — Offer 20% off for yearly payment (₹4,790/year instead of ₹5,988) — improves cash flow
4. **API access tier** — Charge developers ₹999/month for API key access to PDF operations
5. **White-label / team seats** — ₹499 per seat/month for companies > 5 users
6. **One-time tools** — Charge ₹99 for a single high-quality OCR or conversion without a subscription

### Conversion rate assumptions
Industry standard SaaS freemium: 2–5% of free users convert to paid.
- At 5,000 free users → 100–250 paid users → ₹50K–₹1.2L/month

---

## 13. Deployment Guide

### Frontend — Vercel (recommended)
```bash
# Connect your GitHub repo to Vercel
# Build command:   npm run build
# Output dir:      dist
# Framework:       Vite
```
Set environment variables in Vercel dashboard (not needed for frontend — all env vars are server-side).

### Backend — Railway
```bash
# 1. Create a Railway project
# 2. Connect GitHub repo
# 3. Set start command:   npx tsx server/index.ts
# 4. Add all .env variables in Railway → Variables tab
# 5. Railway gives you a public URL like: https://pdfsolution-server.up.railway.app
```

Update `.env` (production):
```env
APP_BASE_URL=https://yourapp.vercel.app
ALLOWED_ORIGINS=https://yourapp.vercel.app
PORT=3001
NODE_ENV=production
```

### MongoDB Atlas production setup
1. Upgrade cluster from M0 to M2 (for reliability SLA)
2. Network Access → Add Railway's static IP (or use VPC peering)
3. Database Access → Create a dedicated user with `readWrite` on `pdfsolution` only
4. Enable MongoDB Atlas backups

### DNS & Domain
1. Buy domain on GoDaddy / Namecheap (~$10/year)
2. Vercel: Project → Domains → Add domain → follow DNS instructions
3. Railway: Settings → Networking → Custom Domain
4. Update `ALLOWED_ORIGINS` and `APP_BASE_URL` with production URLs

---

## 14. Crash Prevention & Reliability

The server is hardened against crashes with multiple layers:

### Process-level
```
process.on("uncaughtException")   → logs error, keeps server alive
process.on("unhandledRejection")  → logs error, keeps server alive
process.on("SIGINT/SIGTERM")      → graceful shutdown, closes connections cleanly
```

### Request-level
- **30-second timeout**: requests hanging longer than 30s are auto-closed
- **100 KB body limit**: large payloads (DoS) throw 413 before processing
- **try/catch** around entire request handler: any unhandled error returns 500 instead of crashing

### Database-level
- MongoDB connection pool: max 10 connections, idle timeout 15s
- `serverSelectionTimeoutMS: 30s` — fails fast if Atlas is unreachable
- `tlsAllowInvalidCertificates: true` in dev — prevents Windows TLS handshake failures

### Memory-level
- Rate limiter maps cleaned every 5 minutes (prevents unbounded growth)
- Session map cleaned every 30 minutes (expired entries removed)
- No file uploads stored in memory — PDFs stay in the browser

### For production: Add process manager
```bash
# Install PM2
npm install -g pm2

# Start with auto-restart on crash
pm2 start "npx tsx server/index.ts" --name pdfsolution-server

# Auto-start on system reboot
pm2 save && pm2 startup
```

---

## 15. Known Limitations & Roadmap

### Current limitations
| Limitation | Impact | Fix |
|---|---|---|
| In-memory sessions | Sessions lost on server restart | Move sessions to MongoDB or Redis |
| No email verification | Fake signups possible | Add verify-email flow |
| No webhook handler | Async payment failures unhandled | Add Razorpay webhook endpoint |
| Single server process | No horizontal scaling | Add Redis for shared sessions |
| No file size warning | Large PDFs may be slow | Add client-side file size check |
| OCR runs in main thread | UI may freeze on large PDFs | Move Tesseract to Web Worker |

### Recommended next features
- [ ] **Email verification** on signup
- [ ] **PDF history** — save processed files to MongoDB GridFS
- [ ] **Team management** — invite team members on Business plan
- [ ] **Admin dashboard** — view all users, revenue, tickets
- [ ] **Webhook endpoint** — `/api/billing/webhook` for Razorpay async events
- [ ] **Redis sessions** — persist sessions across server restarts
- [ ] **2FA / TOTP** — Google Authenticator support
- [ ] **API keys** — for developer/automation access
- [ ] **PWA support** — offline tools, installable app
- [ ] **Dark mode** — honour `preferences.darkMode` toggle

---

## Appendix — Quick Reference

### Run commands
```bash
npm run dev           # Frontend dev server (port 5173)
npm run dev:server    # Backend dev server (port 3001)
npm run build         # Production build
npm run preview       # Preview production build locally
```

### Key file locations
| File | Purpose |
|---|---|
| `server/index.ts` | Entire backend |
| `src/lib/AuthContext.tsx` | Global auth state |
| `src/lib/api.ts` | All API calls + token helpers |
| `src/lib/types.ts` | Shared types |
| `src/styles.css` | Entire design system |
| `.env` | All secrets (never commit) |

### Support contact
- **Email:** vishaltiwari101999@gmail.com
- **GitHub:** configured in `src/lib/api.ts`

---

*This documentation was generated for PDF Solution v1.0.0 — April 2026.*
