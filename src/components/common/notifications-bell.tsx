"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { auth, db } from "@/lib/firebase";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { format } from "date-fns";

interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  type?: string; // e.g. leave, task, announcement
  createdAt?: any;
  read?: boolean;
  link?: string;
}

export function NotificationsBell() {
  const [uid, setUid] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUid(u?.uid || null);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!uid) { setItems([]); setLoading(false); return; }
    const col = collection(db, 'notifications', uid, 'items');
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as NotificationItem));
      setItems(arr);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [uid]);

  const markAllRead = async () => {
    try {
      if (!uid) return;
      const updates = items.filter(i => !i.read).slice(0, 20); // limit batch on client
      await Promise.all(updates.map(i => updateDoc(doc(db, 'notifications', uid, 'items', i.id), { read: true })));
    } catch (e) {
      // no-op
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] h-4 min-w-4 px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <Button variant="ghost" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">You're all caught up.</div>
        ) : (
          items.slice(0, 10).map((n) => (
            <DropdownMenuItem key={n.id} className="flex flex-col items-start whitespace-normal">
              <div className={`text-sm ${!n.read ? 'font-semibold' : ''}`}>{n.title}</div>
              {n.message && <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>}
              {n.createdAt?.seconds && (
                <div className="text-[10px] text-muted-foreground mt-1">{format(new Date(n.createdAt.seconds * 1000), 'dd MMM, hh:mm a')}</div>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
