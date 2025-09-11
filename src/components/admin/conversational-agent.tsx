
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, PlusCircle, Trash2, MessageSquare, Paperclip } from "lucide-react";
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';
import { auth, db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, setDoc, updateDoc, getDocs, orderBy, query, deleteDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { MemoryManager } from '@/components/admin/memory-manager';

type Attachment = {
    url: string;
    name: string;
    type?: string;
    size?: number;
};

type Message = {
    role: 'user' | 'model';
    content: string;
    attachments?: Attachment[];
};

type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
};

const CHAT_SESSIONS_KEY = 'admin-chat-sessions';

const initialSession: ChatSession = {
    id: uuidv4(),
    title: 'New Chat',
    messages: [{ role: 'model', content: "Hello! I am the LeadTrack Pulse AI. How can I help you manage your resources today?" }]
};


export function ConversationalAgent() {
  const [isClient, setIsClient] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [adminId, setAdminId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    sessionId: string;
    sessionTitle: string;
    messageIndex: number;
    snippet: string;
  }[]>([]);
  const [pendingScrollTo, setPendingScrollTo] = useState<{ sessionId: string; messageIndex: number } | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setAdminId(u?.uid || null));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isClient) return;
    try {
        const storedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
        if (storedSessions) {
            const parsedSessions = JSON.parse(storedSessions);
            if(Array.isArray(parsedSessions) && parsedSessions.length > 0) {
                setSessions(parsedSessions);
                setActiveSessionId(parsedSessions[0].id);
            }
        }
    } catch (error) {
        console.error("Failed to parse chat sessions from localStorage", error);
        localStorage.removeItem(CHAT_SESSIONS_KEY);
    }
  }, [isClient]);

  // Load existing sessions + messages from Firestore on mount (if adminId present)
  useEffect(() => {
    if (!isClient || !adminId) return;
    (async () => {
      try {
        const sessCol = collection(db, 'aiChats', adminId, 'sessions');
        const sessSnap = await getDocs(query(sessCol, orderBy('updatedAt', 'desc')));
        const loaded: ChatSession[] = [];
        for (const sdoc of sessSnap.docs) {
          const meta: any = sdoc.data();
          const msgsSnap = await getDocs(query(collection(db, 'aiChats', adminId, 'sessions', sdoc.id, 'messages'), orderBy('createdAt')));
          const messages = msgsSnap.docs.map(md => md.data() as Message);
          loaded.push({ id: sdoc.id, title: meta.title || 'New Chat', messages: messages.length ? messages : [{ role: 'model', content: 'Hello! I am the LeadTrack Pulse AI. How can I help you manage your resources today?' }] });
        }
        if (loaded.length > 0) {
          setSessions(loaded);
          setActiveSessionId(loaded[0].id);
        }
      } catch (e) {
        console.error('Failed to load admin chat history from Firestore', e);
      }
    })();
  }, [isClient, adminId]);

  useEffect(() => {
    if (isClient) {
        localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
  }, [sessions, isClient]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [activeSessionId, isLoading]);

  // Compute search results whenever query or sessions change
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const results: { sessionId: string; sessionTitle: string; messageIndex: number; snippet: string }[] = [];
    for (const s of sessions) {
      for (let i = 0; i < s.messages.length; i++) {
        const m = s.messages[i];
        const text = (m.content || '').toLowerCase();
        const idx = text.indexOf(q);
        if (idx !== -1) {
          const original = m.content || '';
          const start = Math.max(0, idx - 40);
          const end = Math.min(original.length, idx + q.length + 60);
          const snippet = `${start > 0 ? '…' : ''}${original.slice(start, end)}${end < original.length ? '…' : ''}`;
          results.push({ sessionId: s.id, sessionTitle: s.title, messageIndex: i, snippet });
          if (results.length >= 50) break; // cap results
        }
      }
      if (results.length >= 50) break;
    }
    setSearchResults(results);
  }, [searchQuery, sessions]);

  // After switching session via search, scroll to message index
  useEffect(() => {
    if (!pendingScrollTo) return;
    if (pendingScrollTo.sessionId !== activeSessionId) return;
    const handle = setTimeout(() => {
      try {
        const container = scrollAreaRef.current;
        if (!container) return;
        const el = container.querySelector(`[data-msg-idx="${pendingScrollTo.messageIndex}"]`) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {}
      setPendingScrollTo(null);
    }, 120);
    return () => clearTimeout(handle);
  }, [activeSessionId, pendingScrollTo]);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  
  const updateSessionMessages = useCallback((newMessages: Message[]) => {
      setSessions(prev => 
          prev.map(session => 
              session.id === activeSessionId 
              ? { ...session, messages: newMessages, title: session.title === 'New Chat' && newMessages.length > 1 ? newMessages[1].content.substring(0, 30) + '...' : session.title } 
              : session
          )
      );
  }, [activeSessionId]);

  const handleSendMessage = async () => {
    if (!input.trim() || !activeSession) return;

    // Prepare attachments (upload first if any)
    let attachments: Attachment[] = [];
    if (adminId && pendingFiles.length > 0) {
      try {
        const uploaded: Attachment[] = [];
        for (const file of pendingFiles) {
          const path = `aiChats/${adminId}/sessions/${activeSession.id}/attachments/${Date.now()}-${uuidv4()}-${file.name}`;
          const refObj = storageRef(storage, path);
          await uploadBytes(refObj, file, { contentType: file.type });
          const url = await getDownloadURL(refObj);
          uploaded.push({ url, name: file.name, type: file.type, size: file.size });
        }
        attachments = uploaded;
      } catch (err) {
        console.error('File upload failed', err);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Some attachments could not be uploaded.' });
      }
    }

    const userMessage: Message = { role: 'user', content: input, attachments: attachments.length ? attachments : undefined };
    const newMessages = [...activeSession.messages, userMessage];
    updateSessionMessages(newMessages);
    
    setInput('');
    setIsLoading(true);
    setPendingFiles([]);

    try {
        // Persist user message to Firestore
        if (adminId) {
          const msgCol = collection(db, 'aiChats', adminId, 'sessions', activeSession.id, 'messages');
          await addDoc(msgCol, { role: 'user', content: userMessage.content, attachments: userMessage.attachments || [], createdAt: Date.now() });
          await updateDoc(doc(db, 'aiChats', adminId, 'sessions', activeSession.id), { updatedAt: Date.now(), ...(activeSession.title === 'New Chat' && newMessages.length > 1 ? { title: newMessages[1].content.substring(0, 30) + '...' } : {}) });
        }
        const chatHistoryForApi = newMessages.slice(1, -1).map(m => ({ role: m.role, content: m.content }));
        const resp = await fetch('/api/admin-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: chatHistoryForApi, prompt: input, adminId: adminId || '' }),
        });
        if (!resp.ok) throw new Error('Admin agent API error');
        const response = await resp.json();
        const modelMessage: Message = { role: 'model', content: response.response };
        updateSessionMessages([...newMessages, modelMessage]);

        // Persist model message
        if (adminId) {
          const msgCol = collection(db, 'aiChats', adminId, 'sessions', activeSession.id, 'messages');
          await addDoc(msgCol, { role: 'model', content: modelMessage.content, createdAt: Date.now() });
          await updateDoc(doc(db, 'aiChats', adminId, 'sessions', activeSession.id), { updatedAt: Date.now() });
        }

    } catch (error: any) {
      console.error("Chat error:", error);
      toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get a response from the AI. Please try again.' });
      updateSessionMessages(newMessages.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const newSession: ChatSession = {
        id: uuidv4(),
        title: 'New Chat',
        messages: [{ role: 'model', content: "New chat started. How can I assist you?" }]
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    // Persist new session + first message
    if (adminId) {
      (async () => {
        try {
          await setDoc(doc(db, 'aiChats', adminId, 'sessions', newSession.id), { title: newSession.title, createdAt: Date.now(), updatedAt: Date.now() });
          await addDoc(collection(db, 'aiChats', adminId, 'sessions', newSession.id, 'messages'), { role: 'model', content: newSession.messages[0].content, createdAt: Date.now() });
        } catch (e) {
          console.error('Failed to create new chat session in Firestore', e);
        }
      })();
    }
  };
  
  const handleDeleteSession = (sessionId: string) => {
    setSessions(prev => {
        const remainingSessions = prev.filter(s => s.id !== sessionId);
        if (remainingSessions.length === 0) {
            const newSession = { ...initialSession, id: uuidv4() };
            setActiveSessionId(newSession.id);
            return [newSession];
        }
        if(activeSessionId === sessionId) {
            setActiveSessionId(remainingSessions[0].id);
        }
        return remainingSessions;
    });
    if (adminId) {
      (async () => {
        try {
          // delete messages
          const msgSnap = await getDocs(query(collection(db, 'aiChats', adminId, 'sessions', sessionId, 'messages')));
          await Promise.all(msgSnap.docs.map(d => deleteDoc(d.ref)));
          // delete session
          await deleteDoc(doc(db, 'aiChats', adminId, 'sessions', sessionId));
        } catch (e) {
          console.error('Failed to delete session from Firestore', e);
        }
      })();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const UserAvatar = () => (
    <Avatar className="h-9 w-9">
        <AvatarFallback>A</AvatarFallback>
    </Avatar>
  )
  
  const ModelAvatar = () => (
    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20">
        <Sparkles className="h-5 w-5 text-primary-foreground" />
    </div>
  )

  if (!isClient) {
      return null; // Or a loading skeleton
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] h-full max-h-[calc(100vh-10rem)] gap-4">
        <Card className="hidden md:flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Chat History</h3>
              <Button variant="ghost" size="icon" onClick={handleNewChat}>
                  <PlusCircle className="h-5 w-5" />
              </Button>
          </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
                <div className="p-2 border-b">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search chats..."
                    className="h-8 text-sm"
                  />
                  {searchQuery.trim().length >= 2 && (
                    <div className="mt-2 max-h-40 overflow-auto space-y-1">
                      <div className="text-xs text-muted-foreground mb-1">Search Results ({searchResults.length})</div>
                      {searchResults.length === 0 && (
                        <div className="text-xs text-muted-foreground">No matches.</div>
                      )}
                      {searchResults.slice(0, 10).map((r, idx) => (
                        <div
                          key={`${r.sessionId}-${r.messageIndex}-${idx}`}
                          className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setActiveSessionId(r.sessionId);
                            setPendingScrollTo({ sessionId: r.sessionId, messageIndex: r.messageIndex });
                          }}
                          title={r.sessionTitle}
                        >
                          <div className="text-xs font-medium truncate">{r.sessionTitle}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <ScrollArea className="h-full">
                    <div className="p-2 space-y-1">
                        {sessions.map(session => (
                            <div key={session.id} className={cn("group flex items-center justify-between p-2 rounded-md cursor-pointer", activeSessionId === session.id ? 'bg-primary/10' : 'hover:bg-muted/50')}>
                                <div className="flex items-start gap-2 truncate" onClick={() => setActiveSessionId(session.id)}>
                                    <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground" />
                                    <span className="text-sm font-medium truncate">{session.title}</span>
                                </div>
                                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteSession(session.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary" />
                AI Administrative Assistant
              </CardTitle>
              <CardDescription>
              Your personal assistant to manage resources and analyze performance.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <MemoryManager adminId={adminId} />
              <Button variant="outline" size="sm" onClick={handleNewChat} className="md:hidden">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Chat
              </Button>
            </div>
          </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ScrollArea className="flex-1 pr-4 -mr-4" ref={scrollAreaRef as any}>
                    <div className="space-y-6">
                        {activeSession?.messages.map((message, index) => (
                        <div
                            key={index}
                            data-msg-idx={index}
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
                            {message.attachments && message.attachments.length > 0 && (
                              <div className={cn("mt-2 space-y-1", message.role === 'user' ? "text-primary-foreground/80" : "text-foreground/80") }>
                                {message.attachments.map((att, i) => (
                                  <div key={i} className="text-xs underline break-all">
                                    <a href={att.url} target="_blank" rel="noreferrer">📎 {att.name}</a>
                                  </div>
                                ))}
                              </div>
                            )}
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
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Create an email template for cold outreach..."
                    className="pr-12 h-11 text-base"
                    disabled={isLoading}
                    />
                    {/* Attachments */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) setPendingFiles(prev => [...prev, ...files]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
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
                    {pendingFiles.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        {pendingFiles.map((f, idx) => (
                          <div key={idx} className="truncate">Pending: {f.name}</div>
                        ))}
                      </div>
                    )}
                </div>
            </CardFooter>
        </Card>
    </div>
  );
}
