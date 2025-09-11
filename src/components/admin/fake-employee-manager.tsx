
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { FakeEmployee } from '@/lib/types';
import { format } from 'date-fns';
import { CalendarIcon, Edit, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  joinDate: z.date({ required_error: "A join date is required." }),
  status: z.enum(['Active', 'Training', 'Inactive'], { required_error: "Please select a status." }),
});

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

export function FakeEmployeeManager() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<FakeEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<FakeEmployee | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      status: 'Training',
      joinDate: new Date(),
    },
  });

  useEffect(() => {
    const q = query(collection(db, 'fakeEmployees'), orderBy('joinDate', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FakeEmployee));
      setEmployees(employeeList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching fake employees:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (editingEmployee) {
      form.reset({
        name: editingEmployee.name,
        email: editingEmployee.email,
        status: editingEmployee.status,
        joinDate: new Date(editingEmployee.joinDate.seconds * 1000),
      });
    } else {
      form.reset({ name: '', email: '', status: 'Training', joinDate: new Date() });
    }
  }, [editingEmployee, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        const docRef = doc(db, 'fakeEmployees', editingEmployee.id);
        await updateDoc(docRef, values);
        toast({ title: "Employee Updated", description: `${values.name}'s details have been updated.` });
      } else {
        await addDoc(collection(db, 'fakeEmployees'), values);
        toast({ title: "Employee Added", description: `${values.name} has been added to the team list.` });
      }
      setEditingEmployee(null);
      form.reset({ name: '', email: '', status: 'Training', joinDate: new Date() });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'fakeEmployees', id));
      toast({ title: "Employee Deleted", description: "The employee has been removed from the list." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: error.message });
    }
  };

  const startEdit = (employee: FakeEmployee) => {
    setEditingEmployee(employee);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const cancelEdit = () => {
    setEditingEmployee(null);
    form.reset({ name: '', email: '', status: 'Training', joinDate: new Date() });
  };


  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</CardTitle>
            <CardDescription>
              {editingEmployee ? `Update details for ${editingEmployee.name}.` : 'Create a new fake employee profile.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Rahul Sharma" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g. rahul.s@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <FormField control={form.control} name="joinDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Join Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Training">Training</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-2">
                    {editingEmployee && (
                        <Button type="button" variant="outline" onClick={cancelEdit} className="w-full">
                            Cancel
                        </Button>
                    )}
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : (editingEmployee ? <Edit className="mr-2"/> : <PlusCircle className="mr-2" />)}
                        {editingEmployee ? 'Save Changes' : 'Add Employee'}
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
            <CardHeader>
                <CardTitle>Team List</CardTitle>
                <CardDescription>Manage the list of fake employees displayed on the dashboard.</CardDescription>
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
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Join Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {employees.map((employee) => (
                            <TableRow key={employee.id}>
                            <TableCell className="font-medium">{employee.name}</TableCell>
                            <TableCell>{employee.email}</TableCell>
                            <TableCell>{format(new Date(employee.joinDate.seconds * 1000), 'dd MMM yyyy')}</TableCell>
                             <TableCell>
                                <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(employee)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the profile for {employee.name}.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(employee.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                 </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
