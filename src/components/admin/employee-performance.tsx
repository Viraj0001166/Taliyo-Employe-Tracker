
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Employee, DailyLog, TaskField } from "@/lib/types";
import dynamic from 'next/dynamic';
const AIPerformanceAnalyzer = dynamic(() => import('./ai-performance-analyzer').then(m => m.AIPerformanceAnalyzer), { ssr: false, loading: () => <span className="text-xs text-muted-foreground">AI…</span> });
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Button } from "../ui/button";
import { Edit, Loader2, KeyRound, Eye, EyeOff, Wand2, Copy, Trash2, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";

interface EmployeePerformanceProps {
  employees: Employee[];
}

function DeleteUserDialog({ employee, onDeleted }: { employee: Employee; onDeleted: (employeeId: string) => void }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [alsoDeleteStorage, setAlsoDeleteStorage] = useState(true);
    const { toast } = useToast();

    const isSelf = auth.currentUser?.uid === employee.id;
    const superEmail = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "";
    const isSuperAdmin = !!(superEmail && employee.email?.toLowerCase() === superEmail.toLowerCase());
    const disabled = isSelf || isSuperAdmin;

    const confirmDelete = async () => {
        setDeleting(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ uid: employee.id, deleteStorage: alsoDeleteStorage }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
            toast({ title: 'User Deleted', description: `${employee.name} has been removed.` });
            setOpen(false);
            onDeleted(employee.id);
        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Deletion failed', description: err?.message || 'Could not delete user.' });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete User"
                    disabled={disabled}
                    title={disabled ? (isSelf ? 'You cannot delete yourself' : 'Cannot delete super admin') : 'Delete user'}
                >
                    <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete {employee.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will remove the user's account, profile, related logs{alsoDeleteStorage ? ', and storage files' : ''}.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`del-storage-${employee.id}`}
                        checked={alsoDeleteStorage}
                        onCheckedChange={(v: boolean | "indeterminate") => setAlsoDeleteStorage(!!v)}
                    />
                    <Label htmlFor={`del-storage-${employee.id}`}>Also delete storage files</Label>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function SetPasswordDialog({ employee }: { employee: Employee }) {
    const [isOpen, setIsOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const generate = () => {
        const length = 12;
        const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const lowers = 'abcdefghijkmnopqrstuvwxyz';
        const numbers = '23456789';
        const specials = '!@#$%^&*()_-+=[]{}';
        const all = uppers + lowers + numbers + specials;
        const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
        let pass = pick(uppers) + pick(lowers) + pick(numbers) + pick(specials);
        for (let i = pass.length; i < length; i++) pass += pick(all);
        pass = pass.split('').sort(() => (Math.random() - 0.5)).join('');
        setPassword(pass);
        setShowPwd(true);
        toast({ title: 'Generated', description: 'A strong password has been generated.' });
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(password);
            toast({ title: 'Copied', description: 'Password copied to clipboard.' });
        } catch {
            toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy password.' });
        }
    };

    const save = async () => {
        if (!password || password.length < 6) {
            toast({ variant: 'destructive', title: 'Invalid password', description: 'Password must be at least 6 characters.' });
            return;
        }
        setIsUpdating(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/set-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ uid: employee.id, password }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');
            toast({ title: 'Password Updated', description: `Password set for ${employee.name}.` });
            setIsOpen(false);
            setPassword('');
        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Update failed', description: err?.message || 'Could not set password.' });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Set Password">
                    <KeyRound className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Password</DialogTitle>
                    <DialogDescription>Assign or reset the password for {employee.name} ({employee.email}).</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="pwd">New Password</Label>
                    <div className="flex gap-2">
                        <Input id="pwd" type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                        <Button type="button" variant="outline" onClick={() => setShowPwd(s => !s)} aria-label={showPwd ? 'Hide' : 'Show'}>
                            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button type="button" variant="outline" onClick={generate} aria-label="Generate">
                            <Wand2 className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="outline" onClick={copy} aria-label="Copy">
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={save} disabled={isUpdating}>{isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface PerformanceMetrics {
  [employeeId: string]: {
    [key: string]: number | string;
  };
}

function EditUserProfileDialog({ employee, onUpdated }: { employee: Employee; onUpdated: (patch: { id: string } & Partial<Employee>) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const [name, setName] = useState(employee.name || "");
    const [email, setEmail] = useState(employee.email || "");
    const [title, setTitle] = useState(employee.title || "");
    const [department, setDepartment] = useState(employee.department || "");
    const [employeeCode, setEmployeeCode] = useState(employee.employeeCode || "");
    const [joiningDate, setJoiningDate] = useState(employee.joiningDate || "");
    const [reportingManager, setReportingManager] = useState(employee.reportingManager || "");
    const [role, setRole] = useState<Employee['role']>(employee.role);
    const [idGenerating, setIdGenerating] = useState(false);

    const fetchEmployeeId = async (): Promise<string | null> => {
        try {
            setIdGenerating(true);
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/generate-employee-id', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            });
            const data = await res.json();
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to generate');
            return String(data.id);
        } catch (e: any) {
            console.error('generate-employee-id failed', e);
            toast({ variant: 'destructive', title: 'Could not generate Employee ID', description: e?.message || 'Please try again.' });
            return null;
        } finally {
            setIdGenerating(false);
        }
    };

    const resetForm = () => {
        setName(employee.name || "");
        setEmail(employee.email || "");
        setTitle(employee.title || "");
        setDepartment(employee.department || "");
        setEmployeeCode(employee.employeeCode || "");
        setJoiningDate(employee.joiningDate || "");
        setReportingManager(employee.reportingManager || "");
        setRole(employee.role);
    };

    const handleSave = async () => {
        if (!name.trim()) { toast({ variant: 'destructive', title: 'Name is required' }); return; }
        if (!email.trim()) { toast({ variant: 'destructive', title: 'Email is required' }); return; }
        setSaving(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    uid: employee.id,
                    updates: {
                        name: name.trim(),
                        email: email.trim(),
                        role,
                        title: title.trim(),
                        department: department.trim(),
                        employeeCode: employeeCode.trim(),
                        joiningDate: joiningDate.trim(),
                        reportingManager: reportingManager.trim(),
                    },
                }),
            });
            const data = await res.json();
            if (!res.ok || !data?.success) throw new Error(data?.error || 'Request failed');

            toast({ title: 'Profile Updated', description: `${name} has been updated.` });
            onUpdated({
                id: employee.id,
                name: name.trim(),
                email: email.trim(),
                role,
                title: title.trim(),
                department: department.trim(),
                employeeCode: employeeCode.trim(),
                joiningDate: joiningDate.trim(),
                reportingManager: reportingManager.trim(),
            });
            setIsOpen(false);
        } catch (err: any) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Update failed', description: err?.message || 'Could not update user.' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit Profile">
                    <UserCog className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>Update user information and role.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
                    <div className="space-y-1">
                        <Label htmlFor={`name-${employee.id}`}>Full Name</Label>
                        <Input id={`name-${employee.id}`} value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`email-${employee.id}`}>Email (official)</Label>
                        <Input id={`email-${employee.id}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`title-${employee.id}`}>Job Title</Label>
                        <Input id={`title-${employee.id}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Digital Marketing Executive" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`dept-${employee.id}`}>Department / Team</Label>
                        <Input id={`dept-${employee.id}`} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Marketing" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`ecode-${employee.id}`}>Employee ID</Label>
                        <div className="flex gap-2">
                            <Input id={`ecode-${employee.id}`} value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="e.g. TLY-202509-0001" />
                            <Button type="button" variant="outline" onClick={async () => { const id = await fetchEmployeeId(); if (id) setEmployeeCode(id); }} disabled={idGenerating} aria-label="Generate Employee ID">
                                {idGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor={`jdate-${employee.id}`}>Joining Date</Label>
                        <Input id={`jdate-${employee.id}`} type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`rmanager-${employee.id}`}>Reporting Manager</Label>
                        <Input id={`rmanager-${employee.id}`} value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} placeholder="e.g. Jane Doe" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <Label htmlFor={`role-${employee.id}`}>Role</Label>
                        <Select value={role} onValueChange={(v: 'employee' | 'admin') => setRole(v)}>
                            <SelectTrigger id={`role-${employee.id}`}>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditUserRoleDialog({ employee, onRoleChange }: { employee: Employee, onRoleChange: (employeeId: string, newRole: 'employee' | 'admin') => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [newRole, setNewRole] = useState<'employee' | 'admin'>(employee.role);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleUpdate = async () => {
        setIsUpdating(true);
        try {
            const userDocRef = doc(db, 'users', employee.id);
            await updateDoc(userDocRef, { role: newRole });
            onRoleChange(employee.id, newRole);
            toast({
                title: "Role Updated",
                description: `${employee.name}'s role has been updated to ${newRole}.`,
            });
            setIsOpen(false);
        } catch (error) {
            console.error("Error updating role:", error);
            toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update role. Check Firestore rules.' });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Edit className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Role for {employee.name}</DialogTitle>
                    <DialogDescription>
                        Change the user role for {employee.email}. Be careful, granting admin access provides full permissions.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <Label htmlFor="role-select">User Role</Label>
                    <Select value={newRole} onValueChange={(value: 'employee' | 'admin') => setNewRole(value)}>
                        <SelectTrigger id="role-select">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdate} disabled={isUpdating}>
                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function EmployeePerformance({ employees: initialEmployees }: EmployeePerformanceProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);

  useEffect(() => {
    setEmployees(initialEmployees);
  }, [initialEmployees]);

  useEffect(() => {
    const q = collection(db, 'taskFields');
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskField));
        setTaskFields(fields);
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn('taskFields listener permission denied (likely signed out).');
            setTaskFields([]);
        } else {
            console.error('taskFields listener error:', error);
        }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (employees.length === 0) return;
      const newMetrics: PerformanceMetrics = {};
      for (const employee of employees) {
        const logsCollection = collection(db, "dailyLogs");
        const q = query(
          logsCollection,
          where("employeeId", "==", employee.id),
          orderBy("date", "desc"),
          limit(1) // Get the most recent log
        );
        const logSnapshot = await getDocs(q);
        if (!logSnapshot.empty) {
          const lastLog = logSnapshot.docs[0].data() as DailyLog;
          newMetrics[employee.id] = lastLog;
        } else {
          newMetrics[employee.id] = taskFields.reduce((acc, field) => {
            acc[field.name] = 'N/A';
            return acc;
          }, {} as {[key: string]: string});
        }
      }
      setMetrics(newMetrics);
    };

    if (employees.length > 0 && taskFields.length > 0) {
      fetchMetrics();
    }
  }, [employees, taskFields]);
  
  const handleRoleChange = (employeeId: string, newRole: 'employee' | 'admin') => {
      setEmployees(prevEmployees =>
          prevEmployees.map(emp =>
              emp.id === employeeId ? { ...emp, role: newRole } : emp
          )
      );
  };

  const handleProfileUpdated = (patch: { id: string } & Partial<Employee>) => {
      setEmployees(prev => prev.map(e => e.id === patch.id ? { ...e, ...patch } : e));
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>An overview of all registered users and their performance metrics.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    {taskFields.map((field, idx) => (
                        <TableHead
                          key={field.id}
                          className={`text-center ${idx < 2 ? 'hidden md:table-cell' : 'hidden lg:table-cell'}`}
                        >
                          {field.label}
                        </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {employees.map((employee) => (
                <TableRow key={employee.id}>
                    <TableCell>
                    <div className="flex items-center gap-3 min-w-[200px]">
                        <Avatar>
                          {employee.avatar ? <AvatarImage src={employee.avatar} alt={employee.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {(employee.name?.trim()?.charAt(0) || 'U').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                        <p className="font-medium">{employee.name}</p>
                        <p className="text-sm text-muted-foreground">{employee.email}</p>
                        </div>
                    </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant={employee.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                            {employee.role}
                        </Badge>
                    </TableCell>
                    {taskFields.map((field, idx) => (
                        <TableCell
                          key={field.id}
                          className={`text-center font-medium ${idx < 2 ? 'hidden md:table-cell' : 'hidden lg:table-cell'}`}
                        >
                            {metrics[employee.id]?.[field.name] ?? 'N/A'}
                        </TableCell>
                    ))}
                    <TableCell className="text-right">
                        <div className="flex justify-end items-center gap-2">
                           <AIPerformanceAnalyzer employee={employee} />
                           <SetPasswordDialog employee={employee} />
                           <EditUserProfileDialog employee={employee} onUpdated={handleProfileUpdated} />
                           <EditUserRoleDialog employee={employee} onRoleChange={handleRoleChange} />
                           <DeleteUserDialog employee={employee} onDeleted={(id) => setEmployees(prev => prev.filter(e => e.id === id ? false : true))} />
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
