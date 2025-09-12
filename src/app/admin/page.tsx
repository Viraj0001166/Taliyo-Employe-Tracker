
'use client';
import { PageHeader } from "@/components/common/page-header";
import dynamic from 'next/dynamic';
// Lazy-load heavy modules
const EmployeePerformance = dynamic(() => import('@/components/admin/employee-performance').then(m => m.EmployeePerformance), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading users…</div> });
const Leaderboard = dynamic(() => import('@/components/admin/leaderboard').then(m => m.Leaderboard), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading leaderboard…</div> });
const RecurringTaskForm = dynamic(() => import('@/components/admin/recurring-task-form').then(m => m.RecurringTaskForm), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading task form…</div> });
const BroadcastForm = dynamic(() => import('@/components/admin/broadcast-form').then(m => m.BroadcastForm), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading broadcast…</div> });
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Trophy, ClipboardEdit, Loader2, UserPlus, BookCopy, BarChart4, Briefcase, Settings, Sparkles, LineChart, ListChecks } from "lucide-react";
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AddUserForm } from "@/components/admin/add-user-form";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import type { Employee, PerformanceData, Resource } from "@/lib/types";
const ResourceManager = dynamic(() => import('@/components/admin/resource-manager').then(m => m.ResourceManager), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading resources…</div> });
const VisitorAnalytics = dynamic(() => import('@/components/admin/visitor-analytics').then(m => m.VisitorAnalytics), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading analytics…</div> });
const FakeEmployeeManager = dynamic(() => import('@/components/admin/fake-employee-manager').then(m => m.FakeEmployeeManager), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading manager…</div> });
const AppSettings = dynamic(() => import('@/components/admin/app-settings').then(m => m.AppSettings), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading settings…</div> });
import { Sidebar, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenuBadge } from "@/components/ui/sidebar";
import Image from "next/image";
const AIPerformanceAnalyzer = dynamic(() => import('@/components/admin/ai-performance-analyzer').then(m => m.AIPerformanceAnalyzer), { ssr: false });
const ConversationalAgent = dynamic(() => import('@/components/admin/conversational-agent').then(m => m.ConversationalAgent), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading AI Admin…</div> });
const DailyLogsManager = dynamic(() => import('@/components/admin/daily-logs-manager').then(m => m.DailyLogsManager), { ssr: false, loading: () => <div className="p-4 text-sm text-muted-foreground">Loading logs…</div> });

