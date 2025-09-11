
"use client";

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Send, Bot, User, Loader2, Trash2, Download, CloudUpload, Pin as PinIcon, PinOff, FileText, ChevronUp, ChevronDown } from "lucide-react";
import { resourceChat } from '@/ai/flows/resource-chat-flow';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { db, auth } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Message = {
  id?: string;
  role: 'user' | 'model';
  content: string;
};

export function AiChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinned, setPinned] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [tone, setTone] = useState<'friendly' | 'formal' | 'hinglish'>('friendly');
  const [storageKey, setStorageKey] = useState<string>('ai_chat_history');
  const [hydrated, setHydrated] = useState(false);
  const fromRemoteRef = useRef(false);
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const MAX_PINNED = 20;
  const [syncEnabled, setSyncEnabled] = useState<boolean>(true);
  const [syncPrefKey, setSyncPrefKey] = useState<string>('ai_chat_sync_enabled');
  const staticSuggestions = [
    // Email
    'Cold outreach email template',
    'Follow-up email (1)',
    'Follow-up email (2)',
    'Follow-up email (3)',
    'Project proposal email',
    'Invoice / payment reminder email',
    'Client onboarding email',
    'Final nudge email',
    // LinkedIn
    'LinkedIn connection request script',
    'LinkedIn first message (post-accept)',
    'LinkedIn follow-up (1)',
    'LinkedIn follow-up (2)',
    'LinkedIn follow-up (3)',
    // WhatsApp
    'WhatsApp intro message',
    'WhatsApp service catalog (quick)',
    'WhatsApp lead nurturing message',
    // Lead Gen & Tips
    'LinkedIn filters — Founders (US)',
    'LinkedIn filters — Marketing Managers (IN)',
    'Hunter email finder steps',
    'Apollo search tips for B2B',
    'Tips to improve replies this week',
    'Daily task sheet example',
  ];
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Load dynamic suggestions from resources (titles)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'resources'), (snap: any) => {
      const titles = snap.docs
        .map((d: any) => (d.data() as any)?.title as string)
        .filter(Boolean)
        .map((t: string) => t.trim())
        .slice(0, 30);
      setDynamicSuggestions(titles);
    }, (err: any) => {
      console.warn('resource suggestions load failed', err);
      setDynamicSuggestions([]);
    });
    return () => unsub();
  }, []);

  // Compute per-user sync preference key and load preference (default true)
  useEffect(() => {
    const k = `ai_chat_sync_enabled_${auth.currentUser?.uid || 'guest'}`;
    setSyncPrefKey(k);
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(k) : null;
      setSyncEnabled(v === null ? true : v === 'true');
    } catch {
      setSyncEnabled(true);
    }
  }, [storageKey]);

  // Persist sync preference
  useEffect(() => {
    if (!syncPrefKey) return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(syncPrefKey, String(syncEnabled));
      }
    } catch {}
  }, [syncPrefKey, syncEnabled]);

  const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

  // Hydrate messages from localStorage per-user on first mount
  useEffect(() => {
    const key = `ai_chat_history_${auth.currentUser?.uid || 'guest'}`;
    setStorageKey(key);
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // legacy format: only messages
          const withIds = parsed.map((m: Message, i: number) => ({ id: m.id || genId() + '_' + i, ...m }));
          setMessages(withIds);
          setPinned([]);
        } else if (parsed && typeof parsed === 'object') {
          const mArr: Message[] = Array.isArray(parsed.m) ? parsed.m : [];
          const pArr: Message[] = Array.isArray(parsed.p) ? parsed.p : [];
          setMessages(mArr.map((m, i) => ({ id: m.id || genId() + '_' + i, ...m })));
          setPinned(pArr.map((m, i) => ({ id: m.id || genId() + '_p' + i, ...m })));
        } else {
          setMessages([{ id: genId(), role: 'model', content: "Hello! I'm your AI Assistant. How can I help you with company resources today?" }]);
        }
      } else {
        setMessages([{ id: genId(), role: 'model', content: "Hello! I'm your AI Assistant. How can I help you with company resources today?" }]);
      }
    } catch {
      setMessages([{ id: genId(), role: 'model', content: "Hello! I'm your AI Assistant. How can I help you with company resources today?" }]);
    }
    setHydrated(true);
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!hydrated || !storageKey) return;
    try {
      if (typeof window !== 'undefined') {
        const trimmed = messages.slice(-200);
        const trimmedPinned = pinned.slice(0, MAX_PINNED);
        window.localStorage.setItem(storageKey, JSON.stringify({ m: trimmed, p: trimmedPinned }));
      }
    } catch {}
    // Also persist to Firestore for cross-device sync
    const uid = auth.currentUser?.uid;
    if (!uid || !syncEnabled) return;
    if (fromRemoteRef.current) { fromRemoteRef.current = false; return; }
    try {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = window.setTimeout(async () => {
        const docRef = doc(db, 'aiChat', uid);
        const trimmed = messages.slice(-200);
        const trimmedPinned = pinned.slice(0, MAX_PINNED);
        await setDoc(docRef, { m: trimmed, p: trimmedPinned, updatedAt: new Date().toISOString() }, { merge: true });
      }, 600);
    } catch {}
  }, [messages, pinned, storageKey, hydrated]);

  // Subscribe to Firestore updates for cross-device sync
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !syncEnabled) return;
    const docRef = doc(db, 'aiChat', uid);
    const unsub = onSnapshot(docRef, (snap: any) => {
      const data = snap.data();
      if (!data) return;
      const mArr: Message[] = Array.isArray(data.m) ? data.m : [];
      const pArr: Message[] = Array.isArray(data.p) ? data.p : [];
      fromRemoteRef.current = true;
      setMessages(mArr.map((m: Message, i: number) => ({ id: m.id || genId() + '_' + i, ...m })));
      setPinned(pArr.map((m: Message, i: number) => ({ id: m.id || genId() + '_p' + i, ...m })));
    }, (err: any) => {
      console.warn('aiChat firestore sync error', err);
    });
    return () => unsub();
  }, [storageKey, syncEnabled]);

  // If auth state changes, migrate from guest key to user key and keep messages
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u: any) => {
      const newKey = `ai_chat_history_${u?.uid || 'guest'}`;
      if (newKey === storageKey) return;
      try {
        if (typeof window !== 'undefined') {
          const rawNew = window.localStorage.getItem(newKey);
          if (rawNew) {
            const parsed = JSON.parse(rawNew);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed.map((m: Message, i: number) => ({ id: m.id || genId() + '_' + i, ...m })));
            } else if (parsed && typeof parsed === 'object') {
              const mArr: Message[] = Array.isArray(parsed.m) ? parsed.m : [];
              const pArr: Message[] = Array.isArray(parsed.p) ? parsed.p : [];
              setMessages(mArr.map((m, i) => ({ id: m.id || genId() + '_' + i, ...m })));
              setPinned(pArr.map((m, i) => ({ id: m.id || genId() + '_p' + i, ...m })));
            }
          } else {
            const rawOld = window.localStorage.getItem(storageKey);
            if (rawOld) {
              // migrate existing to the new key
              window.localStorage.setItem(newKey, rawOld);
            }
          }
        }
      } catch {}
      setStorageKey(newKey);
    });
    return () => unsub();
  }, [storageKey]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { id: genId(), role: 'user', content: input };
    setMessages((prev: Message[]) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map((m: Message) => ({ role: m.role, content: m.content }));
      const response = await resourceChat({ history: chatHistory, question: input, tone });
      
      const modelMessage: Message = { id: genId(), role: 'model', content: response.answer };
      setMessages((prev: Message[]) => [...prev, modelMessage]);

    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMessage: Message = { id: genId(), role: 'model', content: "Sorry, I encountered an error. Please try again." };
      setMessages((prev: Message[]) => [...prev, errorMessage]);
      toast({
        variant: "destructive",
        title: "AI Error",
        description: error.message || "Failed to get a response from the assistant."
      })
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };
  
    const UserAvatar = () => (
    <Avatar className="h-9 w-9">
        <AvatarFallback>U</AvatarFallback>
    </Avatar>
  )
  
  const ModelAvatar = () => (
    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20">
        <Sparkles className="h-5 w-5 text-primary-foreground" />
    </div>
  )

  const isPinned = (m: Message) => pinned.some((pm: Message) => (pm.id && m.id ? pm.id === m.id : pm.content === m.content && pm.role === m.role));
  const togglePin = (m: Message) => {
    setPinned((prev: Message[]) => {
      const exists = prev.find((pm: Message) => (pm.id && m.id ? pm.id === m.id : pm.content === m.content && pm.role === m.role));
      if (exists) {
        return prev.filter((pm: Message) => (pm.id && m.id ? pm.id !== m.id : !(pm.content === m.content && pm.role === m.role)));
      }
      const next = [{ ...m, id: m.id || genId() }, ...prev];
      return next.slice(0, MAX_PINNED);
    });
  };

  const movePin = (from: number, to: number) => {
    setPinned((prev: Message[]) => {
      if (to < 0 || to >= prev.length || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const clearChatKeepPinned = () => setMessages([]);
  const clearAll = () => { setMessages([]); setPinned([]); };

  const download = (filename: string, content: string, type = 'text/plain') => {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const exportTxt = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pinnedTxt = pinned.map(m => `[${m.role}] ${m.content}`).join('\n');
    const chatTxt = messages.map(m => `[${m.role}] ${m.content}`).join('\n');
    const full = `# Pinned\n${pinnedTxt || '(none)'}\n\n# Chat\n${chatTxt || '(empty)'}\n`;
    download(`ai-chat-${stamp}.txt`, full, 'text/plain;charset=utf-8');
  };

  const exportJson = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = { pinned, messages };
    download(`ai-chat-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
  };

  const syncNow = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      toast({ title: 'Sign in required', description: 'Please sign in to sync to cloud.', variant: 'destructive' });
      return;
    }
    try {
      const docRef = doc(db, 'aiChat', uid);
      const trimmed = messages.slice(-200);
      const trimmedPinned = pinned.slice(0, MAX_PINNED);
      await setDoc(docRef, { m: trimmed, p: trimmedPinned, updatedAt: new Date().toISOString() }, { merge: true });
      toast({ title: 'Synced', description: 'Chat synced to cloud.' });
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e?.message || 'Could not sync now.', variant: 'destructive' });
    }
  };

  return (
    <Card className="h-full max-h-[80vh] flex flex-col shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Bot className="text-primary" />
            AI Resource Assistant
        </CardTitle>
        <CardDescription>
          Ask me anything about company resources, templates, or guidelines.
        </CardDescription>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Tone</span>
            <Select value={tone} onValueChange={(v: 'friendly' | 'formal' | 'hinglish') => setTone(v)}>
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="hinglish">Hinglish</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[...staticSuggestions, ...dynamicSuggestions].slice(0, 50).map((s: string, i: number) => (
              <Button key={`${s}-${i}`} variant="outline" size="sm" className="shrink-0" onClick={() => setInput(s)}>
                {s}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Trash2 className="h-4 w-4 mr-1" /> Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can clear only the conversation or clear everything including pinned.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <Button variant="secondary" onClick={clearChatKeepPinned}>Clear chat (keep pinned)</Button>
                  <AlertDialogAction onClick={clearAll}>Clear all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" className="h-8" onClick={exportTxt}>
              <FileText className="h-4 w-4 mr-1" /> Export .txt
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={exportJson}>
              <Download className="h-4 w-4 mr-1" /> Export .json
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={syncNow} disabled={!auth.currentUser}>
              <CloudUpload className="h-4 w-4 mr-1" /> Sync now
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Sync</span>
              <Switch checked={syncEnabled} onCheckedChange={(v: boolean) => setSyncEnabled(v)} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef as any}>
            <div className="space-y-6">
                {pinned.length > 0 && (
                  <div className="rounded-md border bg-muted/40 p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">Pinned</div>
                    <div className="space-y-2">
                      {pinned.map((pm: Message, idx: number) => (
                        <div key={pm.id || idx} className="flex items-start gap-2">
                          <div className="rounded-md px-3 py-2 bg-background border shadow-sm text-sm">
                            <span className="mr-2 inline-block rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">{pm.role}</span>
                            {pm.content}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button aria-label="Move up" title="Move up" variant="ghost" size="icon" className="h-6 w-6" onClick={() => movePin(idx, idx - 1)} disabled={idx === 0}>
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button aria-label="Move down" title="Move down" variant="ghost" size="icon" className="h-6 w-6" onClick={() => movePin(idx, idx + 1)} disabled={idx === pinned.length - 1}>
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button aria-label="Unpin" title="Unpin" variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePin(pm)}>
                              <PinOff className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((message: Message, index: number) => (
                <div
                    key={index}
                    className={cn(
                    "flex items-start gap-4",
                    message.role === 'user' ? "justify-end" : ""
                    )}
                >
                    {message.role === 'model' && <ModelAvatar />}
                    <div
                    className={cn(
                        "rounded-lg px-4 py-3 max-w-xl shadow-sm",
                        message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border"
                    )}
                    >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label={isPinned(message) ? 'Unpin message' : 'Pin message'}
                        title={isPinned(message) ? 'Unpin' : 'Pin'}
                        onClick={() => togglePin(message)}
                      >
                        {isPinned(message) ? <PinOff className="h-4 w-4" /> : <PinIcon className="h-4 w-4" />}
                      </Button>
                    </div>
                    </div>
                    {message.role === 'user' && <UserAvatar />}
                </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-4">
                        <ModelAvatar />
                        <div className="rounded-lg px-4 py-3 bg-card border flex items-center shadow-sm">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
      </CardContent>
       <CardFooter className="border-t pt-4">
          <div className="relative w-full">
              <Input
              value={input}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., What is the script for a cold call?"
              className="pr-12 h-11 text-base"
              disabled={isLoading}
              />
              <Button
              type="submit"
              size="icon"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-10"
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              >
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
              </Button>
          </div>
      </CardFooter>
    </Card>
  );
}
