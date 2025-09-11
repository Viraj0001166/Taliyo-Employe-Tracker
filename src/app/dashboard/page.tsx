
'use client';
import { PageHeader } from "@/components/common/page-header";
import { AssignedTasks } from "@/components/dashboard/assigned-tasks";
import { DailyTaskForm } from "@/components/dashboard/daily-task-form";
import { WeeklySummary } from "@/components/dashboard/weekly-summary";
import { Announcements } from "@/components/dashboard/announcements";
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { Loader2, LayoutDashboard, BarChart, ClipboardCheck, Users, BookOpen, LogOut, Briefcase, CalendarClock, MessageSquare } from "lucide-react";
import { collection, query, where, onSnapshot, doc, getDoc, limit, addDoc, serverTimestamp, orderBy, Timestamp } from "firebase/firestore";
import type { Employee, AssignedTask, Resource, DailyLog, Announcement, TaskField } from "@/lib/types";
import { format } from 'date-fns';
import { TeamActivity } from "@/components/dashboard/team-activity";
import { AiChatbot } from "@/components/dashboard/ai-chatbot";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider } from "@/components/ui/sidebar";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeamDirectory } from "@/components/dashboard/team-directory";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Resources } from "@/components/dashboard/resources";

function WelcomeCard({ name }: { name: string }) {
  const firstName = name ? name.split(' ')[0] : '';
  return (
    <Card className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground shadow-lg">
        <CardContent className="p-4 md:p-6 flex items-center justify-between">
            <div className="space-y-2">
                <h2 className="text-2xl md:text-3xl font-bold">Good Morning, {firstName}!</h2>
                <p className="text-primary-foreground/80">You have new tasks assigned. It&apos;s a lot of work for today! So let&apos;s start.</p>
                <Button variant="secondary" className="mt-2 text-primary">Review It</Button>
            </div>
            <Image 
                src="https://placehold.co/200x150/FFFFFF/3B82F6/svg?text=Illustration" 
                width={200}
                height={150}
                alt="Welcome illustration"
                className="hidden md:block rounded-lg"
                data-ai-hint="welcome illustration"
            />
        </CardContent>
    </Card>
  )
}

