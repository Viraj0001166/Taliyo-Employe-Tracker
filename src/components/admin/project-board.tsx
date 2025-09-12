"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Project, ProjectTask } from "@/lib/types";
import { Loader2, Plus, Paperclip, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { db as _db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

export function ProjectBoard() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>("");
  const [newTaskDue, setNewTaskDue] = useState<string>("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; email?: string }>>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // Load projects
  useEffect(() => {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Project));
      setProjects(arr);
      if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
    });
    return () => unsub();
  }, [selectedId]);

  // Load employees for assignment
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'users')), (snap) => {
      const arr = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter((u: any) => (u.role || 'employee') !== 'admin')
        .map((u: any) => ({ id: u.id, name: u.name || u.email || u.id, email: u.email }));
      setEmployees(arr);
    }, () => setEmployees([]));
    return () => unsub();
  }, []);

  // Load tasks for selected project
  useEffect(() => {
    if (!selectedId) { setTasks([]); return; }
    const q = query(collection(db, 'projects', selectedId, 'tasks'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as ProjectTask));
      setTasks(arr);
    });
    return () => unsub();
  }, [selectedId]);

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) { toast({ variant: 'destructive', title: 'Project name is required' }); return; }
    setCreatingProject(true);
    try {
      const uid = auth.currentUser?.uid || 'admin';
      await addDoc(collection(db, 'projects'), {
        name,
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      setNewProjectName("");
      toast({ title: 'Project created' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create failed', description: e?.message || 'Could not create project' });
    } finally {
      setCreatingProject(false);
    }
  };

  const createTask = async () => {
    if (!selectedId) { toast({ variant: 'destructive', title: 'Select a project' }); return; }
    const title = newTaskTitle.trim();
    if (!title) { toast({ variant: 'destructive', title: 'Task title is required' }); return; }
    setCreatingTask(true);
    try {
      const uid = auth.currentUser?.uid || 'admin';
      await addDoc(collection(db, 'projects', selectedId, 'tasks'), {
        title,
        description: newTaskDesc.trim() || undefined,
        assigneeId: newTaskAssignee || undefined,
        dueDate: newTaskDue ? new Date(newTaskDue) : undefined,
        status: 'todo',
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskAssignee("");
      setNewTaskDue("");
      toast({ title: 'Task created' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Create failed', description: e?.message || 'Could not create task' });
    } finally {
      setCreatingTask(false);
    }
  };

  // Drag & drop
  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };
  const onDrop = async (e: React.DragEvent, newStatus: ProjectTask['status']) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id || !selectedId) return;
    try {
      await updateDoc(doc(db, 'projects', selectedId, 'tasks', id), { status: newStatus });
    } catch {}
  };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();

  const lists: Array<{ key: ProjectTask['status']; title: string }> = [
    { key: 'todo', title: 'To Do' },
    { key: 'in-progress', title: 'In Progress' },
    { key: 'done', title: 'Done' },
  ];

  const displayTasks = (status: ProjectTask['status']) => {
    return tasks
      .filter(t => t.status === status)
      .filter(t => filterAssignee === 'all' || t.assigneeId === filterAssignee);
  };

  const updateTask = async (taskId: string, data: Partial<ProjectTask>) => {
    if (!selectedId) return;
    try { await updateDoc(doc(db, 'projects', selectedId, 'tasks', taskId), data as any); } catch {}
  };

  const uploadAttachment = async (taskId: string, file: File) => {
    if (!selectedId || !file) return;
    try {
      const path = `projects/${selectedId}/tasks/${taskId}/attachments/${Date.now()}-${file.name}`;
      const refObj = storageRef(storage, path);
      await uploadBytes(refObj, file, { contentType: file.type });
      const url = await getDownloadURL(refObj);
      const meta = { name: file.name, url, path, uploadedAt: new Date() } as any;
      await updateTask(taskId, { attachments: arrayUnion(meta) } as any);
      toast({ title: 'Attachment uploaded' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: e?.message || 'Could not upload file' });
    }
  };

  const removeAttachment = async (taskId: string, att: any) => {
    if (!selectedId) return;
    try { await deleteObject(storageRef(storage, att.path)).catch(() => {}); } catch {}
    try { await updateTask(taskId, { attachments: arrayRemove(att) } as any); } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Board</CardTitle>
        <CardDescription>Manage projects and tasks in a simple Kanban view.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
          <div className="rounded-lg border p-3 space-y-3">
            <div className="font-medium">Projects</div>
            <div className="flex gap-2">
              <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="New project name" />
              <Button onClick={createProject} disabled={creatingProject}>{creatingProject && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Create</Button>
            </div>
            <div className="space-y-1">
              {projects.map(p => (
                <button key={p.id} className={cn('w-full text-left px-2 py-1 rounded hover:bg-muted', selectedId === p.id ? 'bg-primary/10' : '')} onClick={() => setSelectedId(p.id)}>
                  {p.name}
                </button>
              ))}
              {projects.length === 0 && <div className="text-sm text-muted-foreground">No projects yet.</div>}
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="New task title" />
              <Select value={newTaskAssignee || 'unassigned'} onValueChange={(v) => setNewTaskAssignee(v === 'unassigned' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Assign to" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} placeholder="Due date" />
              <Textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} placeholder="Description (optional)" rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">Filter by assignee</div>
              <Select value={filterAssignee} onValueChange={(v) => setFilterAssignee(v)}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Button onClick={createTask} disabled={creatingTask || !selectedId}>{creatingTask && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Add Task</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lists.map(col => (
              <div key={col.key} className="rounded-lg border p-3" onDrop={(e) => onDrop(e, col.key)} onDragOver={allowDrop}>
                <div className="font-medium mb-2">{col.title}</div>
                <div className="space-y-2 min-h-[200px]">
                  {displayTasks(col.key).map(t => (
                    <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t.id)} className="rounded-md border bg-card p-2 text-sm shadow-sm cursor-move">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{t.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.assigneeId ? (employees.find(e => e.id === t.assigneeId)?.name || t.assigneeId) : 'Unassigned'}
                            {t.dueDate && <> • Due: {(t as any).dueDate?.seconds ? new Date((t as any).dueDate.seconds * 1000).toLocaleDateString() : ''}</>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setExpandedTaskId(expandedTaskId === t.id ? null : t.id)}>Details</Button>
                      </div>
                      {expandedTaskId === t.id && (
                        <div className="mt-2 border-t pt-2 space-y-2">
                          <Textarea rows={3} placeholder="Description" defaultValue={t.description || ''} onBlur={(e) => updateTask(t.id, { description: e.target.value })} />
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={t.assigneeId || 'unassigned'} onValueChange={(v) => updateTask(t.id, { assigneeId: v === 'unassigned' ? undefined : v } as any)}>
                              <SelectTrigger><SelectValue placeholder="Assignee"/></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                              </SelectContent>
                            </Select>
                            <Input type="date" defaultValue={(t as any).dueDate?.seconds ? new Date((t as any).dueDate.seconds * 1000).toISOString().slice(0,10) : ''} onBlur={(e) => updateTask(t.id, { dueDate: e.target.value ? new Date(e.target.value) : undefined } as any)} />
                          </div>
                          {/* Attachments */}
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Attachments</label>
                            <div className="flex items-center gap-2">
                              <Input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(t.id, f); e.currentTarget.value = ''; }} />
                            </div>
                            <div className="space-y-1">
                              {(t.attachments || []).map((a: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                  <a href={a.url} target="_blank" rel="noreferrer" className="underline break-all flex-1">{a.name}</a>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeAttachment(t.id, a)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                              ))}
                              {(!t.attachments || t.attachments.length === 0) && <div className="text-xs text-muted-foreground">No files</div>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {tasks.filter(t => t.status === col.key).length === 0 && (
                    <div className="text-xs text-muted-foreground">No tasks</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
