
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings, Search } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { SidebarTrigger } from "../ui/sidebar";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { doc, onSnapshot } from "firebase/firestore";

interface PageHeaderProps {
  title: string;
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}

export function PageHeader({ title, user }: PageHeaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [headerUser, setHeaderUser] = useState(user);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      router.push('/');
    } catch (error) {
      console.error("Logout Error:", error);
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: "An error occurred while logging out.",
      });
    }
  };

  useEffect(() => {
    let unsubDoc: undefined | (() => void);
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      try {
        if (u) {
          // Seed from Auth
          setHeaderUser((prev) => ({
            name: u.displayName || prev.name,
            email: u.email || prev.email,
            avatar: u.photoURL || prev.avatar,
          }));
          // Live subscribe to Firestore user doc for avatar/name updates
          try {
            const ref = doc(db, 'users', u.uid);
            unsubDoc = onSnapshot(ref, (snap) => {
              if (snap.exists()) {
                const data = snap.data() as any;
                setHeaderUser((prev) => ({
                  name: (data.name as string) || prev.name,
                  email: (data.email as string) || prev.email,
                  avatar: (data.avatar as string) || prev.avatar,
                }));
              }
            });
          } catch {}
        }
      } catch {}
    });
    return () => { unsubAuth(); if (unsubDoc) unsubDoc(); };
  }, [user.name, user.email, user.avatar]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       <SidebarTrigger className="md:hidden"/>
       <div className="relative ml-auto flex-1 md:grow-0">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-lg bg-card pl-8 md:w-[200px] lg:w-[320px] h-9"
          />
        </div>
        <ThemeToggle />
        <NotificationsBell />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-9 w-9">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{(headerUser.name?.trim()?.charAt(0) || 'U').toUpperCase()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{headerUser.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {headerUser.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile" passHref>
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
              </Link>
              <Link href="/settings" passHref>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
    </header>
  );
}
