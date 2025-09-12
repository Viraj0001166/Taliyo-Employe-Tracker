
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Shield, User } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';

const RotatingTech = dynamic(() => import('@/components/common/rotating-tech'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full rounded-2xl bg-muted/40 animate-pulse min-h-[200px]" />
  ),
});

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "";

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          if (user.email === SUPER_ADMIN_EMAIL) {
            router.push('/admin');
            return;
          }
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            if (userDocSnap.data().role === 'admin') {
              router.push('/admin');
            } else {
              router.push('/dashboard');
            }
          } else {
             await signOut(auth);
             setLoading(false);
          }
        } catch (error) {
          console.error("Error checking user role, redirecting to employee login:", error);
          await signOut(auth);
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-4 sm:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center w-full max-w-6xl mb-12">
        <div className="flex flex-col items-center md:items-start justify-center text-center md:text-left">
          <div className="bg-primary text-primary-foreground p-3 rounded-full mb-4 shadow-lg ring-8 ring-primary/10">
            <Image src="/logo-circle.svg" alt="Taliyo Lead Track Logo" width={48} height={48} className="rounded-full" data-ai-hint="logo company" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tighter text-balance">Welcome to Taliyo Lead Track</h1>
          <p className="text-muted-foreground text-lg mt-4 max-w-2xl text-balance">The all-in-one solution for tracking employee performance and streamlining your workflow.</p>
        </div>
        <div className="w-full">
          <RotatingTech className="h-full" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <CardHeader className="items-center text-center p-8">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <User className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Employee Portal</CardTitle>
              <CardDescription className="text-base">Access your personal dashboard to log tasks and view progress.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button asChild className="w-full text-lg py-7">
                <Link href="/employee/login">
                  Login as Employee
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <CardHeader className="items-center text-center p-8">
               <div className="p-4 rounded-full bg-primary/10 border border-primary/20 mb-4">
                <Shield className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="text-2xl">Admin Portal</CardTitle>
              <CardDescription className="text-base">Access the admin panel to manage users and view analytics.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <Button asChild className="w-full text-lg py-7">
                 <Link href="/admin/login">
                  Login as Admin
                </Link>
              </Button>
            </CardContent>
          </Card>
      </div>
       <footer className="mt-16 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Taliyo Lead Track. All rights reserved.
        <br />
        <Link href="https://taliyotechnologies.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
            Made by Taliyo Technologies
        </Link>
      </footer>
    </main>
  );
}
