"use client";

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { FakeEmployee } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const getStatusVariant = (status: FakeEmployee['status']): "default" | "secondary" | "destructive" => {
    switch (status) {
        case 'Active':
            return 'default';
        case 'Training':
            return 'secondary';
        case 'Inactive':
            return 'destructive';
        default:
            return 'secondary';
    }
};

const maskEmail = (email?: string) => {
  if (!email) return '';
  const [user] = email.split('@');
  if (!user) return '***@*******.**';
  const prefix = user.length <= 2 ? (user[0] || '') : user.slice(0, 2);
  return `${prefix}***@*******.**`;
};

export function TeamActivity() {
  const [employees, setEmployees] = useState<FakeEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Determine if current viewer is admin (controls masking)
    const unsubAuth = auth.onAuthStateChanged(async (u) => {
      try {
        if (u) {
          const snap = await getDoc(doc(db, 'users', u.uid));
          const role = snap.exists() ? (snap.data() as any)?.role : undefined;
          setIsAdmin(role === 'admin');
        } else {
          setIsAdmin(false);
        }
      } catch { setIsAdmin(false); }
    });

    const q = query(collection(db, 'fakeEmployees'), orderBy('joinDate', 'desc'), limit(25));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeeList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FakeEmployee));
      setEmployees(employeeList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching fake employees:", error);
      setLoading(false);
    });

    return () => { unsubscribe(); unsubAuth(); };
  }, []);
  
  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>New Applicants</CardTitle>
          <CardDescription>A list of new applicants and their status.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>New Applicants</CardTitle>
        <CardDescription>A list of new applicants and their status.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                  {employees.length > 0 ? employees.slice(0, 5).map((employee) => (
                  <TableRow key={employee.id}>
                      <TableCell>
                          <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                  <AvatarFallback>{(employee.name?.trim()?.charAt(0) || 'U').toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                  <p className="font-medium">{employee.name}</p>
                                  <p className="text-sm text-muted-foreground">{isAdmin ? employee.email : maskEmail(employee.email)}</p>
                              </div>
                          </div>
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                          <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                      </TableCell>
                  </TableRow>
                  )) : (
                      <TableRow>
                          <TableCell colSpan={2} className="h-24 text-center">
                              No new applicants found.
                          </TableCell>
                      </TableRow>
                  )}
              </TableBody>
            </Table>
        </div>
      </CardContent>
    </Card>
  );
}

    