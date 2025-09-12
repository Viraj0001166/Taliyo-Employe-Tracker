"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Poll } from "@/lib/types";
import { Check, Loader2, Plus, Trash2, ToggleLeft, ToggleRight, Download } from "lucide-react";

export function PollsManager() {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [creating, setCreating] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [multi, setMulti] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [polls, setPolls] = useState<Poll[]>([]);
  const [results, setResults] = useState<Record<string, number[]>>({});

  useEffect(() => {
    const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Poll));
      setPolls(arr);
    });
    return () => unsub();
  }, []);

  // Load live results for each poll (counts by option) and keep summary up to date
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    for (const p of polls) {
      const rUnsub = onSnapshot(collection(db, 'polls', p.id, 'responses'), (snap) => {
        const counts = new Array((p.options || []).length).fill(0);
        snap.docs.forEach(d => {
          const idx = Number((d.data() as any)?.optionIndex ?? -1);
        if (Array.isArray((d.data() as any)?.optionIndexes)) {
          const arr = (d.data() as any).optionIndexes as number[];
          arr.forEach(i => { if (i >= 0 && i < counts.length) counts[i] += 1; });
        } else if (idx >= 0 && idx < counts.length) {
          counts[idx] += 1;
        }
        });
        setResults(prev => ({ ...prev, [p.id]: counts }));
        // Write summary doc for employees to read
        (async () => {
          try {
            const total = counts.reduce((a, b) => a + b, 0);
            const countsMap: Record<string, number> = {};
            counts.forEach((c, i) => countsMap[String(i)] = c);
            await setDoc(doc(db, 'polls', p.id, 'summary'), { counts: countsMap, total, updatedAt: serverTimestamp() }, { merge: true });
          } catch {}
        })();
      });
      unsubscribers.push(rUnsub);
    }
    return () => { unsubscribers.forEach(u => u()); };
  }, [polls.map(p => p.id).join('|')]);

  const addOption = () => setOptions(prev => [...prev, ""]);
  const updateOption = (i: number, v: string) => setOptions(prev => prev.map((o, idx) => idx === i ? v : o));
  const removeOption = (i: number) => setOptions(prev => prev.filter((_, idx) => idx !== i));

  const createPoll = async () => {
    if (!question.trim()) { toast({ variant: 'destructive', title: 'Question required' }); return; }
    const cleaned = options.map(o => o.trim()).filter(Boolean);
    if (cleaned.length < 2) { toast({ variant: 'destructive', title: 'At least 2 options required' }); return; }
    setCreating(true);
    try {
      const uid = auth.currentUser?.uid || 'admin';
      const metaRef = await addDoc(collection(db, 'polls'), {
        question: question.trim(),
        options: cleaned,
        active: true,
        anonymous,
        multi,
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      // Initialize summary doc
      const zeroMap: Record<string, number> = {};
      for (let i = 0; i < cleaned.length; i++) zeroMap[String(i)] = 0;
      await setDoc(doc(db, 'polls', metaRef.id, 'summary'), { counts: zeroMap, total: 0, updatedAt: serverTimestamp() }, { merge: true });
      setQuestion("");
      setOptions(["Yes", "No"]);
      setAnonymous(false);
      setMulti(false);
      setExpiresAt("");
      toast({ title: 'Poll created' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create failed', description: e?.message || 'Could not create poll' });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (p: Poll) => {
    try {
      await updateDoc(doc(db, 'polls', p.id), { active: !p.active });
    } catch (e: any) { toast({ variant: 'destructive', title: 'Update failed', description: e?.message || 'Could not update' }); }
  };

  const removePoll = async (p: Poll) => {
    try {
      // delete responses subcollection (best effort)
      const snap = await getDocs(collection(db, 'polls', p.id, 'responses'));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch {}
    try {
      await deleteDoc(doc(db, 'polls', p.id));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e?.message || 'Could not delete' });
    }
  };

  const exportCsv = async (p: Poll) => {
    try {
      const respSnap = await getDocs(collection(db, 'polls', p.id, 'responses'));
      const rows: string[] = [];
      rows.push('responseId,type,value');
      respSnap.docs.forEach(d => {
        const data = d.data() as any;
        if (Array.isArray(data.optionIndexes)) {
          rows.push(`${d.id},multi,"[${data.optionIndexes.join(' ')}]"`);
        } else if (typeof data.optionIndex === 'number') {
          rows.push(`${d.id},single,${data.optionIndex}`);
        }
      });
      const csv = rows.join('\n');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `poll-${p.id}-${stamp}.csv`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e?.message || 'Could not export CSV' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Polls & Surveys</CardTitle>
        <CardDescription>Create polls and view live results.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="poll-q">Question</Label>
          <Input id="poll-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Which training should we prioritize next?" />
          <div className="space-y-2">
            <div className="text-sm font-medium">Options</div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <Input value={opt} onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} />
                <Button type="button" variant="outline" onClick={() => removeOption(idx)} disabled={options.length <= 2}>Remove</Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addOption}><Plus className="h-4 w-4 mr-1"/>Add option</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Anonymous
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> Allow multiple selections
            </label>
            <div>
              <Label htmlFor="expires">Expires at (optional)</Label>
              <Input id="expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={createPoll} disabled={creating}>{creating && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Create Poll</Button>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {polls.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-[360px] truncate" title={p.question}>{p.question}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{p.active ? 'Active' : 'Closed'}</div>
                      {p.expiresAt && <div className="text-xs text-muted-foreground">Exp: {(p as any).expiresAt?.seconds ? new Date((p as any).expiresAt.seconds * 1000).toLocaleString() : ''}</div>}
                      <div className="text-xs text-muted-foreground">{p.anonymous ? 'Anonymous' : 'Identified'}{p.multi ? ' • Multi' : ''}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {(p.options || []).map((o, i) => (
                        <div key={i}>{o}: <span className="font-medium text-foreground">{results[p.id]?.[i] ?? 0}</span></div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>{p.active ? <ToggleLeft className="h-4 w-4 mr-1"/> : <ToggleRight className="h-4 w-4 mr-1"/>}{p.active ? 'Close' : 'Open'}</Button>
                      <Button variant="outline" size="sm" onClick={() => exportCsv(p)}><Download className="h-4 w-4 mr-1"/>CSV</Button>
                      <Button variant="destructive" size="sm" onClick={() => removePoll(p)}><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
