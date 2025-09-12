"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Poll } from "@/lib/types";
import { Check, Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export function PollsManager() {
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["Yes", "No"]);
  const [creating, setCreating] = useState(false);
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

  // Load live results for each poll (counts by option)
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];
    for (const p of polls) {
      const rUnsub = onSnapshot(collection(db, 'polls', p.id, 'responses'), (snap) => {
        const counts = new Array((p.options || []).length).fill(0);
        snap.docs.forEach(d => {
          const idx = Number((d.data() as any)?.optionIndex ?? -1);
        if (idx >= 0 && idx < counts.length) counts[idx] += 1;
        });
        setResults(prev => ({ ...prev, [p.id]: counts }));
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
      await addDoc(collection(db, 'polls'), {
        question: question.trim(),
        options: cleaned,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      setQuestion("");
      setOptions(["Yes", "No"]);
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
                  <TableCell>{p.active ? 'Active' : 'Closed'}</TableCell>
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
