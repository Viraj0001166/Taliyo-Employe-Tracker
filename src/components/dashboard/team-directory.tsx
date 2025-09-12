"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Employee } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "../ui/button";

interface TeamDirectoryProps {
    employees?: Employee[];
}

type StatusFilter = 'all' | 'Active' | 'Training' | 'Inactive';

export function TeamDirectory({ employees: employeesProp }: TeamDirectoryProps) {
  const [employees, setEmployees] = useState<Employee[]>(employeesProp || []);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (employeesProp && employeesProp.length) return; // external data provided
    const q = query(collection(db, 'users'), where('role', '==', 'employee'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => {
        const data: any = d.data();
        const status: Employee['status'] = (data.status === 'Training' || data.status === 'Inactive') ? data.status : 'Active';
        return { id: d.id, name: data.name || '', email: data.email || '', avatar: data.avatar || '', role: 'employee', status } as Employee;
      });
      setEmployees(list);
    }, () => setEmployees([]));
    return () => unsub();
  }, [employeesProp]);

  const filtered = useMemo(() => {
    if (filter === 'all') return employees;
    return employees.filter(e => (e.status || 'Active') === filter);
  }, [employees, filter]);

  const badgeVariant = (s: Employee['status']) => {
    switch (s) {
      case 'Active': return 'default' as const;
      case 'Training': return 'secondary' as const;
      case 'Inactive': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Team Directory</CardTitle>
        <CardDescription>Browse teammates by status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3 overflow-x-auto">
          {(['all','Active','Training','Inactive'] as StatusFilter[]).map((s) => (
            <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)} className="h-8">
              {s === 'Inactive' ? 'Deactive' : s}
            </Button>
          ))}
        </div>
        <div className="w-full overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
            {filtered.map((employee) => (
                <TableRow key={employee.id}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                {employee.avatar ? <AvatarImage src={employee.avatar} alt={employee.name} /> : null}
                                <AvatarFallback>{(employee.name?.trim()?.charAt(0) || 'U').toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <p className="text-sm font-medium leading-none">{employee.name}</p>
                        </div>
                    </TableCell>
                    <TableCell>
                        <p className="text-sm text-muted-foreground capitalize">{employee.role}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                        <Badge variant={badgeVariant(employee.status || 'Active')}>{employee.status || 'Active'}</Badge>
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