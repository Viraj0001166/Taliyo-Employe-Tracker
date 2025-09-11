
"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { Send, Loader2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { collection, addDoc, onSnapshot, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { format } from "date-fns"
import type { TaskField, AppConfig, Employee } from "@/lib/types"
import { Skeleton } from "../ui/skeleton"

interface DailyTaskFormProps {
    employeeId: string;
}

export function DailyTaskForm({ employeeId }: DailyTaskFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  // System field names are rendered above as dedicated inputs.
  // Exclude them from dynamic section to prevent duplicates and value overwrite.
  const systemFieldNames = useMemo(() => new Set([
    'connectionsSent', 'accepted', 'messagesSent', 'replies', 'interestedLeads', 'status'
  ]), []);
  const nonSystemTaskFields = useMemo(() => taskFields.filter(f => !systemFieldNames.has(f.name)), [taskFields, systemFieldNames]);
  const allowedTaskFields = useMemo(() =>
    nonSystemTaskFields.filter(f => (f.scope === 'specific' ? (Array.isArray(f.employeeIds) && f.employeeIds.includes(employeeId)) : true))
  , [nonSystemTaskFields, employeeId]);

  useEffect(() => {
    const q = collection(db, 'taskFields');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskField));
      setTaskFields(fields);
      setFieldsLoading(false);
    }, (error) => {
      if ((error as any)?.code === 'permission-denied') {
        console.warn('taskFields listener permission denied (likely signed out).');
        setTaskFields([]);
      } else {
        console.error('taskFields listener error:', error);
      }
      setFieldsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    
    const formData = new FormData(event.currentTarget);
    const formValues: { [key: string]: any } = {};

    allowedTaskFields.forEach(field => {
        formValues[field.name] = Number(formData.get(field.name)) || 0;
    });
    formValues.notes = formData.get('notes') as string;

    // New editable metrics and fields
    const dateStr = (formData.get('logDate') as string) || format(new Date(), 'yyyy-MM-dd');
    const connectionsSent = Number(formData.get('connectionsSent')) || 0;
    const accepted = Number(formData.get('accepted')) || 0;
    const messagesSent = Number(formData.get('messagesSent')) || 0;
    const replies = Number(formData.get('replies')) || 0;
    const interestedLeads = Number(formData.get('interestedLeads')) || 0;
    const status = (formData.get('status') as string) || '';
    const sheetLink = (formData.get('sheetLink') as string) || '';
    
    const currentForm = event.currentTarget;

    const fullLogData = {
        employeeId,
        date: dateStr,
        submittedAt: new Date().toISOString(),
        connectionsSent,
        accepted,
        messagesSent,
        replies,
        interestedLeads,
        status,
        sheetLink,
        ...formValues,
    };

    try {
        // 1. Save to Firestore
        await addDoc(collection(db, 'dailyLogs'), {
            ...fullLogData,
            timestamp: serverTimestamp(),
        });

        // 2. Send to Google Sheet Webhook
        const configDocRef = doc(db, 'config', 'googleSheetWebhookUrl');
        const configDocSnap = await getDoc(configDocRef);
        
        if (configDocSnap.exists()) {
            const config = configDocSnap.data() as AppConfig;
            const userDoc = await getDoc(doc(db, 'users', employeeId));
            const employeeName = userDoc.exists() ? (userDoc.data() as Employee).name : 'Unknown';
            const employeeEmail = auth.currentUser?.email || 'Unknown';

            const webhookUrl = typeof config.url === 'string' ? config.url.trim() : '';
            if (webhookUrl) {
              await fetch(webhookUrl, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                      ...fullLogData,
                      employeeName: employeeName,
                      employeeEmail: employeeEmail,
                  }),
              });
            } else {
              // Warn if webhook URL is not configured
              toast({
                title: 'Webhook Not Configured',
                description: 'Ask your admin to set the Google Sheet webhook URL in Settings.',
              });
            }
        }

        // 3. Show confirmation toast
        toast({
            title: "Log Submitted!",
            description: "Your daily performance has been recorded successfully.",
        });

        // 3b. Remember sheet link for convenience
        try {
          if (sheetLink && typeof window !== 'undefined') {
            window.localStorage.setItem('daily_sheet_link', sheetLink);
          }
        } catch {}

        // 4. Ask AI for a simple improvement suggestion based on recent logs
        try {
          const resp = await fetch('/api/suggest-improvements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const suggestion: string | undefined = data?.suggestions;
            if (suggestion) {
              toast({
                title: 'AI Suggestion',
                description: suggestion,
              });
            }
          }
        } catch (aiErr) {
          console.error('Suggestion fetch failed:', aiErr);
        }

        currentForm.reset();
    } catch(e) {
        console.error("Error submitting log:", e);
        toast({
            variant: 'destructive',
            title: "Submission Failed",
            description: "There was an error saving your log. Please try again.",
        })
    } finally {
        setLoading(false);
    }
  }

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle>Log Your Daily Activity</CardTitle>
        <CardDescription>Update your progress for today.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Editable Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="logDate">Date</Label>
                <Input id="logDate" name="logDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              </div>
            </div>

            {/* Daily Metrics (editable) */}
            <div>
              <Label className="text-sm font-semibold">Daily Metrics</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="connectionsSent" className="text-sm font-medium">Connections Sent</Label>
                  <Input id="connectionsSent" name="connectionsSent" type="number" placeholder="e.g., 25" className="text-center" />
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="accepted" className="text-sm font-medium">Accepted</Label>
                  <Input id="accepted" name="accepted" type="number" placeholder="e.g., 12" className="text-center" />
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="messagesSent" className="text-sm font-medium">Messages Sent</Label>
                  <Input id="messagesSent" name="messagesSent" type="number" placeholder="e.g., 10" className="text-center" />
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="replies" className="text-sm font-medium">Replies</Label>
                  <Input id="replies" name="replies" type="number" placeholder="e.g., 3" className="text-center" />
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="interestedLeads" className="text-sm font-medium">Interested Leads</Label>
                  <Input id="interestedLeads" name="interestedLeads" type="number" placeholder="e.g., 1" className="text-center" />
                </Card>
                <Card className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Input id="status" name="status" type="text" placeholder="e.g., Follow-up pending" className="text-center" />
                </Card>
              </div>
            </div>

            {fieldsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                    <Skeleton className="h-20 rounded-lg" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allowedTaskFields.map(field => (
                        <Card key={field.id} className="p-4 flex flex-col items-center justify-center text-center space-y-2 bg-muted/50">
                            <Label htmlFor={field.name} className="text-sm font-medium">{field.label}</Label>
                            <Input id={field.name} name={field.name} type="number" placeholder={field.placeholder} required className="text-center" />
                        </Card>
                    ))}
                </div>
            )}

          {/* Google Sheet link tip */}
          <div className="space-y-2 pt-2">
            <Label htmlFor="sheetLink">Tip</Label>
            <p className="text-xs text-muted-foreground">Maintain a Google Sheet and update daily. Add your company sheet link here.</p>
            <Input
              id="sheetLink"
              name="sheetLink"
              type="url"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              defaultValue={typeof window !== 'undefined' ? window.localStorage.getItem('daily_sheet_link') || '' : ''}
            />
          </div>

          <div className="space-y-2 pt-4">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Any additional notes or comments..." />
          </div>
          <Button type="submit" className="w-full" disabled={loading || fieldsLoading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {loading ? "Submitting..." : "Submit Log"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
