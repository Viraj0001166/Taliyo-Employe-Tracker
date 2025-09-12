"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import type { Poll } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function PollsWidget() {
  const { toast } = useToast();
  const [uid, setUid] = useState<string | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [responses, setResponses] = useState<Record<string, number[]>>({});
  const [hasVoted, setHasVoted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => setUid(u?.uid || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Poll)).filter(p => p.active);
      setPolls(arr);
    }, () => setPolls([]));
    return () => unsub();
  }, []);

  // Subscribe to my vote and counts per poll
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    for (const p of polls) {
      // my response doc
      if (uid) {
        const myDoc = doc(db, 'polls', p.id, 'responses', uid);
        const unsubMine = onSnapshot(myDoc, (snap) => {
          setHasVoted(prev => ({ ...prev, [p.id]: snap.exists() }));
        });
        unsubs.push(unsubMine);
      }
      // counts
      const unsubCounts = onSnapshot(collection(db, 'polls', p.id, 'responses'), (snap) => {
        const counts = new Array((p.options || []).length).fill(0);
        snap.docs.forEach(d => {
          const idx = Number((d.data() as any)?.optionIndex ?? -1);
          if (idx >= 0 && idx < counts.length) counts[idx] += 1;
        });
        setResponses(prev => ({ ...prev, [p.id]: counts }));
      });
      unsubs.push(unsubCounts);
    }
    return () => { unsubs.forEach(u => u()); };
  }, [polls.map(p => p.id).join('|'), uid]);

  const submit = async (poll: Poll) => {
    if (!uid) { toast({ variant: 'destructive', title: 'Not signed in' }); return; }
    const choice = selected[poll.id];
    if (typeof choice !== 'number') { toast({ variant: 'destructive', title: 'Please select an option' }); return; }
    setSubmitting(prev => ({ ...prev, [poll.id]: true }));
    try {
      await setDoc(doc(db, 'polls', poll.id, 'responses', uid), {
        optionIndex: choice,
        respondedAt: serverTimestamp(),
      });
      toast({ title: 'Thanks for your response!' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Submit failed', description: e?.message || 'Could not submit vote' });
    } finally {
      setSubmitting(prev => ({ ...prev, [poll.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Polls & Surveys</CardTitle>
        <CardDescription>Share your feedback with the team.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {polls.length === 0 && (
          <div className="text-sm text-muted-foreground">No active polls right now.</div>
        )}
        {polls.map((p) => {
          const counts = responses[p.id] || [];
          const total = counts.reduce((a, b) => a + b, 0) || 0;
          const voted = !!hasVoted[p.id];
          return (
            <div key={p.id} className="rounded-lg border p-4 space-y-3">
              <div className="font-medium">{p.question}</div>
              {!voted ? (
                <div className="space-y-3">
                  <RadioGroup value={String(selected[p.id] ?? '')} onValueChange={(v) => setSelected(prev => ({ ...prev, [p.id]: Number(v) }))}>
                    {p.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <RadioGroupItem id={`opt-${p.id}-${idx}`} value={String(idx)} />
                        <Label htmlFor={`opt-${p.id}-${idx}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <Button onClick={() => submit(p)} disabled={!!submitting[p.id]}> {submitting[p.id] && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Submit</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {p.options.map((opt, idx) => {
                    const c = counts[idx] || 0;
                    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
                    return (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-sm"><span>{opt}</span><span className="text-muted-foreground">{c} ({pct}%)</span></div>
                        <Progress value={pct} className="h-2" />
                      </div>
                    );
                  })}
                  <div className="text-xs text-muted-foreground">Total votes: {total}</div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
