
import type { Resource } from './types';

// This file is used for seeding the initial data into Firestore.

export const initialResourcesData: Omit<Resource, 'id'>[] = [
    // 1. Scripts (LinkedIn + Email Outreach)
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "LinkedIn Connection Request",
        content: "Hi [Name], I noticed you’re working in [Industry]. At Taliyo Technologies, we help businesses grow through modern web & digital solutions. Would love to connect!"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "LinkedIn Follow-Up Message",
        content: "Hey [Name], thanks for connecting! We specialize in helping startups & businesses with affordable Website Development, Digital Marketing & Branding. Would you be open to a quick chat?"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "Email Outreach (Short)",
        content: "Subject: Helping [Company Name] grow digitally 🚀\n\nHi [Name], I’m with Taliyo Technologies. We help companies like yours with Website Development, Mobile Apps & Digital Marketing. Let’s schedule a quick 10‑min call to explore?\n\nRegards,\n[Employee Name]\nTaliyo Technologies"
    },

    // 2. Email Templates
    {
        category: "Email Templates",
        title: "Intro Email (1st Contact)",
        content: "Subject: Quick intro — Taliyo Technologies\n\nHi [Name],\n\nI’m [Your Name] from Taliyo Technologies. We build conversion‑focused websites, mobile apps and run ROI‑driven digital marketing for SMEs/startups.\n\nIf increasing leads or improving your digital presence is a priority this quarter, would you be open to a short 10‑minute call this week?\n\nBest regards,\n[Your Name]\nTaliyo Technologies"
    },
    {
        category: "Email Templates",
        title: "Follow-up Email (After 3 days)",
        content: "Subject: Following up on my last email\n\nHi [Name],\n\nCircling back to see if [Company Name] is exploring website/app improvements or digital growth.\n\nWe recently helped [similar company] achieve [result/metric]. Happy to share quick suggestions tailored for you.\n\nCan we book a 10‑minute call this week?\n\nThanks,\n[Your Name]"
    },
    {
        category: "Email Templates",
        title: "Final Nudge Email (Last attempt)",
        content: "Subject: Should I close this thread?\n\nHi [Name],\n\nIf now isn’t the right time, no worries — I’ll pause outreach for now. If you’d like, I can send a quick action plan for [Company Name]’s website or marketing.\n\nWould that be helpful?\n\nRegards,\n[Your Name]"
    },

    // 3. Lead Generation Tools & Links
    {
        category: "Lead Generation Tools & Links",
        title: "Core Tools (Free/Freemium)",
        content: "LinkedIn Search — Main lead source\nApollo.io — 50 free verified emails/month — https://www.apollo.io/\nHunter.io — 25 free emails/month — https://hunter.io/\nCrunchbase — Startup database — https://www.crunchbase.com/\nUbersuggest — SEO/competitor research — https://neilpatel.com/ubersuggest/"
    },
    {
        category: "Lead Generation Tools & Links",
        title: "Google Search Hacks",
        content: "\"startup founders in India site:linkedin.com\"\n\"digital marketing agency emails\""
    },

    // 4. Training & Tutorials
    {
        category: "Training & Tutorials",
        title: "LinkedIn Lead Gen Basics (10‑min video)",
        content: "What to cover:\n• Optimizing profile (headline, banner, about)\n• Finding ICP (search filters)\n• Connection + follow‑up best practices\n\nAdd internal video link here: <your company video link>"
    },
    {
        category: "Training & Tutorials",
        title: "How to use Apollo.io (screenshot tutorial)",
        content: "Steps:\n1) Build a list by role/company/industry\n2) Verify emails (free credits)\n3) Export CSV or copy emails\n4) Respect sending limits & unsubscribe etiquette\n\nAdd internal doc link here: <your company doc link>"
    },
    {
        category: "Training & Tutorials",
        title: "Email Writing Tips (short guide)",
        content: "Guidelines:\n• Keep it under 120 words\n• Subject lines: simple, curiosity‑driven\n• Personalize first 1–2 lines\n• 1 clear CTA (10‑min call?)\n• No heavy attachments, use links"
    },
    {
        category: "Training & Tutorials",
        title: "CRM/Reporting (how to fill daily sheet)",
        content: "Daily process:\n• Add leads + status updates\n• Note responses and next follow‑up date\n• Mark \"Interested\" quickly for manager review\n\nAdd sheet/process link: <your sheet/process link>"
    },

    // 5. Motivation & Guidelines
    {
        category: "Motivation & Guidelines",
        title: "Guidelines (Daily)",
        content: "• Minimum 20 LinkedIn connections per day (compulsory)\n• Report leads daily in tracker sheet\n• Follow scripts but personalize messages\n• Be polite, persistent and professional"
    },
    {
        category: "Motivation & Guidelines",
        title: "Motivation (Quotes)",
        content: "\"Leads don’t come from luck, they come from consistency.\"\n\"Every connection is a potential client – treat them with respect.\""
    },

    // 6. Daily Task Sheet / Workflow
    {
        category: "Daily Task Sheet / Workflow",
        title: "Daily Task Sheet Template",
        content: "Date | Connections Sent | Accepted | Messages Sent | Replies | Interested Leads | Status\n19-Aug | 25 | 12 | 10 | 3 | 1 | Follow-up pending\n\nTip: Maintain a Google Sheet and update daily. Add your company sheet link here: <your sheet link>"
    },

    // 7. Additional Scripts & Templates (to complete the Hub set)
    // 7.1 LinkedIn First Message + Follow-ups
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "LinkedIn First Message (Post-Accept)",
        content: "Hey [Name], thanks for connecting! I’m from Taliyo Technologies — we build conversion-focused websites, mobile apps, and run ROI-driven digital marketing. If you’re exploring growth this quarter, happy to share 2–3 quick ideas tailored for [Company Name]. Interested?"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "LinkedIn Follow-Up 2",
        content: "Hi [Name], looping back in — would you like a short action plan for [Company Name]’s website/marketing? I can send 3 quick wins within 24 hours. Worth a look?"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "LinkedIn Follow-Up 3",
        content: "Hi [Name], last quick nudge from my side — shall I close this thread for now, or send a 2-minute video with ideas for [Company Name]? No pressure either way."
    },

    // 7.2 WhatsApp Scripts
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "WhatsApp Intro Script",
        content: "Hi [Name], this is [Your Name] from Taliyo Technologies. We help startups/SMEs with Websites, Apps and Digital Marketing. If you’re evaluating growth this quarter, can I share 2–3 tailored suggestions for [Company Name]?"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "WhatsApp Service Catalog (Quick)",
        content: "Quick Catalog — Taliyo Services:\n• Website Development (fast, SEO-ready)\n• Mobile App Development (iOS/Android)\n• Digital Marketing (SEO, Ads, SMM)\n• Branding & Design (logos, identity)\nWant a short call this week?"
    },
    {
        category: "Scripts (LinkedIn + Email Outreach)",
        title: "WhatsApp Lead Nurturing",
        content: "Hi [Name], sharing a quick case study: helped [Similar Company] increase leads by [X%] in [Y weeks]. If helpful, I can draft 2–3 ideas for [Company Name]. Would you like that?"
    },

    // 7.3 Email Templates (additional)
    {
        category: "Email Templates",
        title: "Project Proposal Email",
        content: "Subject: Proposal for [Project/Objective]\n\nHi [Name],\n\nAs discussed, please find our proposal attached for [Project/Objective]. It covers scope, milestones, timelines, and pricing.\n\nHighlights:\n• Clear deliverables\n• Rapid iterations\n• Dedicated project manager\n\nHappy to walk you through on a 10-minute call.\n\nBest regards,\n[Your Name]\nTaliyo Technologies"
    },
    {
        category: "Email Templates",
        title: "Invoice / Payment Reminder (Polite)",
        content: "Subject: Gentle reminder — Invoice [#]\n\nHi [Name],\n\nHope you’re doing well. This is a polite reminder regarding Invoice [#] dated [Date] for [Service]. When convenient, could you please confirm the expected payment date?\n\nIf there’s anything needed from our side, happy to help.\n\nThanks a lot,\n[Your Name]"
    },
    {
        category: "Email Templates",
        title: "Client Onboarding Email",
        content: "Subject: Welcome to Taliyo — Next Steps\n\nHi [Name],\n\nWelcome aboard! Here’s a quick onboarding plan:\n1) Kickoff call: confirm goals, milestones\n2) Access: share required logins/files\n3) Communication: Slack/WhatsApp group + weekly update cadence\n\nWe’re excited to partner with [Company Name]. Let’s make this a success!\n\nBest,\n[Your Name]"
    },

    // 7.4 Lead Generation Presets & Groups
    {
        category: "Lead Generation Tools & Links",
        title: "LinkedIn Search Filters (Presets)",
        content: "Presets (use in LinkedIn search):\n• Title: Founder OR Co-founder — Location: United States — Industry: Information Technology\n• Title: Marketing Manager — Location: India — Company headcount: 11–50\n• Title: CTO OR Tech Lead — Industry: E-commerce — Company headcount: 51–200\nTip: Save searches and use daily connection quotas wisely."
    },
    {
        category: "Lead Generation Tools & Links",
        title: "Industry Groups (FB/Slack/WhatsApp)",
        content: "Curated Groups (examples — replace with your links):\n• Facebook: Startup Founders India — <link>\n• Slack: SaaS Growth Community — <link>\n• WhatsApp: Local SMB Owners — <link>\nEngage with value first; avoid spam."
    },
];
