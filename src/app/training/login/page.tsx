"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Eye, EyeOff } from 'lucide-react';
import { createVisitorLogForCurrentUser } from '@/lib/visitor';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "";

export default function TrainingLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [portal, setPortal] = useState<'training' | 'employee'>('training');
  const visitorLoggedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (user.email === SUPER_ADMIN_EMAIL) {
          router.push('/admin');
          return;
        }
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().role === 'employee') {
          if (!visitorLoggedRef.current) {
            try { await createVisitorLogForCurrentUser('training'); } catch {}
            visitorLoggedRef.current = true;
          }
          // Training uses the same dashboard, but we could pass a mode if needed
          router.push('/dashboard?mode=training');
        } else {
          setAuthLoading(false);
        }
      } else {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Handle switching between Employee/Training portals
  useEffect(() => {
    if (portal === 'employee') router.push('/employee/login');
  }, [portal, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      if (userCredential.user.email === SUPER_ADMIN_EMAIL) {
        toast({ title: "Admin Login Successful", description: "Redirecting to admin panel..." });
        router.push('/admin');
        return;
      }

      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists() && userDocSnap.data().role === 'employee') {
        toast({ title: "Login Successful", description: "Redirecting to training dashboard..." });
        if (!visitorLoggedRef.current) {
          try { await createVisitorLogForCurrentUser('training'); } catch {}
          visitorLoggedRef.current = true;
        }
        router.push('/dashboard?mode=training');
      } else {
        await signOut(auth);
        toast({ variant: 'destructive', title: 'Access Denied', description: 'This portal is for employees/trainees only.' });
      }
    } catch (error: any) {
      console.error("Firebase Auth Error:", error?.code, error?.message);
      const code = error?.code as string | undefined;
      let description = 'Invalid credentials. Please check your email and password.';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/invalid-login-credentials') {
        description = 'Incorrect email or password.';
      } else if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        description = 'No account found for this email, or the email is invalid.';
      } else if (code === 'auth/user-disabled') {
        description = 'This account has been disabled.';
      } else if (code === 'auth/too-many-requests') {
        description = 'Too many attempts. Please try again later.';
      } else if (code === 'auth/network-request-failed') {
        description = 'Network error. Check your connection and try again.';
      }
      toast({ variant: 'destructive', title: 'Login Failed', description });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Training Portal...</p>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <div className="p-3 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-foreground tracking-tighter">Training Portal</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-balance">Log your practice tasks and prepare for production.</p>
      </div>

      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Welcome Back!</CardTitle>
              <CardDescription>Enter your credentials to access training.</CardDescription>
            </div>
            <div className="min-w-[150px]">
              <Label className="sr-only" htmlFor="portal">Portal</Label>
              <Select value={portal} onValueChange={(v: 'training' | 'employee') => setPortal(v)}>
                <SelectTrigger id="portal" className="h-8">
                  <SelectValue placeholder="Portal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Login to Training
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Not in training?
            {' '}
            <Link href="/employee/login" className="underline hover:text-primary">Login as Employee</Link>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <Link href="/" className="underline hover:text-primary">Back to Home</Link>
      </footer>
    </main>
  );
}
