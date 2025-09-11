
"use client";

import { useState } from 'react';
import type { Resource } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { db } from '@/lib/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Edit, Trash2, Loader2 } from 'lucide-react';
import { CopyButton } from '../common/copy-button';
import { generateResourceContent } from '@/ai/flows/generate-resource-content-flow';

interface ResourceListProps {
  resources: Resource[];
}

export function ResourceList({ resources }: ResourceListProps) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFormat, setEditFormat] = useState<'email' | 'script' | 'guidelines' | 'checklist'>('email');
  const [editTab, setEditTab] = useState<'edit' | 'preview'>('edit');
  const [editOriginalContent, setEditOriginalContent] = useState('');

  const groupedResources = resources.reduce((acc, resource) => {
    (acc[resource.category] = acc[resource.category] || []).push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  const handleDelete = async (resourceId: string, resourceTitle: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "resources", resourceId));
      toast({
        title: "Resource Deleted",
        description: `"${resourceTitle}" has been successfully deleted.`,
      });
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: "Could not delete the resource. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // ----- Rich Preview helpers -----
  const renderEmailPreview = (text: string) => {
    const lines = text.split('\n').map(l => l.trimEnd());
    let subject: string | undefined = undefined;
    const blocks: React.ReactNode[] = [];
    let bulletBuf: string[] = [];
    let paraBuf: string[] = [];

    const flushBullets = () => {
      if (bulletBuf.length) {
        blocks.push(
          <ul className="list-disc pl-5 space-y-1" key={`ul-${blocks.length}`}>
            {bulletBuf.map((b, i) => <li key={i}>{b.replace(/^[-*]\s*/, '')}</li>)}
          </ul>
        );
        bulletBuf = [];
      }
    };
    const flushPara = () => {
      if (paraBuf.length) {
        blocks.push(<p className="leading-6" key={`p-${blocks.length}`}>{paraBuf.join(' ')}</p>);
        paraBuf = [];
      }
    };

    for (const line of lines) {
      if (!line.trim()) { flushBullets(); flushPara(); continue; }
      if (/^subject\s*:/i.test(line)) { subject = line.replace(/^subject\s*:/i, '').trim(); continue; }
      if (/^[-*]\s+/.test(line)) { flushPara(); bulletBuf.push(line); continue; }
      paraBuf.push(line);
    }
    flushBullets(); flushPara();

    return (
      <div className="space-y-3">
        {subject !== undefined && (
          <div className="text-sm"><span className="font-semibold">Subject:</span> {subject || <span className="italic text-muted-foreground">(none)</span>}</div>
        )}
        {blocks.length ? blocks : <p className="text-sm text-muted-foreground">No content.</p>}
      </div>
    );
  };

  const renderScriptPreview = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-2">
        {lines.map((l, i) => {
          const m = l.match(/^([A-Za-z ]{1,30}):\s*(.*)$/);
          if (m) {
            return (
              <div key={i} className="leading-6">
                <span className="font-semibold">{m[1].trim()}:</span> <span>{m[2]}</span>
              </div>
            );
          }
          if (/^[-*]\s+/.test(l)) {
            return <div key={i} className="pl-5 list-item list-disc">{l.replace(/^[-*]\s*/, '')}</div>;
          }
          return <p key={i} className="leading-6">{l}</p>;
        })}
      </div>
    );
  };

  const renderGuidelinesPreview = (text: string) => {
    const items: string[] = [];
    text.split('\n').forEach((raw) => {
      const l = raw.trim();
      if (!l) return;
      const m = l.match(/^(?:[-*]\s+|\d+[\.)]\s+)?(.*)$/);
      if (m) items.push(m[1].trim()); else items.push(l);
    });
    return (
      <ol className="list-decimal pl-5 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="leading-6">
            {it}
          </li>
        ))}
      </ol>
    );
  };

  const renderChecklistPreview = (text: string) => {
    const rows = text.split('\n').map((raw) => raw.trim()).filter(Boolean);
    const parse = (l: string) => {
      let content = l;
      let checked = false;
      const m = l.match(/^[-*]\s*\[(.| )\]\s*(.*)$/i);
      if (m) {
        checked = String(m[1]).toLowerCase() === 'x';
        content = m[2];
      } else {
        // if line mentions done/completed, mark checked
        if (/\b(done|completed)\b/i.test(l)) checked = true;
        content = l.replace(/^(?:[-*]\s+|\d+[\.)]\s+)/, '').trim();
      }
      return { content, checked };
    };
    return (
      <ul className="pl-1 space-y-2">
        {rows.map((r, i) => {
          const { content, checked } = parse(r);
          return (
            <li key={i} className="flex items-start gap-2 leading-6">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={checked} readOnly />
              <span>{content}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderRichPreview = (text: string, fmt: typeof editFormat) => {
    if (!text) return <div className="text-sm text-muted-foreground">Nothing to preview yet.</div>;
    if (fmt === 'email') return renderEmailPreview(text);
    if (fmt === 'script') return renderScriptPreview(text);
    if (fmt === 'guidelines') return renderGuidelinesPreview(text);
    if (fmt === 'checklist') return renderChecklistPreview(text);
    return (<div className="whitespace-pre-wrap leading-6 text-sm">{text}</div>);
  };

  const toMarkdown = (text: string, fmt: typeof editFormat) => {
    const lines = text.split('\n');
    if (fmt === 'email') {
      const out: string[] = [];
      lines.forEach((l) => {
        if (/^subject\s*:/i.test(l)) out.push(`**Subject:** ${l.replace(/^subject\s*:/i, '').trim()}`);
        else if (/^[-*]\s+/.test(l)) out.push(`- ${l.replace(/^[-*]\s*/, '')}`);
        else out.push(l);
      });
      return out.join('\n');
    }
    if (fmt === 'script') {
      return lines.map(l => {
        const m = l.match(/^([A-Za-z ]{1,30}):\s*(.*)$/);
        if (m) return `**${m[1].trim()}:** ${m[2]}`;
        if (/^[-*]\s+/.test(l)) return `- ${l.replace(/^[-*]\s*/, '')}`;
        return l;
      }).join('\n');
    }
    if (fmt === 'guidelines') {
      // Convert to 1., 2., ... format
      const items: string[] = [];
      lines.forEach((raw) => {
        const l = raw.trim();
        if (!l) return;
        const m = l.match(/^(?:[-*]\s+|\d+[\.)]\s+)?(.*)$/);
        items.push((m ? m[1] : l).trim());
      });
      return items.map((it, idx) => `${idx + 1}. ${it}`).join('\n');
    }
    if (fmt === 'checklist') {
      const out: string[] = [];
      lines.forEach((raw) => {
        const l = raw.trim();
        if (!l) return;
        const m = l.match(/^[-*]\s*\[(.| )\]\s*(.*)$/i);
        if (m) {
          const checked = String(m[1]).toLowerCase() === 'x';
          out.push(`- [${checked ? 'x' : ' '}] ${m[2]}`);
        } else {
          const checked = /\b(done|completed)\b/i.test(l);
          const content = l.replace(/^(?:[-*]\s+|\d+[\.)]\s+)/, '').trim();
          out.push(`- [${checked ? 'x' : ' '}] ${content}`);
        }
      });
      return out.join('\n');
    }
    // default
    return text;
  };

  // Ensure any AI output becomes clean, readable plain text for the textarea
  const normalizeSuggestionText = (raw: string): string => {
    try {
      let text = String(raw ?? '').trim();
      // Strip code fences if present
      if (text.startsWith('```')) {
        const firstNewline = text.indexOf('\n');
        if (firstNewline !== -1) text = text.slice(firstNewline + 1);
        if (text.endsWith('```')) text = text.slice(0, -3);
        text = text.trim();
      }
      const looksJson = (t: string) => (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
      if (looksJson(text)) {
        try {
          const data = JSON.parse(text);
          const format = (val: any): string => {
            if (val == null) return '';
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
            if (Array.isArray(val)) return val.map(v => {
              const inner = format(v).split('\n');
              return inner.length > 1 ? `- ${inner.shift()}\n${inner.map(l => `  ${l}`).join('\n')}` : `- ${inner[0]}`;
            }).join('\n');
            if (typeof val === 'object') {
              // Special-case guideline style objects
              if (Array.isArray(val.guidelines)) {
                const lines: string[] = [];
                const title = typeof val.title === 'string' ? val.title.trim() : '';
                if (title) lines.push(title);
                val.guidelines.forEach((g: any) => {
                  const parts: string[] = [];
                  if (g.task) parts.push(String(g.task));
                  if (g.description) parts.push(String(g.description));
                  if (g.compulsory === true) parts.push('(Compulsory)');
                  if (parts.length) lines.push(`- ${parts.join(': ')}`);
                });
                return lines.join('\n');
              }
              // If generic object, produce a readable outline, skipping meta keys
              const skip = new Set(['title', 'category', 'type']);
              const out: string[] = [];
              if (typeof val.title === 'string' && val.title.trim()) out.push(String(val.title).trim());
              Object.keys(val).forEach(k => {
                if (skip.has(k)) return;
                const v = (val as any)[k];
                if (v == null || v === '') return;
                if (typeof v === 'object') {
                  const nested = format(v);
                  if (nested) out.push(`${k}:\n${nested.split('\n').map(l => `  ${l}`).join('\n')}`);
                } else {
                  out.push(`${k}: ${String(v)}`);
                }
              });
              return out.join('\n');
            }
            return '';
          };
          const pretty = format(data).trim();
          if (pretty) return pretty;
        } catch {
          // fall through and return original text
        }
      }
      return text;
    } catch {
      return raw;
    }
  };

  const openEditor = (item: Resource) => {
    setEditId(item.id);
    setEditTitle(item.title);
    setEditCategory(item.category);
    setEditContent(item.content);
    setEditOriginalContent(item.content);
    // Detect a sensible default format from category
    const cat = (item.category || '').toLowerCase();
    let fmt: 'email' | 'script' | 'guidelines' | 'checklist' = 'email';
    if (cat.includes('script')) fmt = 'script';
    else if (cat.includes('guideline')) fmt = 'guidelines';
    else if (cat.includes('checklist') || cat.includes('task')) fmt = 'checklist';
    else if (cat.includes('email')) fmt = 'email';
    setEditFormat(fmt);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editId) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'resources', editId), {
        title: editTitle,
        category: editCategory,
        content: editContent,
      });
      toast({ title: 'Resource Updated', description: 'Your changes have been saved.' });
      setEditOpen(false);
    } catch (error) {
      console.error('Update failed', error);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save changes. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIGenerate = async () => {
    try {
      const formatInstructions = (() => {
        switch (editFormat) {
          case 'email':
            return `Format as an email template. Include:\n- Subject: <one line>\n- Greeting\n- Body (2-5 short paragraphs, bullets if helpful)\n- Clear CTA\n- Signature with placeholders like [Your Name], [Company].`;
          case 'script':
            return `Format as a call/meeting script with labeled speakers (e.g., You:, Client:). Use short lines and optional bullets. Include key objections and concise responses.`;
          case 'guidelines':
            return `Provide a numbered list of clear, concise guidelines (one sentence each). If any are mandatory, append '(Compulsory)'.`;
          case 'checklist':
            return `Provide a checklist: one task per line prefixed with '- [ ] '. Keep each task concise and actionable.`;
          default:
            return '';
        }
      })();

      const prompt = `Improve or rewrite this resource in a concise, professional tone. Keep placeholders like [Name], [Company].\n\nDesired Format: ${editFormat.toUpperCase()}\n${formatInstructions}\n\nSTRICT OUTPUT RULES:\n- Return ONLY plain text.\n- Do NOT return JSON.\n- Do NOT wrap with Markdown/code fences.\n- Provide content only (no metadata keys like title/category).\n\nTitle: ${editTitle}\nCategory: ${editCategory}\nCurrent Content:\n${editContent}`;
      const result = await generateResourceContent({ prompt });
      setEditContent(normalizeSuggestionText(result.content));
      toast({ title: 'AI Suggestion Ready', description: 'Content replaced with AI-generated draft. Review and adjust as needed.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'AI Error', description: e?.message || 'Could not generate suggestion.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource Library</CardTitle>
        <CardDescription>View, edit, or delete existing resources for your team.</CardDescription>
      </CardHeader>
      <CardContent>
        {resources.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No resources found. Add a resource or seed the initial data.</p>
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {Object.entries(groupedResources).map(([category, items]) => (
              <AccordionItem value={category} key={category}>
                <AccordionTrigger className="text-base font-semibold">{category}</AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-3 pt-2">
                    {items.map((item) => (
                      <li key={item.id} className="p-3 rounded-md border bg-secondary/30">
                          <div className="flex justify-between items-center mb-2">
                              <h4 className="font-medium text-secondary-foreground">{item.title}</h4>
                              <div className="flex items-center gap-1">
                                <CopyButton textToCopy={item.content} />
                                <Button variant="ghost" size="icon" onClick={() => openEditor(item)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete</span>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Are you sure?</DialogTitle>
                                      <DialogDescription>
                                        This action cannot be undone. This will permanently delete the resource titled &quot;{item.title}&quot;.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                      <DialogClose asChild>
                                        <Button variant="outline">Cancel</Button>
                                      </DialogClose>
                                      <Button
                                        variant="destructive"
                                        onClick={() => handleDelete(item.id, item.title)}
                                        disabled={isDeleting}
                                      >
                                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Delete
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono p-2 bg-background rounded-md">
                              {item.content}
                          </p>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
      {/* Edit Dialog (controlled) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>Update the title, category, or content. Use AI to improve wording if needed.</DialogDescription>
          </DialogHeader>
          <Tabs value={editTab} onValueChange={(v) => setEditTab(v as 'edit' | 'preview')} defaultValue="edit">
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">Edit</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="r-title">Title</Label>
                  <Input id="r-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-category">Category</Label>
                  <Input id="r-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={editFormat} onValueChange={(v: 'email' | 'script' | 'guidelines' | 'checklist') => setEditFormat(v)}>
                    <SelectTrigger className="w-[220px] h-9">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="script">Script</SelectItem>
                      <SelectItem value="guidelines">Guidelines</SelectItem>
                      <SelectItem value="checklist">Checklist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="r-content">Content</Label>
                  <Textarea id="r-content" rows={10} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="preview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">Before</div>
                    <div className="flex gap-2">
                      <CopyButton textToCopy={editOriginalContent} />
                      <CopyButton textToCopy={toMarkdown(editOriginalContent, editFormat)} />
                    </div>
                  </div>
                  <div className="border rounded-md p-3 bg-background text-sm">
                    {renderRichPreview(editOriginalContent, editFormat)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-muted-foreground">After ({editFormat})</div>
                    <div className="flex gap-2">
                      <CopyButton textToCopy={editContent} />
                      <CopyButton textToCopy={toMarkdown(editContent, editFormat)} />
                    </div>
                  </div>
                  <div className="border rounded-md p-3 bg-background text-sm">
                    {renderRichPreview(editContent, editFormat)}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleAIGenerate}>
              Suggest with AI
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
