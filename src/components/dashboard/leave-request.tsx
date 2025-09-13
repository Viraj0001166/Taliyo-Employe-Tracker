"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import type { LeaveRequest } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function LeaveRequestWidget() {
  const { toast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [type, setType] = useState<LeaveRequest['type']>('Casual');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUid(u?.uid || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) { setItems([]); return; }
    const q = query(collection(db, 'leaves'), where('employeeId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as LeaveRequest));
      setItems(arr);
    }, (err) => {
      console.warn('leaves subscribe failed', err);
      setItems([]);
    });
    return () => unsub();
  }, [uid]);

  const submit = async () => {
    if (!uid) { toast({ variant: 'destructive', title: 'Not signed in' }); return; }
    if (!startDate || !endDate) { toast({ variant: 'destructive', title: 'Select dates' }); return; }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leaves'), {
        employeeId: uid,
        type,
        startDate,
        endDate,
        reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      toast({ title: 'Leave requested', description: 'Your request has been submitted.' });
      setReason("");
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed', description: e?.message || 'Could not send request' });
    } finally {
      setSubmitting(false);
    }
  };

  const StatusBadge = ({ s }: { s: LeaveRequest['status'] }) => (
    <span className={`px-2 py-0.5 rounded text-xs ${s === 'approved' ? 'bg-green-100 text-green-700' : s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{s}</span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request Leave</CardTitle>
        <CardDescription>Submit a new leave request and view your recent requests.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-sm mb-1">Type</div>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Casual">Casual</SelectItem>
                <SelectItem value="Sick">Sick</SelectItem>
                <SelectItem value="Earned">Earned</SelectItem>
                <SelectItem value="Unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-sm mb-1">Start Date</div>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <div className="text-sm mb-1">End Date</div>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Submit
            </Button>
          </div>
        </div>
        <div>
          <div className="text-sm mb-1">Reason (optional)</div>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason for leave" />
        </div>
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Range</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(i => (
                <TableRow key={i.id}>
                  <TableCell>{i.startDate} → {i.endDate}</TableCell>
                  <TableCell>{i.type}</TableCell>
                  <TableCell><StatusBadge s={i.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
