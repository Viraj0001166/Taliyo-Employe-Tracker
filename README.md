# Taliyo Employee Tracker

A modern employee performance tracking and admin portal built with Next.js, Firebase, and AI-powered insights.

> Internal codename: LeadTrack Pulse (see `docs/blueprint.md`).

## 🚀 Features

- Employee Dashboard
  - Daily task logging (connections, follow-ups, cold emails, leads)
  - Weekly progress summary and charts
  - Resource library with ready-to-use scripts and templates
- Admin Panel
  - User and performance management
  - Team activity feeds and analytics
  - Resource management and broadcast tools
- AI-Powered Insights
  - Performance analysis and suggestions
  - AI conversational tools for admins (Genkit + Google AI)

## 🧰 Tech Stack

- Frontend: Next.js 15 (App Router) + React 18 + TypeScript
- Styling: Tailwind CSS + Shadcn/ui components
- Backend: Firebase (Auth, Firestore, Storage)
- AI: Genkit + Google AI Studio (Gemini)

## 📦 Prerequisites

- Node.js 18+ (recommend LTS)
- npm or pnpm
- Firebase project (to use Auth/Firestore/Storage)
- Google AI Studio API key (Gemini) if you want AI features

## ⚙️ Setup (Local Development)

1) Clone the repository
```bash
git clone https://github.com/Viraj0001166/Taliyo-Employe-Tracker.git
cd Taliyo-Employe-Tracker
```

2) Install dependencies
```bash
# with npm
npm install
# or with pnpm
pnpm install
```

3) Environment variables
- Copy `.env.example` to `.env` and fill in real values.
- Variables prefixed with `NEXT_PUBLIC_` are safe for the browser.

`.env.example` contains:
```
# Google AI Studio / Gemini
GEMINI_API_KEY=

# Firebase Web App Config
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Admin (public, client-side bootstrap only)
NEXT_PUBLIC_SUPER_ADMIN_EMAIL=
```

4) Run the dev server
```bash
npm run dev
# or
pnpm dev
```
The app starts at http://localhost:9002 (see `package.json` -> `dev`).

## 🔢 NPM Scripts

From `package.json`:
- `dev` — Next.js dev with Turbopack on port 9002
- `build` — Next.js production build
- `start` — Start the production server
- `lint` — Lint the project
- `typecheck` — TypeScript type-check only
- `genkit:dev` — Start Genkit runtime and your AI dev server (`src/ai/dev.ts`)
- `genkit:watch` — Same as above but with watch mode

Examples:
```bash
# app dev server
npm run dev

# AI dev tools (in a second terminal)
npm run genkit:dev
```

## 🗂️ Project Structure

```
├─ public/                     # Static assets (logos, svgs, etc.)
├─ src/
│  ├─ app/                     # Next.js App Router pages
│  │  ├─ admin/                # Admin pages
│  │  ├─ employee/             # Employee pages
│  │  ├─ api/                  # Route handlers (API)
│  │  └─ ...
│  ├─ components/              # UI + feature components
│  │  ├─ admin/                # Admin components
│  │  ├─ common/               # Shared components
│  │  └─ ui/                   # Shadcn/ui wrappers
│  ├─ ai/                      # Genkit flows and dev tools
│  ├─ lib/                     # Firebase and utilities
│  └─ hooks/                   # Custom React hooks
├─ docs/                       # Project docs & blueprint
├─ firebase.json               # Firebase configuration
├─ firestore.rules             # Firestore security rules
└─ .env.example                # Example environment variables
```

## 🔐 Security & Environment

- Never commit `.env` files. `.gitignore` already ignores them.
- Only `NEXT_PUBLIC_*` values are exposed on the client. Keep secrets server-side.
- Review `firestore.rules` before going live.

## 🤖 AI / Genkit

- Code: `src/ai/genkit.ts` and `src/ai/flows/*`
- Requires `GEMINI_API_KEY` in `.env`
- Dev tools: `npm run genkit:dev` (or `genkit:watch`)

## 🚢 Deployment

- Vercel (recommended)
  - Add environment variables in Project Settings
  - Build command: `next build`
  - Output: Next.js default

- Firebase Hosting (optional)
  - Ensure your setup supports Next.js SSR (Cloud Functions/Hosting Integration)
  - Configure via `firebase.json`
  - Deploy rules/hosting as needed (requires Firebase CLI)

## 🧪 Testing (coming soon)
- Add test setup (Jest/Playwright) if needed.

## 🧭 Roadmap (ideas)
- Advanced analytics & leaderboards
- Role-based permissions (Granular)
- More AI-driven suggestions & automations

## 🙌 Contributing
- Fork the repo
- Create a feature branch: `git checkout -b feature/amazing-thing`
- Commit changes: `git commit -m "feat: add amazing thing"`
- Push and open a PR

## 📄 License
- MIT (add a `LICENSE` file if not already present)

---

Maintained with 💙 by Taliyo Technologies. Have suggestions? Open an issue or start a discussion!
