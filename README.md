# PDF Solution

> All-in-one PDF workspace — merge, split, compress, rotate, convert, OCR, and more — directly in your browser with zero file uploads.

**Live Demo → [pdfsolution-seven.vercel.app](https://pdfsolution-seven.vercel.app)**

---

## Features

| Tool | Description |
|------|-------------|
| Merge PDF | Combine multiple PDFs with drag-and-drop page ordering |
| Split PDF | Extract specific pages or split every page into its own file |
| Compress PDF | Reduce file size while preserving quality — 100% in-browser |
| Rotate PDF | Rotate all pages 90°, 180°, or 270° in one click |
| PDF to Word | Convert PDF text into a fully editable DOCX file |
| PDF to JPG | Export every page as a high-quality JPG image |
| Image to PDF | Turn JPG / PNG images into a polished PDF |
| Edit PDF | Remove pages, add watermark, rotate in one pass |
| Add Page Numbers | Stamp numbered labels at the bottom of every page |
| Unlock PDF | Remove PDF restrictions and re-save as an open file |
| Extract Text | Pull readable text out of any PDF as a TXT file |
| OCR PDF | Use Tesseract.js to extract text from scanned PDFs |

---

## Tech Stack

**Frontend**
- React 18 + TypeScript + Vite
- React Router v7
- Tailwind CSS
- pdf-lib · pdfjs-dist · Tesseract.js (OCR) · JSZip · docx

**Backend**
- Node.js (raw `node:http` — no Express) + TypeScript
- MongoDB Atlas + native driver
- Google OAuth2 (`google-auth-library`)
- Razorpay payment gateway
- Nodemailer (OTP email delivery)

**DevOps**
- Frontend → Vercel
- Backend → Render
- CI/CD → GitHub (auto-deploy on push)

---

## Architecture

```
pdfsolution/
├── src/                   # React frontend (Vite)
│   ├── pages/             # HomePage, ToolsPage, PricingPage, DashboardPage ...
│   ├── components/        # AuthModal, ErrorBoundary
│   ├── layout/            # Navbar, Footer, ProtectedRoute
│   ├── lib/               # AuthContext, api.ts, types.ts
│   ├── pdfTools.ts        # All PDF processing logic (browser-side)
│   └── pdfPreview.ts      # PDF page thumbnail generation
│
└── server/                # Node.js backend
    ├── index.ts           # Server entry — routing only
    ├── db.ts              # MongoDB connection + collections
    ├── logger.ts          # Structured JSON logger
    ├── security.ts        # Rate limiting, lockout, sanitization, CORS
    ├── session.ts         # In-memory session store (24-hour TTL)
    ├── mailer.ts          # OTP email delivery
    └── routes/
        ├── app.ts         # Health check, app config, subscription plans
        ├── auth.ts        # Signup, login, Google OAuth, OTP
        ├── profile.ts     # User profile + dashboard
        ├── contact.ts     # Contact form + support tickets
        └── billing.ts     # Razorpay checkout + payment verification
```

---

## Security Highlights

- **Rate limiting** — 60 req/min globally, 20 req/min on auth routes
- **Login lockout** — 5 failed attempts triggers 15-minute cooldown
- **Password hashing** — scrypt with random salt (not bcrypt, more memory-hard)
- **HMAC verification** — Razorpay payment signatures validated server-side
- **Input sanitization** — all user text stripped of HTML/script tags
- **Security headers** — CSP, HSTS, X-Frame-Options, Permissions-Policy
- **OTP expiry** — TTL index on MongoDB, codes expire in 10 minutes
- **Request body limit** — 100 KB max prevents DoS attacks
- **Gzip compression** — responses > 512 bytes compressed automatically

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)

### Setup

```bash
# Clone
git clone https://github.com/vishal8291/pdfsolution.git
cd pdfsolution

# Install dependencies
npm install

# Create .env in /server folder
cp server/.env.example server/.env
# Fill in: MONGODB_URI, GOOGLE_CLIENT_ID, RAZORPAY_KEY_ID, SMTP_*

# Run frontend + backend together
npm run dev          # frontend on :5173
npm run dev:server   # backend on :3001
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | — | Database name (default: `pdfsolution`) |
| `GOOGLE_CLIENT_ID` | — | Enables Google OAuth login |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth secret |
| `RAZORPAY_KEY_ID` | — | Enables Razorpay billing |
| `RAZORPAY_KEY_SECRET` | — | Razorpay secret key |
| `SMTP_HOST` | — | Enables OTP email (e.g. `smtp.gmail.com`) |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password / app password |
| `SMTP_FROM` | — | From address for emails |

---

## Subscription Plans

| Plan | Price | Features |
|------|-------|----------|
| Starter | Free | Core PDF tools, browser-based |
| Professional | ₹499/month | Dashboard, history, premium support |
| Business | ₹1499/month | Team billing, high-volume, fast support |

Payments processed via **Razorpay** with server-side HMAC signature verification.

---

## Author

**Vishal Tiwari** — Full Stack Developer
- GitHub: [github.com/vishal8291](https://github.com/vishal8291)
- LinkedIn: [linkedin.com/in/vishal-tiwari-158a5216b](https://linkedin.com/in/vishal-tiwari-158a5216b)
- Email: vishal.buildss@gmail.com
