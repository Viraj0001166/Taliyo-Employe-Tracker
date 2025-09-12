"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Trash2, Filter } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, deleteDoc } from "firebase/firestore";
import type { DailyLog, Employee, TaskField } from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function DailyLogsManager() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInline, setSavingInline] = useState(false);
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // Filters
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [qText, setQText] = useState<string>("");

  // Sorting (persistent)
  const [sortBy, setSortBy] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('daily_logs_sort_by') || 'date' : 'date'));
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (typeof window !== 'undefined' ? (localStorage.getItem('daily_logs_sort_dir') as any) || 'desc' : 'desc'));

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Edit Dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DailyLog | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Selection for bulk actions
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkStatus, setBulkStatus] = useState("");

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  // Inline edit helpers
  const dynamicFieldNames = useMemo(() => taskFields.map(f => f.name), [taskFields]);
  const numericFieldNames = useMemo(() => new Set<string>([
    "connectionsSent",
    "accepted",
    "messagesSent",
    "replies",
    "interestedLeads",
    ...dynamicFieldNames,
  ]), [dynamicFieldNames]);

  const startInline = (id: string, field: string, current: any) => {
    setEditingCell({ id, field });
    setEditingValue(String(current ?? ""));
  };

  const cancelInline = () => {
    setEditingCell(null);
    setEditingValue("");
  };

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Employee[];
      setEmployees(list);
    }, () => setEmployees([]));

    const q = query(collection(db, "dailyLogs"), orderBy("date", "desc"));
    const unsubLogs = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as DailyLog[];
      setLogs(list);
      setLoading(false);
    }, (err) => {
      console.error("dailyLogs subscribe", err);
      setLogs([]);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };

  }, []);

  // Subscribe to taskFields for dynamic columns
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'taskFields'), (snapshot) => {
      const fields = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TaskField[];
      setTaskFields(fields);
      setFieldsLoading(false);
    }, (error) => {
      console.error('taskFields subscribe', error);
      setTaskFields([]);
      setFieldsLoading(false);
    });
    return () => unsub();
  }, []);

  // Revert helper for inline undo
  const revertInline = async (id: string, field: string, prevValue: any) => {
    try {
      await updateDoc(doc(db, "dailyLogs", id), { [field]: prevValue });
      setLogs((prev) => prev.map((l) => (l.id === id ? ({ ...l, [field]: prevValue } as any) : l)) as DailyLog[]);
      toast({ title: 'Reverted', description: `${String(field)} restored.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Undo failed', description: 'Could not revert the change.' });
    }
  };

  const commitInline = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    // Validate inputs
    if (numericFieldNames.has(field)) {
      const n = Number(editingValue);
      if (isNaN(n) || n < 0) {
        toast({ variant: 'destructive', title: 'Invalid number', description: 'Please enter a non-negative number.' });
        return; // keep editing active
      }
    }
    if (field === 'sheetLink' && editingValue) {
      try { new URL(editingValue); } catch {
        toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid link (https://...)' });
        return;
      }
    }
    const value: any = (numericFieldNames.has(field) ? Number(editingValue || 0) : editingValue);
    setSavingInline(true);
    try {
      // snapshot previous value for undo
      const prevValue: any = (logs.find((l) => l.id === id) as any)?.[field];
      await updateDoc(doc(db, "dailyLogs", id), { [field]: value });
      // Optimistic UI update
      setLogs((prev) => prev.map((l) => (l.id === id ? ({ ...l, [field]: value } as any) : l)) as DailyLog[]);
      toast({
        title: 'Updated',
        description: `${String(field)} saved.`,
        action: (
          <ToastAction altText="Undo" onClick={() => revertInline(id, field, prevValue)}>Undo</ToastAction>
        )
      });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Update failed", description: `Could not update ${String(field)}.` });
    } finally {
      setSavingInline(false);
      setEditingCell(null);
      setEditingValue("");
    }
  };

  // Bulk status update
  const applyBulkStatus = async () => {
    if (!bulkStatus.trim()) return;
    const ids = selectedIds;
    if (ids.length === 0) return;
    try {
      for (const id of ids) {
        await updateDoc(doc(db, 'dailyLogs', id), { status: bulkStatus });
      }
      toast({ title: 'Status Updated', description: `Updated ${ids.length} log(s).` });
      setSelected({});
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Bulk update failed', description: 'Could not update selected logs.' });
    }
  };

  // CSV helpers/exports
  const csvEscape = (v: string) => /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;

  const exportCsv = () => {
    const headers = [
      "Date","Employee","Connections Sent","Accepted","Messages Sent","Replies","Interested Leads","Status","Sheet Link","Notes"
    ];
    const rows = filtered.map((l) => [
      String(l.date),
      employeeName(l.employeeId),
      String(l.connectionsSent ?? 0),
      String(l.accepted ?? 0),
      String(l.messagesSent ?? 0),
      String(l.replies ?? 0),
      String(l.interestedLeads ?? 0),
      String((l.status as any) ?? ""),
      String((l.sheetLink as any) ?? ""),
      String(l.notes ?? "").replace(/\r?\n/g, ' '),
    ]);
    const csv = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-logs-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportSummaryCsv = () => {
    const headers = ["Employee","Connections Sent","Accepted","Messages Sent","Replies","Interested Leads"];
    const rows = totalsByEmployee.map((t) => [
      t.name,
      String(t.connectionsSent),
      String(t.accepted),
      String(t.messagesSent),
      String(t.replies),
      String(t.interestedLeads),
    ]);
    const csv = [headers.map(csvEscape).join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-logs-summary-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const employeeName = (uid: string) => employees.find((e) => e.id === uid)?.name || uid;

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (employeeFilter && l.employeeId !== employeeFilter) return false;
      if (fromDate && l.date < fromDate) return false;
      if (toDate && l.date > toDate) return false;
      if (qText) {
        const hay = `${l.status || ""} ${l.notes || ""}`.toLowerCase();
        if (!hay.includes(qText.toLowerCase())) return false;
      }
      return true;
    });
  }, [logs, employeeFilter, fromDate, toDate, qText]);

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const getVal = (x: DailyLog) => {
        switch (sortBy) {
          case 'employee': return employeeName(x.employeeId).toLowerCase();
          case 'connectionsSent': return Number(x.connectionsSent || 0);
          case 'accepted': return Number(x.accepted || 0);
          case 'messagesSent': return Number(x.messagesSent || 0);
          case 'replies': return Number(x.replies || 0);
          case 'interestedLeads': return Number(x.interestedLeads || 0);
          case 'status': return String(x.status || '').toLowerCase();
          case 'date': default: return x.date;
        }
      };
      const va: any = getVal(a);
      const vb: any = getVal(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir, employees]);

  // Paged data
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  // Reset to first page when filters change
  useEffect(() => { setPage(1); }, [employeeFilter, fromDate, toDate, qText]);

  // Selection derived (place AFTER filtered is defined)
  // Header checkbox reflects current page selection
  const allSelected = useMemo(() => {
    if (!paged.length) return false;
    return paged.every((l) => selected[l.id]);
  }, [paged, selected]);
  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  const toggleSort = (key: string) => {
    setSortBy((prev) => {
      let nextKey = key;
      setSortDir((d) => {
        const nextDir: 'asc' | 'desc' = prev === key ? (d === 'asc' ? 'desc' : 'asc') : (key === 'date' ? 'desc' : 'asc');
        try { if (typeof window !== 'undefined') { localStorage.setItem('daily_logs_sort_by', nextKey); localStorage.setItem('daily_logs_sort_dir', nextDir); } } catch {}
        return nextDir;
      });
      return nextKey;
    });
  };

  // Totals by employee for filtered range
  const totalsByEmployee = useMemo(() => {
    const map = new Map<string, { name: string; connectionsSent: number; accepted: number; messagesSent: number; replies: number; interestedLeads: number }>();
    filtered.forEach((l) => {
      const key = l.employeeId;
      const entry = map.get(key) || { name: employeeName(key), connectionsSent: 0, accepted: 0, messagesSent: 0, replies: 0, interestedLeads: 0 };
      entry.connectionsSent += Number(l.connectionsSent || 0);
      entry.accepted += Number(l.accepted || 0);
      entry.messagesSent += Number(l.messagesSent || 0);
      entry.replies += Number(l.replies || 0);
      entry.interestedLeads += Number(l.interestedLeads || 0);
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [filtered, employees]);

  const startEdit = (log: DailyLog) => {
    setEditing(log);
    setOpen(true);
  };

  const removeLog = async (log: DailyLog) => {
    try {
      await deleteDoc(doc(db, "dailyLogs", log.id));
      toast({ title: "Deleted", description: `Log ${log.date} removed.` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Delete failed", description: "Could not delete this log." });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const { id, ...rest } = editing as any;
      await updateDoc(doc(db, "dailyLogs", editing.id), {
        date: rest.date || format(new Date(), "yyyy-MM-dd"),
        connectionsSent: Number(rest.connectionsSent) || 0,
        accepted: Number(rest.accepted) || 0,
        messagesSent: Number(rest.messagesSent) || 0,
        replies: Number(rest.replies) || 0,
        interestedLeads: Number(rest.interestedLeads) || 0,
        status: (rest.status || "").toString(),
        sheetLink: (rest.sheetLink || "").toString(),
        notes: (rest.notes || "").toString(),
      });
      toast({ title: "Saved", description: "Log updated successfully." });
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Save failed", description: "Could not update this log." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Logs</CardTitle>
        <CardDescription>View and edit employee daily submissions.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary totals */}
        {totalsByEmployee.length > 0 && (
          <div className="mb-4 overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2">Employee</th>
                  <th className="text-right p-2">Conn.</th>
                  <th className="text-right p-2">Accepted</th>
                  <th className="text-right p-2">Msgs</th>
                  <th className="text-right p-2">Replies</th>
                  <th className="text-right p-2">Interested</th>
                </tr>
              </thead>
              <tbody>
                {totalsByEmployee.map((t, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{t.name}</td>
                    <td className="p-2 text-right">{t.connectionsSent}</td>
                    <td className="p-2 text-right">{t.accepted}</td>
                    <td className="p-2 text-right">{t.messagesSent}</td>
                    <td className="p-2 text-right">{t.replies}</td>
                    <td className="p-2 text-right">{t.interestedLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bulk + Export toolbar */}
        <div className="flex flex-col md:flex-row gap-2 mb-3 items-start md:items-end justify-between">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 w-full">
            <div>
              <Label className="text-xs">Employee</Label>
              <select className="w-full h-9 border rounded-md px-2 text-sm" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
                <option value="">All</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name} ({e.email})</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Search (status/notes)</Label>
              <Input placeholder="e.g., follow-up" value={qText} onChange={(e) => setQText(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            <Button variant="secondary" onClick={exportSummaryCsv}>Export Summary</Button>
            <Button variant="outline" onClick={() => {
              const next: Record<string, boolean> = { ...selected };
              paged.forEach((l) => next[l.id] = true);
              setSelected(next);
            }}>Select Page</Button>
            <Button variant="outline" onClick={() => {
              const next: Record<string, boolean> = { ...selected };
              filtered.forEach((l) => next[l.id] = true);
              setSelected(next);
            }}>Select All Filtered</Button>
            <Button variant="outline" onClick={() => setSelected({})}>Clear Selection</Button>
          </div>
        </div>

        {/* Bulk status editor */}
        <div className="flex gap-2 items-end mb-2">
          <div className="flex flex-col">
            <Label className="text-xs">Bulk Status</Label>
            <Input placeholder="e.g., Follow-up pending" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="h-9 min-w-[240px]" />
          </div>
          <Button onClick={applyBulkStatus} disabled={!bulkStatus.trim() || selectedIds.length === 0}>Apply to Selected ({selectedIds.length})</Button>
        </div>

        {/* Table */}
        <div className="overflow-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 w-8 text-center">
                  <input type="checkbox" aria-label="Select all" checked={allSelected} onChange={(e) => {
                    const checked = e.target.checked;
                    const next: Record<string, boolean> = { ...selected };
                    paged.forEach((l) => next[l.id] = checked);
                    setSelected(next);
                  }} />
                </th>
                <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort('date')}>Date {sortBy==='date' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort('employee')}>Employee {sortBy==='employee' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-right p-2 cursor-pointer" onClick={() => toggleSort('connectionsSent')}>Conn. {sortBy==='connectionsSent' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-right p-2 cursor-pointer" onClick={() => toggleSort('accepted')}>Accepted {sortBy==='accepted' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-right p-2 cursor-pointer" onClick={() => toggleSort('messagesSent')}>Msgs {sortBy==='messagesSent' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-right p-2 cursor-pointer" onClick={() => toggleSort('replies')}>Replies {sortBy==='replies' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-right p-2 cursor-pointer" onClick={() => toggleSort('interestedLeads')}>Interested {sortBy==='interestedLeads' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                <th className="text-left p-2 cursor-pointer" onClick={() => toggleSort('status')}>Status {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</th>
                {/* Dynamic fields as columns */}
                {taskFields.map((f) => (
                  <th key={f.id} className="text-right p-2">{f.label}</th>
                ))}
                <th className="text-left p-2">Sheet</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="p-4 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" /> Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={11} className="p-4 text-center text-muted-foreground">No logs found.</td></tr>
              ) : (
                paged.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={!!selected[l.id]} onChange={(e) => setSelected({ ...selected, [l.id]: e.target.checked })} />
                    </td>
                    <td className="p-2">{l.date}</td>
                    <td className="p-2">{employeeName(l.employeeId)}</td>
                    {/* Inline editable numeric cells */}
                    <td className="p-2 text-right" onDoubleClick={() => startInline(l.id, "connectionsSent", l.connectionsSent)}>
                      {editingCell?.id === l.id && editingCell?.field === "connectionsSent" ? (
                        <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : Number(l.connectionsSent ?? 0)}
                    </td>
                    <td className="p-2 text-right" onDoubleClick={() => startInline(l.id, "accepted", l.accepted)}>
                      {editingCell?.id === l.id && editingCell?.field === "accepted" ? (
                        <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : Number(l.accepted ?? 0)}
                    </td>
                    <td className="p-2 text-right" onDoubleClick={() => startInline(l.id, "messagesSent", l.messagesSent)}>
                      {editingCell?.id === l.id && editingCell?.field === "messagesSent" ? (
                        <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : Number(l.messagesSent ?? 0)}
                    </td>
                    <td className="p-2 text-right" onDoubleClick={() => startInline(l.id, "replies", l.replies)}>
                      {editingCell?.id === l.id && editingCell?.field === "replies" ? (
                        <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : Number(l.replies ?? 0)}
                    </td>
                    <td className="p-2 text-right" onDoubleClick={() => startInline(l.id, "interestedLeads", l.interestedLeads)}>
                      {editingCell?.id === l.id && editingCell?.field === "interestedLeads" ? (
                        <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : Number(l.interestedLeads ?? 0)}
                    </td>
                    {/* Inline editable status */}
                    <td className="p-2" onDoubleClick={() => startInline(l.id, "status", l.status)}>
                      {editingCell?.id === l.id && editingCell?.field === "status" ? (
                        <Input autoFocus className="h-7" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : ((l.status as any) || "")}
                    </td>
                    {/* Dynamic metric columns with inline numeric editing */}
                    {taskFields.map((f) => (
                      <td key={f.id} className="p-2 text-right" onDoubleClick={() => startInline(l.id, f.name, (l as any)[f.name])}>
                        {editingCell?.id === l.id && editingCell?.field === f.name ? (
                          <Input autoFocus className="h-7 text-right" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                        ) : Number((l as any)[f.name] ?? 0)}
                      </td>
                    ))}
                    {/* Inline editable sheet link */}
                    <td className="p-2" onDoubleClick={() => startInline(l.id, "sheetLink", l.sheetLink)}>
                      {editingCell?.id === l.id && editingCell?.field === "sheetLink" ? (
                        <Input autoFocus className="h-7" value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitInline} onKeyDown={(e) => { if (e.key === 'Enter') commitInline(); if (e.key === 'Escape') cancelInline(); }} />
                      ) : (
                        l.sheetLink ? <a className="underline text-primary" href={String(l.sheetLink)} target="_blank" rel="noreferrer">Open</a> : "-"
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <Button variant="outline" size="icon" className="h-8 w-8 mr-1" onClick={() => startEdit(l)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeLog(l)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <select className="h-8 border rounded-md px-2 text-sm" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span>Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Prev</Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</Button>
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Log</DialogTitle>
              <DialogDescription>Update daily metrics or notes.</DialogDescription>
            </DialogHeader>
            {editing && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="col-span-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={String(editing.date || "")} onChange={(e) => setEditing({ ...(editing as any), date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Connections Sent</Label>
                  <Input type="number" value={Number(editing.connectionsSent ?? 0)} onChange={(e) => setEditing({ ...(editing as any), connectionsSent: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Accepted</Label>
                  <Input type="number" value={Number(editing.accepted ?? 0)} onChange={(e) => setEditing({ ...(editing as any), accepted: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Messages Sent</Label>
                  <Input type="number" value={Number(editing.messagesSent ?? 0)} onChange={(e) => setEditing({ ...(editing as any), messagesSent: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Replies</Label>
                  <Input type="number" value={Number(editing.replies ?? 0)} onChange={(e) => setEditing({ ...(editing as any), replies: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Interested Leads</Label>
                  <Input type="number" value={Number(editing.interestedLeads ?? 0)} onChange={(e) => setEditing({ ...(editing as any), interestedLeads: Number(e.target.value) })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Status</Label>
                  <Input value={String(editing.status || "")} onChange={(e) => setEditing({ ...(editing as any), status: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Google Sheet Link</Label>
                  <Input type="url" value={String(editing.sheetLink || "")} onChange={(e) => setEditing({ ...(editing as any), sheetLink: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea rows={4} value={String(editing.notes || "")} onChange={(e) => setEditing({ ...(editing as any), notes: e.target.value })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={saveEdit} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