function PlaceholderContent({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string}) {
    return (
        <div className="flex flex-col items-center justify-center text-center h-full min-h-[400px] text-muted-foreground p-8 border-2 border-dashed rounded-xl">
            <Icon className="w-16 h-16 mb-4 text-primary/40" />
            <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
            <p className="max-w-sm">{description}</p>
        </div>
    )
}

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [employeeData, setEmployeeData] = useState<Employee | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            const empData = { id: userDocSnap.id, ...userDocSnap.data() } as Employee;
            
            if (empData.role === 'admin') {
                router.push('/admin');
                return; 
            }
            setUser(currentUser);
            setEmployeeData(empData);
        } else {
           await signOut(auth);
           router.push('/employee/login');
        }
      } else {
        router.push('/employee/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Ensure time-dependent UI (today's date, daily quote) only renders after client mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!employeeData) {
        if (!auth.currentUser) {
             setLoading(false);
        }
        return;
    };

    // Data fetching starts now that we have employeeData
    

    const announcementRef = doc(db, "announcements", "latest");
    const unsubscribeAnnouncement = onSnapshot(announcementRef, (doc) => {
        if (doc.exists()) {
            setAnnouncement({ id: doc.id, ...doc.data()} as Announcement);
        }
    }, (error) => {
        // Handle permission-denied gracefully (often happens during sign-out)
        if ((error as any)?.code === 'permission-denied') {
            console.warn("Announcement listener permission denied (likely signed out)." );
        } else {
            console.error("Announcement listener error:", error);
        }
    });
    
    const resourcesCollection = collection(db, "resources");
    const unsubscribeResources = onSnapshot(resourcesCollection, (snapshot) => {
        setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn("Resources listener permission denied (likely signed out)." );
            setResources([]);
        } else {
            console.error("Resources listener error:", error);
        }
    });


    const tasksCollection = collection(db, "tasks");
    const tasksQuery = query(
        tasksCollection, 
        where("employeeId", "==", employeeData.id)
    );
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
        setAssignedTasks(snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data,
                assignedAt: data.assignedAt instanceof Timestamp ? data.assignedAt.toDate() : new Date(data.assignedAt)
            } as AssignedTask
        }));
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn("Tasks listener permission denied (likely signed out)." );
            setAssignedTasks([]);
        } else {
            console.error("Tasks listener error:", error);
        }
    });


    const logsCollection = collection(db, "dailyLogs");
    const logsQuery = query(
      logsCollection, 
      where("employeeId", "==", employeeData.id),
      orderBy("date", "desc"), 
      limit(7)
    );
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      try {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyLog));
        setDailyLogs(logs.reverse());
      } catch (error) {
        console.error("Error processing daily logs:", error);
        setDailyLogs([]);
      }
    }, (error) => {
      if ((error as any)?.code === 'permission-denied') {
        console.warn("Daily logs listener permission denied (likely signed out)." );
        setDailyLogs([]);
      } else {
        console.error("Daily logs listener error:", error);
      }
    });

    // Subscribe to dynamic task fields for labels used in Quick Stats
    const taskFieldsCollection = collection(db, 'taskFields');
    const unsubscribeTaskFields = onSnapshot(taskFieldsCollection, (snapshot) => {
        const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskField));
        setTaskFields(fields);
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn('taskFields listener permission denied (likely signed out).');
            setTaskFields([]);
        } else {
            console.error('taskFields listener error:', error);
        }
    });
    
    setLoading(false);


    return () => {
        unsubscribeTasks();
        unsubscribeLogs();
        unsubscribeAnnouncement();
        unsubscribeResources();
        unsubscribeTaskFields();
    };
  }, [employeeData]);
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/employee/login');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out.",
      });
    }
  };


  if (loading) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Dashboard...</p>
      </div>
    );
  }
  
  const currentUser = {
    name: employeeData?.name || "",
    email: user?.email || "",
    avatar: employeeData?.avatar || "",
  };
  
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="flex flex-1 flex-col gap-3 md:gap-6 lg:p-4">
            <WelcomeCard name={currentUser.name} />
            {/* Quick Stats + Daily Quote */}
            {(() => {
              // Render stable markup on server; compute dynamic values only after mount
              const safeTodayStr = mounted ? format(new Date(), 'yyyy-MM-dd') : '';
              const todayLog = mounted ? dailyLogs.find(l => l.date === safeTodayStr) : undefined;
              const statItems = taskFields.slice(0, 4).map(field => ({
                label: field.label,
                value: Number((todayLog as any)?.[field.name] ?? 0)
              }));

              let quoteText = 'Loading quote...';
              if (mounted) {
                const motivationResource = resources.find(r =>
                  (r.category || '').toLowerCase().includes('motivation') && (r.title || '').toLowerCase().includes('quote')
                );
                const lines = motivationResource?.content
                  ? motivationResource.content.split('\n').map(l => l.trim()).filter(Boolean)
                  : [];
                const dayOfYear = (d: Date) => {
                  const start = new Date(d.getFullYear(), 0, 0);
                  const diff = d.getTime() - start.getTime();
                  const oneDay = 1000 * 60 * 60 * 24;
                  return Math.floor(diff / oneDay);
                };
                quoteText = lines.length > 0
                  ? lines[dayOfYear(new Date()) % lines.length]
                  : 'Leads don\'t come from luck, they come from consistency.';
              }

              return (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Card className="md:col-span-1 xl:col-span-2">
                    <CardHeader>
                      <CardTitle>Today&apos;s Quick Stats</CardTitle>
                      <CardDescription>
                        {mounted && safeTodayStr ? `Your progress for ${safeTodayStr}.` : 'Your progress for today.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {statItems.length > 0 ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {statItems.map((s, idx) => (
                            <div key={idx} className="rounded-lg border bg-card p-4 text-center">
                              <p className="text-sm text-muted-foreground">{s.label}</p>
                              <p className="text-2xl font-bold mt-1">{Number.isFinite(s.value) ? s.value : 0}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No fields configured yet. Ask your admin to set task fields in Settings.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Motivation of the Day</CardTitle>
                      <CardDescription>Keep pushing — small steps daily.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="italic text-foreground/80">{quoteText}</p>
                    </CardContent>
                  </Card>
                </div>
              );
            })()}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-6 lg:gap-8">
              <div className="lg:col-span-2 xl:col-span-4">
                {employeeData?.id && <DailyTaskForm employeeId={employeeData.id} />}
              </div>
              <div className="lg:col-span-3 xl:col-span-4">
                <Announcements announcement={announcement} />
              </div>
            </div>
          </div>
        );
      case 'recruitment':
        return (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 md:gap-6 p-3 md:p-4">
            <div className="lg:col-span-1 xl:col-span-1">
              <TeamActivity />
            </div>
            <div className="lg:col-span-1 xl:col-span-1">
              <WeeklySummary data={dailyLogs} />
            </div>
          </div>
        );
      case 'interview':
        return (
          <PlaceholderContent icon={CalendarClock} title="Interview Schedules" description="Manage and view your upcoming interview schedules here." />
        );
      case 'training':
        return (
          <div className="grid gap-4 p-3 md:p-4">
            <AssignedTasks tasks={assignedTasks} />
            <Resources resources={resources} />
          </div>
        );
      case 'team':
        return (
          <div className="p-4">
            <PlaceholderContent icon={Users} title="Team Directory" description="The team directory is currently under maintenance." />
          </div>
        );
      case 'chatbot':
        return (
          <div className="p-3 md:p-4 h-full">
            <AiChatbot />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col bg-muted/40">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3 p-4">
              <Image src="/logo-circle.svg" alt="Taliyo Logo" width={32} height={32} className="rounded-lg" />
              <h2 className="text-xl font-semibold text-sidebar-foreground">Taliyo Talent</h2>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('dashboard')} isActive={activeTab === 'dashboard'}>
                  <LayoutDashboard className="h-5 w-5 mr-3" />
                  Dashboard
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('recruitment')} isActive={activeTab === 'recruitment'}>
                  <Briefcase className="h-5 w-5 mr-3" />
                  Recruitment
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('interview')} isActive={activeTab === 'interview'}>
                  <CalendarClock className="h-5 w-5 mr-3" />
                  Interview
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('training')} isActive={activeTab === 'training'}>
                  <BookOpen className="h-5 w-5 mr-3" />
                  Training
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('team')} isActive={activeTab === 'team'}>
                  <Users className="h-5 w-5 mr-3" />
                  Team
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveTab('chatbot')} isActive={activeTab === 'chatbot'}>
                  <MessageSquare className="h-5 w-5 mr-3" />
                  AI Assistant
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-5 w-5 mr-3" />
                  Logout
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 md:pl-64">
          <PageHeader title="My Dashboard" user={currentUser} />
          <main className="flex flex-1 flex-col">{renderContent()}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
