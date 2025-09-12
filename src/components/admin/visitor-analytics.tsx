
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { VisitorLog } from '@/lib/types';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';

export function VisitorAnalytics() {
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logsCollection = collection(db, "visitorLogs");
    const q = query(logsCollection, orderBy("loginTime", "desc"), limit(200));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VisitorLog));
      setVisitorLogs(logs);
      setLoading(false);
    }, (error) => {
      if ((error as any)?.code === 'permission-denied') {
        console.warn('visitor-analytics listener permission denied (likely signed out).');
        setVisitorLogs([]);
      } else {
        console.error('Error fetching visitor logs:', error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee Visitor Analytics</CardTitle>
        <CardDescription>
          A log of employee logins, including their IP address and browser information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead className="hidden md:table-cell">IP Address</TableHead>
                    <TableHead className="hidden md:table-cell">System (User Agent)</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {visitorLogs.map((log) => (
                    <TableRow key={log.id}>
                    <TableCell>
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <Avatar>
                                <AvatarFallback>{(log.employeeName?.trim()?.charAt(0) || 'U').toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium">{log.employeeName}</p>
                                <p className="text-sm text-muted-foreground">{log.employeeEmail}</p>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="min-w-[200px]">
                        {format(new Date(log.loginTime.seconds * 1000), 'PPpp')}
                    </TableCell>
                    <TableCell className="min-w-[120px] hidden md:table-cell">{log.ipAddress}</TableCell>
                    <TableCell className="text-xs text-muted-foreground min-w-[300px] hidden md:table-cell">{log.userAgent}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
