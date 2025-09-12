
'use client';

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { ArrowLeft, Loader2, Mail, BookOpen, AlertCircle, Smartphone, LogOut, Download, Shield, UserX } from "lucide-react";
import { collection, doc, getDoc, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { SidebarProvider } from "@/components/ui/sidebar";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export default function SettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueMessage, setIssueMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [lastDevice, setLastDevice] = useState<string | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [busyRevoke, setBusyRevoke] = useState(false);
  const [busyExport, setBusyExport] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Check user role
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
           if (userDocSnap.data().role === 'admin') {
            setIsAdmin(true);
           }
           // Fetch last login device from visitorLogs
           try {
             const q = query(
               collection(db, 'visitorLogs'),
               where('employeeId', '==', currentUser.uid),
               orderBy('loginTime', 'desc'),
               limit(1)
             );
             const snap = await getDocs(q);
             if (!snap.empty) {
               const d: any = snap.docs[0].data();
               setLastDevice(d.userAgent || null);
               setLastLoginAt(d.loginTime?.toDate ? d.loginTime.toDate().toLocaleString() : null);
             }
           } catch {}
        } else {
          // Bootstrap a minimal user doc so settings can load without logging out
          const superAdminEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || '';
          const role = currentUser.email && superAdminEmail && currentUser.email.toLowerCase() === superAdminEmail.toLowerCase() ? 'admin' : 'employee';
          const bootstrap = {
            name: currentUser.displayName || (currentUser.email || '').split('@')[0] || 'User',
            email: currentUser.email || '',
            role,
            createdAt: serverTimestamp(),
          } as any;
          await setDoc(userDocRef, bootstrap, { merge: true });
          if (role === 'admin') setIsAdmin(true);
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Settings...</p>
      </div>
    );
  }

  const currentUser = {
    name: user.displayName || "User",
    email: user.email || "",
    avatar: user.photoURL || `https://picsum.photos/seed/${user.email}/100/100`,
  };

  const dashboardPath = isAdmin ? '/admin' : '/dashboard';
  const KB_URL = process.env.NEXT_PUBLIC_KB_URL || 'https://example.com/kb';
  const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hr@example.com';

  async function submitIssue() {
    if (!user) return;
    const msg = issueMessage.trim();
    if (!msg) { toast({ variant: 'destructive', title: 'Please describe the issue' }); return; }
    try {
      await addDoc(collection(db, 'issueReports'), {
        userId: user.uid,
        message: msg,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      setIssueMessage("");
      setIssueOpen(false);
      toast({ title: 'Issue reported', description: 'We will review and respond.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to submit', description: e?.message || 'Try again later' });
    }
  }

  async function revokeAllSessions() {
    if (!user) return;
    setBusyRevoke(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user/revoke-sessions', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Request failed');
      toast({ title: 'All sessions revoked', description: 'You will be signed out on all devices.' });
      await signOut(auth);
      router.push('/');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to revoke', description: e?.message || 'Try again later' });
    } finally {
      setBusyRevoke(false);
    }
  }

  async function downloadMyData() {
    if (!user) return;
    setBusyExport(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/user/export-data', { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e?.message || 'Try again later' });
    } finally {
      setBusyExport(false);
    }
  }

  async function requestAccountDeletion() {
    if (!user) return;
    const reason = deleteReason.trim();
    try {
      await addDoc(collection(db, 'accountDeletionRequests'), {
        userId: user.uid,
        reason: reason || null,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setDeleteReason("");
      setDeleteOpen(false);
      toast({ title: 'Request sent', description: 'An admin will review your request.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to send request', description: e?.message || 'Try again later' });
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <PageHeader title="Settings" user={currentUser} />
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="max-w-4xl mx-auto w-full">
            <Button asChild variant="outline" className="mb-4">
              <Link href={dashboardPath}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
              </Link>
            </Button>
            <div className="grid gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Account Settings</CardTitle>
                        <CardDescription>Manage your account preferences.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                            <span>Dark Mode</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                                Enable or disable the dark theme for the application.
                            </span>
                            </Label>
                            <Switch id="dark-mode" disabled />
                        </div>
                        <div className="flex items-center justify-between space-x-2">
                            <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                            <span>Email Notifications</span>
                            <span className="font-normal leading-snug text-muted-foreground">
                              Receive email notifications for important updates.
                            </span>
                            </Label>
                            <Switch id="email-notifications" defaultChecked disabled />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Support & Help</CardTitle>
                        <CardDescription>Get help or send feedback to Admin/HR.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                        <Button asChild variant="secondary" className="w-full">
                          <a href={`mailto:${SUPPORT_EMAIL}?subject=Support%20Request`}>
                            <Mail className="h-4 w-4 mr-2"/> Contact Admin / HR
                          </a>
                        </Button>
                        <Button asChild variant="outline" className="w-full">
                          <a href={KB_URL} target="_blank" rel="noreferrer">
                            <BookOpen className="h-4 w-4 mr-2"/> Knowledge Base / FAQs
                          </a>
                        </Button>
                        <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
                          <DialogTrigger asChild>
                            <Button variant="default" className="w-full"><AlertCircle className="h-4 w-4 mr-2"/> Report Issue</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Report an Issue</DialogTitle>
                              <DialogDescription>Describe the problem you are facing.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Label htmlFor="issue-msg">Message</Label>
                              <Textarea id="issue-msg" rows={4} value={issueMessage} onChange={(e) => setIssueMessage(e.target.value)} placeholder="What went wrong?"/>
                            </div>
                            <DialogFooter>
                              <Button onClick={submitIssue}>Submit</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Privacy & Security</CardTitle>
                        <CardDescription>Manage your sessions and data.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-1">
                          <div className="font-medium flex items-center"><Smartphone className="h-4 w-4 mr-2"/> Last login device</div>
                          <div className="text-sm text-muted-foreground break-words break-all">{lastDevice || '—'}</div>
                          <div className="text-xs text-muted-foreground">{lastLoginAt ? `Last login: ${lastLoginAt}` : ''}</div>
                          <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <Button className="w-full sm:w-auto" variant="outline" onClick={async () => { await signOut(auth); router.push('/'); }}><LogOut className="h-4 w-4 mr-2"/> Logout current device</Button>
                            <Button className="w-full sm:w-auto" variant="destructive" onClick={revokeAllSessions} disabled={busyRevoke}>{busyRevoke && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Logout from all sessions</Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="font-medium flex items-center"><Shield className="h-4 w-4 mr-2"/> Your data</div>
                          <Button className="w-full sm:w-auto" variant="secondary" onClick={downloadMyData} disabled={busyExport}><Download className="h-4 w-4 mr-2"/> Download my data</Button>
                        </div>
                        <div className="space-y-2">
                          <div className="font-medium flex items-center"><UserX className="h-4 w-4 mr-2"/> Delete Account</div>
                          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                            <DialogTrigger asChild>
                              <Button className="w-full sm:w-auto" variant="destructive">Request account deletion</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Request account deletion</DialogTitle>
                                <DialogDescription>Submit a request. An admin must approve this action.</DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                <Label htmlFor="del-reason">Reason (optional)</Label>
                                <Textarea id="del-reason" rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Tell us why you want to delete your account" />
                              </div>
                              <DialogFooter>
                                <Button variant="destructive" onClick={requestAccountDeletion}>Submit request</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
