
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Employee } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";

interface TeamDirectoryProps {
    employees: Employee[];
}

export function TeamDirectory({ employees }: TeamDirectoryProps) {

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Team Directory</CardTitle>
        <CardDescription>A list of all team members.</CardDescription>
      </CardHeader>
      <CardContent>
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
            {employees.map((employee) => (
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
                        <Badge variant="default">Active</Badge>
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

    