<div align="center">

# Taliyo Employee Tracker

Modern HR portal for daily logs, tasks, polls, resources, and AI assistance  built with Next.js, Firebase, and Tailwind CSS.

[![Build](https://img.shields.io/badge/build-Automated-22c55e?logo=githubactions&logoColor=white)](https://github.com/Viraj0001166/Taliyo-Employe-Tracker/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-0ea5e9.svg)](#-license)
[![Stars](https://img.shields.io/github/stars/Viraj0001166/Taliyo-Employe-Tracker?style=social)](https://github.com/Viraj0001166/Taliyo-Employe-Tracker/stargazers)
[![Issues](https://img.shields.io/github/issues/Viraj0001166/Taliyo-Employe-Tracker?color=ef4444)](https://github.com/Viraj0001166/Taliyo-Employe-Tracker/issues)
[![PRs](https://img.shields.io/github/issues-pr/Viraj0001166/Taliyo-Employe-Tracker?color=8b5cf6)](https://github.com/Viraj0001166/Taliyo-Employe-Tracker/pulls)
[![Contributions welcome](https://img.shields.io/badge/Contributions-welcome-10b981.svg)](#-contributing)

</div>

##  Table of Contents
- [ About the Project](#-about-the-project)
- [ Features](#-features)
- [ Tech Stack](#-tech-stack)
- [ Installation](#-installation)
- [ Usage](#-usage)
- [ Folder Structure](#-folder-structure)
- [ Contributing](#-contributing)
- [ License](#-license)
- [ Contact](#-contact)

---

##  About the Project

Taliyo Employee Tracker is a unified employee portal that streamlines day-to-day work: log daily tasks, request leaves, track KPIs, participate in polls, browse resources, and get AI-powered help  all in one modern, responsive dashboard.

###  Features
-  Daily Logs & KPI Tracking
-  Assigned Tasks & Quick Stats
-  Company Polls
-  Announcements
-  Resources & Templates Library
-  AI Assistant (Resource-aware)
-  Leave Requests with Status
-  Team Directory
-  Polished UI with dark mode

---

##  Tech Stack

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-06b6d4?logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-111827?logo=radixui&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts-888?logo=recharts&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-ffca28?logo=firebase&logoColor=black)
![Firestore](https://img.shields.io/badge/Firestore-039be5?logo=firebase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![date-fns](https://img.shields.io/badge/date--fns-2d3748?logo=date-fns&logoColor=white)

</div>

---

##  Installation

> Prerequisites: Node 18+, pnpm (recommended) or npm, and a Firebase project.

1) Clone the repo
```bash
git clone https://github.com/Viraj0001166/Taliyo-Employe-Tracker.git
cd Taliyo-Employe-Tracker
```

2) Install dependencies
```bash
# with pnpm
pnpm install

# or with npm
npm install
```

3) Environment setup
```bash
# Copy example env file and fill values
cp .env.example .env.local
```

Required keys (example):
```
# Firebase Web App
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Optional: Google AI (Genkit / Gemini)
GEMINI_API_KEY=...
```

4) Start the dev server
```bash
pnpm dev
# http://localhost:3000
```

---

##  Usage

### Start development
```bash
pnpm dev
```

### Build and preview
```bash
pnpm build
pnpm start
```

<details>
<summary><b> Screenshots / Demos (placeholders)</b></summary>

- Dashboard  
  ![Dashboard](https://placehold.co/1200x650/111111/ffffff?text=Dashboard+Preview)

- AI Assistant  
  ![AI Assistant](https://placehold.co/1200x650/111111/ffffff?text=AI+Assistant+Preview)

- Mobile View  
  ![Mobile](https://placehold.co/420x800/111111/ffffff?text=Mobile+View)

</details>

<details>
<summary><b> Sample API (example)</b></summary>

Suggest improvements from weekly logs:
```bash
curl -X POST http://localhost:3000/api/suggest-improvements \
  -H "Content-Type: application/json" \
  -d '{
    "employeeId":"EMPLOYEE_UID"
  }'
```

Sample response:
```json
{
  "analysis": "Lead generation metrics improved mid-week...",
  "suggestions": "Aim for consistency; set a daily target..."
}
```
</details>

---

##  Folder Structure

```bash
Taliyo-Employe-Tracker/
 docs/
   blueprint.md
   employee-guide-hindi.md
 public/
   logo-circle.svg
   logo-mark.svg
   tech-illustrations/
 src/
   ai/
     flows/
     prompts/
     genkit.ts
   app/
     admin/
     api/
       suggest-improvements/route.ts
     dashboard/page.tsx
     employee/guide/
        page.tsx
        layout.tsx
   components/
     dashboard/
       leave-request.tsx
       weekly-summary.tsx
       ai-chatbot.tsx
     ui/
   hooks/
   lib/
      firebase.ts
      types.ts
 .env.example
 next.config.ts
 tailwind.config.ts
 package.json
 pnpm-lock.yaml
```

---

##  Contributing

[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-5e60ce.svg)](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)

- Submit issues for bugs, enhancements, and ideas.
- Fork the repo and create feature branches from `main`.
- Write clear, concise commit messages.
- Add tests or screenshots when applicable.
- Ensure your PR title and description are descriptive.
- Be kind and follow the code of conduct.

Quick start:
```bash
git checkout -b feat/your-feature
# make changes
git commit -m "feat: add your-feature"
git push origin feat/your-feature
# open a Pull Request on GitHub
```

---

##  License

[![License: MIT](https://img.shields.io/badge/License-MIT-0ea5e9.svg)](LICENSE)

This project is licensed under the MIT License  see the [LICENSE](LICENSE) file for details.

---

##  Contact

- **Maintainer:** Viraj Srivastav  
- **Company:** Taliyo Technologies  
- **Website:** https://taliyotechnologies.com  
- **LinkedIn:** https://linkedin.com/viraj-srivastav/  
- **Email:** cofounder@taliyotechnologies.com

> Replace the placeholders with your real links.

---

<div align="center">

 Built with  by Taliyo Technologies 

</div>
