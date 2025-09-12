
'use client';

import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { ArrowLeft, Loader2 } from "lucide-react";
import { updateProfile, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc, where, setDoc, serverTimestamp } from 'firebase/firestore';
import { SidebarProvider } from "@/components/ui/sidebar";
 
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { TaskField, DailyLog } from "@/lib/types";

export default function ProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  // Extended profile state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneHidden, setPhoneHidden] = useState<boolean>(false);
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [reportingManager, setReportingManager] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [instagram, setInstagram] = useState('');
  const [github, setGithub] = useState('');
  // Avatar images are disabled: we use initials-only avatars across the app
  const [status, setStatus] = useState<'Active' | 'Training' | 'Inactive'>('Active');

  // KPIs
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [latestLog, setLatestLog] = useState<DailyLog | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      try {
        if (currentUser) {
          setUser(currentUser);
          setDisplayName(currentUser.displayName || '');

          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as any;
            if (data.role === 'admin') {
              setIsAdmin(true);
            }
            // Load extended profile values
            setTitle(data.title || '');
            setDepartment(data.department || '');
            setEmployeeCode(data.employeeCode || '');
            setPhone(data.phone || '');
            setPhoneHidden(!!data.phoneHidden);
            setLocationCity(data.locationCity || '');
            setLocationState(data.locationState || '');
            setLocationCountry(data.locationCountry || '');
            setJoiningDate(data.joiningDate || '');
            setReportingManager(data.reportingManager || '');
            setRoleDescription(data.roleDescription || '');
            setLinkedin(data.linkedin || '');
            setInstagram(data.instagram || '');
            setGithub(data.github || '');
            // Avatar images disabled; no avatar URL usage
            setStatus((data.status === 'Training' || data.status === 'Inactive') ? data.status : 'Active');
          } else {
            // Bootstrap a minimal user doc so profile can load without logging out
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
      } catch (error: any) {
        // Handle permission-denied or other Firestore errors gracefully
        console.warn('Profile init error', error);
        toast({ variant: 'destructive', title: 'Access error', description: error?.message || 'Unable to load profile.' });
        // Do not force logout here; keep user on page to retry
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !displayName) return;
    setIsUpdating(true);
    try {
      if (isAdmin) {
        await updateProfile(user, { displayName });
      }
      const userDocRef = doc(db, 'users', user.uid);
      const payload: any = {
        phone,
        phoneHidden,
        locationCity,
        locationState,
        locationCountry,
        roleDescription,
        linkedin,
        instagram,
        github,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
        ...(isAdmin ? {
          name: displayName,
          title,
          department,
          employeeCode,
          joiningDate,
          reportingManager,
          status,
        } : {}),
      };
      await updateDoc(userDocRef, payload);
      
      toast({
        title: "Profile Updated",
        description: "Your display name has been updated successfully.",
      });
      // Create a new user object to trigger re-render in header
      const updatedUser = { ...user, displayName };
      setUser(updatedUser);

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Avatar upload is disabled; initials-only avatars are used globally

  // Load KPIs: taskFields and latest daily log for this user
  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const tfSnap = await getDocs(collection(db, 'taskFields'));
        const tf: TaskField[] = tfSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        const ordered = tf.sort((a,b) => a.label.localeCompare(b.label));
        setTaskFields(ordered);

        const logsRef = collection(db, 'dailyLogs');
        const q = query(logsRef, where('employeeId', '==', user.uid), orderBy('date','desc'), limit(1));
        const logsSnap = await getDocs(q);
        if (!logsSnap.empty) setLatestLog({ id: logsSnap.docs[0].id, ...(logsSnap.docs[0].data() as any) });
        else setLatestLog(null);
      } catch (e) {
        console.warn('KPIs load failed', e);
      }
    };
    load();
  }, [user, db]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Profile...</p>
      </div>
    );
  }

  const currentUser = {
    name: user.displayName || "User",
    email: user.email || "",
    avatar: "",
  };
  
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <PageHeader title="My Profile" user={currentUser} />
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
         <div className="max-w-2xl mx-auto w-full">
            <Button asChild variant="outline" className="mb-4">
              <Link href={dashboardPath}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
              </Link>
            </Button>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>View and update your personal details.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                  <Avatar className="h-20 w-20 shrink-0">
                    <AvatarFallback>{(currentUser.name?.trim()?.charAt(0) || 'U').toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
                <form onSubmit={handleProfileUpdate} className="space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="displayName">Full Name</Label>
                      <Input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your full name" required disabled={!isAdmin} />
                      {!isAdmin && (
                        <p className="text-xs text-muted-foreground">Only admin can change name, job, department, employee ID, joining date, and reporting manager.</p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Digital Marketing Executive" disabled={!isAdmin} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="status">Employment Status</Label>
                      <Select value={status} onValueChange={(v: 'Active' | 'Training' | 'Inactive') => setStatus(v)} disabled={!isAdmin}>
                        <SelectTrigger id="status" className="h-9">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Training">Training</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="department">Department / Team</Label>
                      <Input id="department" type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Marketing" disabled={!isAdmin} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="employeeCode">Employee ID</Label>
                      <Input id="employeeCode" type="text" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="e.g. EMP-123" disabled={!isAdmin} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email (official)</Label>
                      <Input id="email" type="email" value={user.email || ''} disabled />
                    </div>
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="phone">Phone (optional)</Label>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Hide</span>
                          <Switch id="phoneHidden" checked={phoneHidden} onCheckedChange={setPhoneHidden} />
                        </div>
                      </div>
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="locationCity">City</Label>
                      <Input id="locationCity" type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="e.g. Mumbai" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="locationState">State</Label>
                      <Input id="locationState" type="text" value={locationState} onChange={(e) => setLocationState(e.target.value)} placeholder="e.g. Maharashtra" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="locationCountry">Country</Label>
                      <Input id="locationCountry" type="text" value={locationCountry} onChange={(e) => setLocationCountry(e.target.value)} placeholder="e.g. India" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="joiningDate">Joining Date</Label>
                      <Input id="joiningDate" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} disabled={!isAdmin} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="reportingManager">Reporting Manager</Label>
                      <Input id="reportingManager" type="text" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} placeholder="e.g. Jane Doe" disabled={!isAdmin} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="roleDescription">Current Role & Responsibilities</Label>
                    <Textarea id="roleDescription" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} placeholder="Describe your key responsibilities..." rows={4} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input id="linkedin" type="url" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="https://www.linkedin.com/in/username" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input id="instagram" type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://www.instagram.com/username" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="github">GitHub</Label>
                      <Input id="github" type="url" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/username" />
                    </div>
                  </div>

                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-4 md:mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>KPIs (Latest Daily Log)</CardTitle>
                  <CardDescription>Auto-updated from your latest submission.</CardDescription>
                </CardHeader>
                <CardContent>
                  {latestLog ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {taskFields.map(tf => (
                        <div key={tf.id} className="flex items-center justify-between rounded-md border p-3">
                          <span className="text-sm text-muted-foreground">{tf.label}</span>
                          <span className="font-semibold">{String((latestLog as any)[tf.name] ?? 'N/A')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No daily logs found yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
