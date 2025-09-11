"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Loader2, Database, Plus, Pencil, Trash2, Save, X } from "lucide-react";

export type AIMemory = {
  id: string;
  key: string;
  value: string;
  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
};

interface MemoryManagerProps {
  adminId: string | null;
}

export function MemoryManager({ adminId }: MemoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState<AIMemory[]>([]);

  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTags, setNewTags] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editTags, setEditTags] = useState("");

  const { toast } = useToast();

  // Subscribe when dialog is opened and adminId is available
  useEffect(() => {
    if (!open || !adminId) return;
    setLoading(true);
    const colRef = collection(db, "aiMemories", adminId, "memories");
    const qRef = query(colRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(qRef, (snap) => {
      const rows: AIMemory[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      // In case updatedAt is missing, sort client-side as fallback
      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setMemories(rows);
      setLoading(false);
    }, (err) => {
      console.error("Memories listener error", err);
      toast({ variant: "destructive", title: "Load Failed", description: "Could not load memories." });
      setLoading(false);
    });
    return () => unsub();
  }, [open, adminId, toast]);

  const resetNew = () => {
    setNewKey("");
    setNewValue("");
    setNewTags("");
  };

  const handleAdd = async () => {
    if (!adminId) return;
    if (!newKey.trim() || !newValue.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Key and Value are required." });
      return;
    }
    try {
      setLoading(true);
      const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
      const colRef = collection(db, "aiMemories", adminId, "memories");
      await addDoc(colRef, { key: newKey.trim(), value: newValue.trim(), tags, createdAt: Date.now(), updatedAt: Date.now() });
      toast({ title: "Saved", description: `Memory \"${newKey}\" added.` });
      resetNew();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Save Failed", description: "Could not add memory." });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (m: AIMemory) => {
    setEditingId(m.id);
    setEditKey(m.key);
    setEditValue(m.value);
    setEditTags((m.tags || []).join(", "));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditKey("");
    setEditValue("");
    setEditTags("");
  };

  const handleUpdate = async (id: string) => {
    if (!adminId) return;
    if (!editKey.trim() || !editValue.trim()) {
      toast({ variant: "destructive", title: "Missing fields", description: "Key and Value are required." });
      return;
    }
    try {
      setLoading(true);
      const tags = editTags.split(",").map(t => t.trim()).filter(Boolean);
      const dref = doc(db, "aiMemories", adminId, "memories", id);
      await updateDoc(dref, { key: editKey.trim(), value: editValue.trim(), tags, updatedAt: Date.now() });
      toast({ title: "Updated", description: `Memory \"${editKey}\" updated.` });
      cancelEdit();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update memory." });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, keyLabel: string) => {
    if (!adminId) return;
    const ok = window.confirm(`Delete memory \"${keyLabel}\"?`);
    if (!ok) return;
    try {
      setLoading(true);
      const dref = doc(db, "aiMemories", adminId, "memories", id);
      await deleteDoc(dref);
      toast({ title: "Deleted", description: `Memory \"${keyLabel}\" removed.` });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Delete Failed", description: "Could not delete memory." });
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!adminId) return;
    const ok = window.confirm("Delete all memories? This cannot be undone.");
    if (!ok) return;
    try {
      setLoading(true);
      const colRef = collection(db, "aiMemories", adminId, "memories");
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      toast({ title: "Cleared", description: "All memories deleted." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Clear Failed", description: "Could not clear memories." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="whitespace-nowrap">
          <Database className="mr-2 h-4 w-4" />
          Memories
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>AI Memory Manager</DialogTitle>
          <DialogDescription>
            Save and manage persistent admin-specific AI memories (facts, preferences, links).
          </DialogDescription>
        </DialogHeader>

        {!adminId && (
          <div className="p-4 text-sm text-muted-foreground">Please sign in as admin to manage memories.</div>
        )}

        {adminId && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Add New Memory</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Key (e.g., default_followup_days)" value={newKey} onChange={e => setNewKey(e.target.value)} />
                <Input placeholder="Tags (comma separated)" value={newTags} onChange={e => setNewTags(e.target.value)} />
              </div>
              <textarea
                placeholder="Value (what should be remembered)"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={handleAdd} disabled={loading} size="sm">
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Plus className="mr-2 h-4 w-4"/>}
                  Save Memory
                </Button>
                <Button variant="ghost" size="sm" onClick={resetNew} disabled={loading}>Reset</Button>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">Saved Memories ({memories.length})</h3>
                <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={loading || memories.length === 0}>
                  <Trash2 className="mr-2 h-4 w-4"/>
                  Clear All
                </Button>
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin"/> Loading...
                </div>
              )}

              {!loading && memories.length === 0 && (
                <div className="text-sm text-muted-foreground">No memories yet.</div>
              )}

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
                {memories.map((m) => (
                  <div key={m.id} className="rounded-md border p-3">
                    {editingId === m.id ? (
                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={editKey} onChange={e => setEditKey(e.target.value)} />
                          <Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="tags" />
                        </div>
                        <textarea
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => handleUpdate(m.id)} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={loading}>
                            <X className="mr-2 h-4 w-4"/> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium truncate">{m.key}</div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEdit(m)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id, m.key)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        {m.tags && m.tags.length > 0 && (
                          <div className="text-xs text-muted-foreground">{m.tags.join(", ")}</div>
                        )}
                        <div className="text-sm whitespace-pre-wrap text-foreground/80">{m.value}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
