"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const apply = (t: "light" | "dark") => {
      setTheme(t);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', t === 'dark');
      }
    };

    // Prefer user profile theme if available
    const unsub = auth.onAuthStateChanged(async (u) => {
      try {
        if (u) {
          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          const t = (snap.exists() && (snap.data() as any).theme) ? (snap.data() as any).theme : getInitialTheme();
          apply(t === 'dark' ? 'dark' : 'light');
        } else {
          apply(getInitialTheme());
        }
      } catch {
        apply(getInitialTheme());
      }
    });
    return () => unsub();
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    try { window.localStorage.setItem("theme", next); } catch {}
    try {
      const u = auth.currentUser;
      if (u) {
        setDoc(doc(db, 'users', u.uid), { theme: next }, { merge: true });
      }
    } catch {}
  };

  return (
    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme" onClick={toggle}>
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
