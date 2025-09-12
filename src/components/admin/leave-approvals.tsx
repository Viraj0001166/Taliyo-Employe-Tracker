"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Filter } from "lucide-react";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, where, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { LeaveRequest } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { notifyUser } from "@/lib/notify";

export function LeaveApprovals() {
  const { toast } = useToast();
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<'all'|'pending'|'approved'|'rejected'>('pending');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'leaves'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as LeaveRequest));
      setItems(arr);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(i => i.status === filter);
  }, [items, filter]);

  const act = async (id: string, employeeId: string, action: 'approved'|'rejected') => {
    try {
      const reviewer = auth.currentUser?.email || auth.currentUser?.uid || 'admin';
      await updateDoc(doc(db, 'leaves', id), { status: action, reviewedBy: reviewer, reviewedAt: serverTimestamp() });
      try { await notifyUser(employeeId, { title: `Leave ${action}`, message: `Your leave request has been ${action}.`, type: 'leave' }); } catch {}
      toast({ title: `Leave ${action}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action failed', description: e?.message || 'Could not update' });
    }
  };

  const StatusBadge = ({ s }: { s: LeaveRequest['status'] }) => (
    <Badge variant={s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'} className="capitalize">{s}</Badge>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Leave Approvals</CardTitle>
            <CardDescription>Review and manage employee leave requests.</CardDescription>
          </div>
          <div className="flex gap-2">
            {(['pending','approved','rejected','all'] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="h-8">
                <Filter className="h-4 w-4 mr-1" /> {f}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2"/>Loading…</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(i => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.employeeId}</TableCell>
                    <TableCell>{i.type}</TableCell>
                    <TableCell>{i.startDate} → {i.endDate}</TableCell>
                    <TableCell><StatusBadge s={i.status} /></TableCell>
                    <TableCell className="text-right">
                      {i.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => act(i.id, i.employeeId, 'rejected')}><X className="h-4 w-4 mr-1"/>Reject</Button>
                          <Button size="sm" onClick={() => act(i.id, i.employeeId, 'approved')}><Check className="h-4 w-4 mr-1"/>Approve</Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
