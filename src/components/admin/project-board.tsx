"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { Project, ProjectTask } from "@/lib/types";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectBoard() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);

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
        status: 'todo',
        createdAt: serverTimestamp(),
        createdBy: uid,
      });
      setNewTaskTitle("");
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
            <div className="flex items-center gap-2">
              <Input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="New task title" />
              <Button onClick={createTask} disabled={creatingTask || !selectedId}>{creatingTask && <Loader2 className="h-4 w-4 animate-spin mr-2"/>}Add Task</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {lists.map(col => (
                <div key={col.key} className="rounded-lg border p-3" onDrop={(e) => onDrop(e, col.key)} onDragOver={allowDrop}>
                  <div className="font-medium mb-2">{col.title}</div>
                  <div className="space-y-2 min-h-[200px]">
                    {tasks.filter(t => t.status === col.key).map(t => (
                      <div key={t.id} draggable onDragStart={(e) => onDragStart(e, t.id)} className="rounded-md border bg-card p-2 text-sm shadow-sm cursor-move">
                        {t.title}
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
        </div>
      </CardContent>
    </Card>
  );
}
