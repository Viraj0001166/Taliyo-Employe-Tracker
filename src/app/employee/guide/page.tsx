"use client"

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

// Ensure this page is always rendered dynamically to avoid prerender errors
export const dynamic = 'force-dynamic';

export default function EmployeeGuidePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [lang, setLang] = useState<'hi' | 'en'>('hi'); // 'hi' = Hinglish

  useEffect(() => {
    // Initialize language from ?lang= or localStorage
    const urlLang = (searchParams.get('lang') || '').toLowerCase();
    const stored = (typeof window !== 'undefined' ? localStorage.getItem('guideLang') : null) as 'hi' | 'en' | null;
    if (urlLang === 'en' || urlLang === 'hi') {
      setLang(urlLang);
      try { localStorage.setItem('guideLang', urlLang); } catch {}
    } else if (stored === 'en' || stored === 'hi') {
      setLang(stored);
      try { router.replace(`/employee/guide?lang=${stored}`); } catch {}
    } else {
      // Default to Hinglish
      try { router.replace(`/employee/guide?lang=hi`); } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchLang = (next: 'hi' | 'en') => {
    setLang(next);
    try { localStorage.setItem('guideLang', next); } catch {}
    try { router.replace(`/employee/guide?lang=${next}`); } catch {}
  };

  const isHi = lang === 'hi';

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto p-2 sm:p-4 flex flex-wrap items-center gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <Image src="/logo-circle.svg" alt="Taliyo Talent" width={28} height={28} className="rounded-md shrink-0" />
            <span className="hidden sm:inline font-semibold text-sm sm:text-base whitespace-nowrap">Taliyo Talent</span>
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-wrap">
            <Button size="sm" className="h-8 px-3" variant={isHi ? 'default' : 'outline'} onClick={() => switchLang('hi')}>Hinglish</Button>
            <Button size="sm" className="h-8 px-3" variant={!isHi ? 'default' : 'outline'} onClick={() => switchLang('en')}>English</Button>
            <Button asChild size="sm" variant="ghost" className="h-8 px-3">
              <Link href="/dashboard" className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-6 space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Employee Portal – Quick Use Guide {isHi ? '(Hinglish)' : '(English)'}</h1>
          <p className="text-muted-foreground">{isHi ? 'Password change ka part is guide me cover nahi hai.' : 'This guide does not cover the password change flow.'}</p>
        </header>

      {isHi ? (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1) Login & Landing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>App open kijiye aur email/password se login kariye.</li>
              <li>Login ke baad aap seedha apne Dashboard par land karenge.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2) Dashboard Overview</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Aapke KPIs (key numbers) yahan dikhte hain.</li>
              <li>Aaj ke tasks, announcements, polls, aur quick actions ek jagah par.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3) Daily Logs & Attendance</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Daily Logs me aaj ka kaam add kijiye: tasks, time spent, aur short notes.</li>
              <li>Attendance Calendar me Present/Leave status dekh sakte hain.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4) My Tasks & Projects</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Assigned tasks ki list priority aur due date ke saath milegi.</li>
              <li>Kaam complete ho jaaye to “Mark Complete” kariye.</li>
              <li>Project overview se progress samajh me aata hai.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5) Leaves</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Leaves section me dates select karke leave request bhejiye.</li>
              <li>Approval status yahin track hota rahega.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6) Polls & Announcements</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Company polls me participate kijiye.</li>
              <li>Latest announcements yahin par milti hain.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7) Resources & Documents</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Resources me scripts, templates, guides available hain.</li>
              <li>Documents me company policies aur personal docs manage kar sakte hain.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8) Team Directory</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Team members ko quickly find kariye (name/department se search).</li>
              <li>Profile open karke basic details dekh sakte hain.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">9) Profile & Theme</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Profile me apni basic info aur notification preferences update kijiye.</li>
              <li>Light/Dark theme aapki choice.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">10) AI Assistant & Support</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI Assistant se quick help lijiye: scripts, ideas, FAQs.</li>
              <li>Koi issue ho to Support/Help se ticket raise kar sakte hain.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Quick Tips</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Daily Logs roz bharna best practice hai—reports aur KPIs accurate rahte hain.</li>
              <li>Tasks ko “Mark Complete” karte hi team ko status clear hota hai.</li>
              <li>Leaves request pe comments/additional info dena approval fast karta hai.</li>
              <li>Resources ko bookmark baniye—repeat kaam me time bachta hai.</li>
            </ul>
          </section>
        </>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">1) Login & Landing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Open the app and sign in with your email and password.</li>
              <li>After login, you land directly on your Dashboard.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">2) Dashboard Overview</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Your KPIs (key numbers) are visible here.</li>
              <li>Today’s tasks, announcements, polls, and quick actions are in one place.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">3) Daily Logs & Attendance</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>In Daily Logs, add today’s work: tasks, time spent, and short notes.</li>
              <li>Use the Attendance Calendar to view your Present/Leave status.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">4) My Tasks & Projects</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>See assigned tasks with priority and due dates.</li>
              <li>When done, click “Mark Complete”.</li>
              <li>Project overview shows overall progress.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">5) Leaves</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Select dates and submit a leave request.</li>
              <li>Track approval status here.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">6) Polls & Announcements</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Participate in company polls.</li>
              <li>Read the latest announcements.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">7) Resources & Documents</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Find templates, scripts, and guides in Resources.</li>
              <li>Manage company policies and personal documents in Documents.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">8) Team Directory</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Quickly find teammates (search by name/department).</li>
              <li>Open profiles to view basic details.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">9) Profile & Theme</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Update your basic info and notification preferences.</li>
              <li>Choose Light/Dark theme.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">10) AI Assistant & Support</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Get quick help from the AI Assistant: scripts, ideas, and FAQs.</li>
              <li>Raise a support ticket if needed.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Quick Tips</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Filling Daily Logs every day keeps reports and KPIs accurate.</li>
              <li>Mark tasks complete to keep your team updated.</li>
              <li>Adding comments in leave requests helps faster approvals.</li>
              <li>Bookmark frequent Resources to save time on repeat work.</li>
            </ul>
          </section>
        </>
      )}

      <footer className="pt-2 text-sm text-muted-foreground">
        {isHi ? 'Happy productivity! 🎯' : 'Happy productivity! 🎯'}
      </footer>
    </main>
    </>
  );
}