const SUPER_ADMIN_EMAIL = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "";

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [activeTab, setActiveTab] = useState("users");


  const fetchUsers = useCallback(() => {
    const usersCollection = collection(db, "users");
    // Fetch all users, not just employees, so we can manage admin roles too
    return onSnapshot(usersCollection, (snapshot) => {
      const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(userList);
    }, (error) => {
      if ((error as any)?.code === 'permission-denied') {
        console.warn('Users listener permission denied (likely signed out).');
        setEmployees([]);
      } else {
        console.error("Error fetching users in real-time:", error);
      }
    });
  }, []);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        let authorized = false;
        if (currentUser.email === SUPER_ADMIN_EMAIL) {
            authorized = true;
        } else {
            try {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDocSnapshot = await getDoc(userDocRef);
                if (userDocSnapshot.exists() && userDocSnapshot.data().role === 'admin') {
                    authorized = true;
                }
            } catch (error) {
                console.error("Error checking admin status:", error);
            }
        }

        if (authorized) {
            setUser(currentUser);
            setIsAuthorized(true);
        } else {
            router.push('/admin/login');
        }
      } else {
        router.push('/admin/login');
      }
      // Keep loading until authorized state is fully resolved.
      // setLoading will be set to false in the next useEffect.
    });

    return () => unsubscribe();
}, [router]);

  useEffect(() => {
    if (!isAuthorized) {
        if (auth.currentUser === null) {
            // If there's no user and we are not authorized, we might still be in a redirect loop
            // so we stop loading to show the login page via the redirect.
             setLoading(false);
        }
        return;
    };
    
    const unsubscribeEmployees = fetchUsers();

    const resourcesCollection = collection(db, "resources");
    const unsubscribeResources = onSnapshot(resourcesCollection, (snapshot) => {
        const resourceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
        setResources(resourceList);
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn('Resources listener permission denied (likely signed out).');
            setResources([]);
        } else {
            console.error("Error fetching resources in real-time:", error);
        }
    });

    // Now that we are authorized and listeners are set up, stop loading.
    setLoading(false);

    return () => {
        unsubscribeEmployees();
        unsubscribeResources();
    };

  }, [isAuthorized, fetchUsers]);

  const currentUser = {
    name: user?.displayName || "Admin",
    email: user?.email || "",
    avatar: user?.photoURL || "",
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying Admin Access...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    // This case is handled by the redirect, but as a fallback it prevents rendering.
    // It's important to not show anything sensitive if auth fails.
    return null;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "performance":
        return <EmployeePerformance employees={employees.filter(u => u.role === 'employee')} />;
      case "leaderboard":
        return <Leaderboard data={performanceData} />;
      case "tasks":
        return (
          <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Assign a New Task</CardTitle>
                <CardDescription>Assign a specific or recurring task to an individual employee.</CardDescription>
              </CardHeader>
              <CardContent><RecurringTaskForm employees={employees.filter(u => u.role === 'employee')} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Broadcast Notification</CardTitle>
                <CardDescription>Send a message or notification to all employees at once.</CardDescription>
              </CardHeader>
              <CardContent><BroadcastForm /></CardContent>
            </Card>
          </div>
        );
      case "manage-team":
        return <FakeEmployeeManager />;
      case "users":
        return (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Add New User</CardTitle>
                  <CardDescription>Create a new employee or admin account.</CardDescription>
                </CardHeader>
                <CardContent><AddUserForm onUserAdded={fetchUsers} /></CardContent>
              </Card>
            </div>
            <div className="lg:col-span-2">
              <EmployeePerformance employees={employees} />
            </div>
          </div>
        );
      case "resources":
        return <ResourceManager resources={resources} />;
      case "daily-logs":
        return <DailyLogsManager />;
      case "analytics":
        return <VisitorAnalytics />;
      case "settings":
        return <AppSettings />;
      case "ai-admin":
        return <ConversationalAgent />;
      default:
        return <EmployeePerformance employees={employees} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <Sidebar>
            <SidebarHeader>
                 <div className="flex items-center gap-3 p-4">
                    <Image src="/logo-circle.svg" alt="LeadTrack Logo" width={32} height={32} className="rounded-lg" />
                    <h2 className="text-xl font-semibold text-sidebar-foreground">LeadTrack</h2>
                 </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('users')} isActive={activeTab === 'users'}>
                            <Users className="h-5 w-5 mr-2" />
                            User Management
                            <SidebarMenuBadge>{employees.length}</SidebarMenuBadge>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('performance')} isActive={activeTab === 'performance'}>
                            <BarChart4 className="h-5 w-5 mr-2" />
                            Performance
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('leaderboard')} isActive={activeTab === 'leaderboard'}>
                            <Trophy className="h-5 w-5 mr-2" />
                            Leaderboard
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('tasks')} isActive={activeTab === 'tasks'}>
                           <ClipboardEdit className="h-5 w-5 mr-2" />
                           Task Management
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('manage-team')} isActive={activeTab === 'manage-team'}>
                            <Briefcase className="h-5 w-5 mr-2" />
                            Manage Team
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('resources')} isActive={activeTab === 'resources'}>
                            <BookCopy className="h-5 w-5 mr-2" />
                            Resources
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('analytics')} isActive={activeTab === 'analytics'}>
                           <LineChart className="h-5 w-5 mr-2" />
                           Visitor Analytics
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('daily-logs')} isActive={activeTab === 'daily-logs'}>
                           <ListChecks className="h-5 w-5 mr-2" />
                           Daily Logs
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('ai-admin')} isActive={activeTab === 'ai-admin'}>
                           <Sparkles className="h-5 w-5 mr-2" />
                           AI Admin
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
                 <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setActiveTab('settings')} isActive={activeTab === 'settings'}>
                            <Settings className="h-5 w-5 mr-2" />
                            Settings
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                 </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
         <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-64">
            <PageHeader title="Admin Panel" user={currentUser} />
            <main className="flex-1 gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
              {renderContent()}
            </main>
          </div>
      </div>
    </SidebarProvider>
  );
}
