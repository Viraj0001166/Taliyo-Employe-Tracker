
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, collection, onSnapshot, addDoc, deleteDoc, updateDoc, query, orderBy } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, PlusCircle, Trash2, Edit } from "lucide-react";
import type { AppConfig, TaskField, GenericApiKey, Employee } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Info } from "lucide-react";

const webhookFormSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }),
});

const taskFieldFormSchema = z.object({
  label: z.string().min(2, { message: "Label must be at least 2 characters." }),
  placeholder: z.string().min(1, { message: "Placeholder is required." }),
  scope: z.enum(['all', 'specific']).default('all'),
  employeeIds: z.array(z.string()).optional(),
});

const genericApiKeyFormSchema = z.object({
  websiteName: z.string().min(2, { message: "Website name is required." }),
  apiKey: z.string().min(10, { message: "API key must be at least 10 characters." }),
});

const maskApiKey = (key: string) => {
    if (key.length <= 8) return "********";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

export function AppSettings() {
  const { toast } = useToast();
  const [isSubmittingWebhook, setIsSubmittingWebhook] = useState(false);
  const [isSubmittingField, setIsSubmittingField] = useState(false);
  const [isSubmittingGenericKey, setIsSubmittingGenericKey] = useState(false);

  const [taskFields, setTaskFields] = useState<TaskField[]>([]);
  const [loadingFields, setLoadingFields] = useState(true);
  const [editingField, setEditingField] = useState<TaskField | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const didDedupe = useRef(false);
  
  const [genericApiKeys, setGenericApiKeys] = useState<GenericApiKey[]>([]);
  const [loadingGenericKeys, setLoadingGenericKeys] = useState(true);
  const [editingGenericKey, setEditingGenericKey] = useState<GenericApiKey | null>(null);

  const webhookForm = useForm<z.infer<typeof webhookFormSchema>>({
    resolver: zodResolver(webhookFormSchema),
    defaultValues: { url: "" },
  });

  // System (built-in) daily log fields that always appear in the employee form
  // These are rendered read-only in Admin to avoid accidental deletion.
  const systemFields: Array<Pick<TaskField, 'name' | 'label' | 'placeholder'>> = [
    { name: 'connectionsSent', label: 'Connections Sent', placeholder: 'e.g., 25' },
    { name: 'accepted', label: 'Accepted', placeholder: 'e.g., 12' },
    { name: 'messagesSent', label: 'Messages Sent', placeholder: 'e.g., 10' },
    { name: 'replies', label: 'Replies', placeholder: 'e.g., 3' },
    { name: 'interestedLeads', label: 'Interested Leads', placeholder: 'e.g., 1' },
    { name: 'status', label: 'Status', placeholder: 'e.g., Follow-up pending' },
  ];
  const isSystemName = (name: string) => systemFields.some(sf => sf.name === name);
  
  const taskFieldForm = useForm<z.infer<typeof taskFieldFormSchema>>({
    resolver: zodResolver(taskFieldFormSchema),
    defaultValues: { label: "", placeholder: "0", scope: 'all', employeeIds: [] },
  });
  
  const genericApiKeyForm = useForm<z.infer<typeof genericApiKeyFormSchema>>({
    resolver: zodResolver(genericApiKeyFormSchema),
    defaultValues: { websiteName: "", apiKey: "" },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const webhookDocRef = doc(db, "config", "googleSheetWebhookUrl");
      const webhookDocSnap = await getDoc(webhookDocRef);
      if (webhookDocSnap.exists()) {
        webhookForm.setValue("url", webhookDocSnap.data().url);
      }
    };
    fetchSettings();

    const fieldsQuery = query(collection(db, "taskFields"), orderBy('label'));
    const unsubscribeFields = onSnapshot(fieldsQuery, async (snapshot) => {
        const fields = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskField));
        setTaskFields(fields);
        setLoadingFields(false);
        // Seed missing system fields so they are editable like custom ones
        try {
          const existing = new Set(fields.map(f => f.name));
          const missing = systemFields.filter(sf => !existing.has(sf.name));
          for (const sf of missing) {
            await addDoc(collection(db, 'taskFields'), { name: sf.name, label: sf.label, placeholder: sf.placeholder, scope: 'all', employeeIds: [] });
          }
          // One-time dedupe by name (case-insensitive): keep first, delete others
          if (!didDedupe.current) {
            const byName = new Map<string, string>(); // nameLower -> id to keep
            const dups: string[] = [];
            fields.forEach(f => {
              const key = String(f.name || '').toLowerCase();
              if (!key) return;
              if (!byName.has(key)) byName.set(key, f.id);
              else dups.push(f.id);
            });
            for (const id of dups) {
              try { await deleteDoc(doc(db, 'taskFields', id)); } catch {}
            }
            didDedupe.current = true;
            if (dups.length > 0) {
              toast({ title: 'Duplicates removed', description: `${dups.length} duplicate field(s) cleaned.` });
            }
          }
        } catch (seedErr) {
          console.warn('Seeding system fields failed (likely permissions):', seedErr);
        }
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn('app-settings taskFields listener permission denied (likely signed out).');
            setTaskFields([]);
        } else {
            console.error('app-settings taskFields listener error:', error);
        }
        setLoadingFields(false);
    });
    
    const keysQuery = collection(db, "genericApiKeys");
    const unsubscribeKeys = onSnapshot(keysQuery, (snapshot) => {
        const keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GenericApiKey));
        setGenericApiKeys(keys);
        setLoadingGenericKeys(false);
    }, (error) => {
        if ((error as any)?.code === 'permission-denied') {
            console.warn('app-settings genericApiKeys listener permission denied (likely signed out).');
            setGenericApiKeys([]);
        } else {
            console.error('app-settings genericApiKeys listener error:', error);
        }
        setLoadingGenericKeys(false);
    });

    // Load employees for specific scoping
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Employee[]);
    }, () => setEmployees([]));

    return () => {
        unsubscribeFields();
        unsubscribeKeys();
        unsubUsers();
    };
  }, [webhookForm]);

  useEffect(() => {
    if (editingField) {
      taskFieldForm.reset({
        label: editingField.label,
        placeholder: editingField.placeholder,
        scope: editingField.scope || 'all',
        employeeIds: editingField.employeeIds || [],
      });
    } else {
      taskFieldForm.reset({ label: "", placeholder: "0", scope: 'all', employeeIds: [] });
    }
  }, [editingField, taskFieldForm]);
  
  useEffect(() => {
    if (editingGenericKey) {
        genericApiKeyForm.reset({
            websiteName: editingGenericKey.websiteName,
            apiKey: editingGenericKey.apiKey,
        });
    } else {
        genericApiKeyForm.reset({ websiteName: "", apiKey: "" });
    }
  }, [editingGenericKey, genericApiKeyForm]);

  const onWebhookSubmit = async (values: z.infer<typeof webhookFormSchema>) => {
    setIsSubmittingWebhook(true);
    try {
      const docRef = doc(db, "config", "googleSheetWebhookUrl");
      await setDoc(docRef, values);
      toast({ title: "Settings Saved", description: "Google Sheet webhook URL has been updated." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmittingWebhook(false);
    }
  };

  const slugifyName = (label: string) => {
    // convert to snake_case: LinkedIn Connections -> linkedin_connections
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 40);
  };

  const onTaskFieldSubmit = async (values: z.infer<typeof taskFieldFormSchema>) => {
    setIsSubmittingField(true);
    try {
      if (editingField) {
        const docRef = doc(db, 'taskFields', editingField.id);
        await updateDoc(docRef, {
            label: values.label,
            placeholder: values.placeholder,
            // keep the internal name stable on edit to avoid breaking historical logs
            name: editingField.name,
            scope: values.scope,
            employeeIds: values.scope === 'specific' ? values.employeeIds || [] : [],
        });
        toast({ title: "Field Updated", description: `The field "${values.label}" has been updated.`});
        setEditingField(null);
      } else {
        const generated = slugifyName(values.label);
        // Prevent duplicates by name (case-insensitive)
        const exists = taskFields.some(f => String(f.name || '').toLowerCase() === generated.toLowerCase());
        if (exists) {
          toast({ variant: 'destructive', title: 'Duplicate field', description: 'A field with a similar name already exists.' });
          return;
        }
        await addDoc(collection(db, "taskFields"), {
            label: values.label,
            placeholder: values.placeholder,
            name: generated || 'field_' + Math.random().toString(36).slice(2, 8),
            scope: values.scope,
            employeeIds: values.scope === 'specific' ? values.employeeIds || [] : [],
        });
        toast({ title: "Field Added", description: `The field "${values.label}" has been added to the daily log form.` });
      }
      taskFieldForm.reset({ label: '', placeholder: '0', scope: 'all', employeeIds: [] });

    } catch (error: any) {
       toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSubmittingField(false);
    }
  };
  
  const onGenericApiKeySubmit = async (values: z.infer<typeof genericApiKeyFormSchema>) => {
    setIsSubmittingGenericKey(true);
    try {
        if (editingGenericKey) {
            const docRef = doc(db, 'genericApiKeys', editingGenericKey.id);
            await updateDoc(docRef, values);
            toast({ title: 'API Key Updated', description: `The key for ${values.websiteName} has been updated.`});
            setEditingGenericKey(null);
        } else {
            await addDoc(collection(db, "genericApiKeys"), values);
            toast({ title: 'API Key Added', description: `The key for ${values.websiteName} has been saved.`});
        }
        genericApiKeyForm.reset({ websiteName: '', apiKey: '' });
    } catch (error: any) {
       toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSubmittingGenericKey(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    try {
        const field = taskFields.find(f => f.id === id);
        if (field && isSystemName(field.name)) {
          toast({ variant: 'destructive', title: 'Protected Field', description: 'System fields cannot be deleted.' });
          return;
        }
        await deleteDoc(doc(db, 'taskFields', id));
        toast({ title: 'Field Deleted', description: 'The form field has been removed.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the field.' });
    }
  }

  const handleDeleteGenericKey = async (id: string) => {
    try {
        await deleteDoc(doc(db, 'genericApiKeys', id));
        toast({ title: 'API Key Deleted', description: 'The API key has been removed.'});
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the key.'});
    }
  }

  const startEditField = (field: TaskField) => {
    setEditingField(field);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const cancelEdit = () => {
    setEditingField(null);
    taskFieldForm.reset({ label: '', placeholder: ''});
  }
  
  const startEditGenericKey = (key: GenericApiKey) => {
    setEditingGenericKey(key);
  }

  const cancelEditGenericKey = () => {
    setEditingGenericKey(null);
    genericApiKeyForm.reset({ websiteName: '', apiKey: '' });
  }

  return (
    <div className="grid gap-6 md:grid-cols-1">
      <Card>
        <CardHeader>
          <CardTitle>Application Settings</CardTitle>
          <CardDescription>Configure global settings and API keys for the application.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Google AI API Key</AlertTitle>
              <AlertDescription>
                To use the AI features of this app, you need to set your Google AI API Key in the <code>.env</code> file in the root of the project.
              </AlertDescription>
            </Alert>
          
          <Separator />
          
          <Form {...webhookForm}>
            <form onSubmit={webhookForm.handleSubmit(onWebhookSubmit)} className="space-y-4">
              <FormField
                control={webhookForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Sheet Webhook URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://script.google.com/macros/s/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isSubmittingWebhook} className="w-full">
                {isSubmittingWebhook ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                Save Webhook URL
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
            <CardHeader>
                <CardTitle>{editingField ? 'Edit Field' : 'Manage Daily Log Form Fields'}</CardTitle>
                <CardDescription>
                    {editingField ? `Editing the "${editingField.label}" field.` : 'Add or remove fields from the employee daily log form.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...taskFieldForm}>
                    <form onSubmit={taskFieldForm.handleSubmit(onTaskFieldSubmit)} className="space-y-4">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 items-end">
                          <FormField
                            control={taskFieldForm.control}
                            name="label"
                            render={({ field }) => (
                              <FormItem className="flex-1 w-full">
                                <FormLabel>Field Label</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. LinkedIn Connections" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={taskFieldForm.control}
                            name="placeholder"
                            render={({ field }) => (
                              <FormItem className="flex-1 w-full">
                                <FormLabel>Placeholder</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. 50" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4 items-end">
                          <FormField
                            control={taskFieldForm.control}
                            name="scope"
                            render={({ field }) => (
                              <FormItem className="flex-1 w-full">
                                <FormLabel>Visibility</FormLabel>
                                <FormControl>
                                  <Select value={field.value} onValueChange={(v: 'all' | 'specific') => field.onChange(v)} disabled={editingField ? isSystemName(editingField.name) : false}>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select scope" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">All employees</SelectItem>
                                      <SelectItem value="specific">Specific employees</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex-1" />
                        </div>
                        {taskFieldForm.watch('scope') === 'specific' && (
                          <div className="space-y-2">
                            <FormLabel>Select Employees</FormLabel>
                            <div className="max-h-48 overflow-auto border rounded-md p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {employees.map((e) => {
                                const sel = new Set(taskFieldForm.watch('employeeIds') || []);
                                const checked = sel.has(e.id);
                                return (
                                  <label key={e.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4"
                                      checked={checked}
                                      onChange={(ev) => {
                                        const cur = new Set(taskFieldForm.getValues('employeeIds') || []);
                                        if (ev.target.checked) cur.add(e.id); else cur.delete(e.id);
                                        taskFieldForm.setValue('employeeIds', Array.from(cur));
                                      }}
                                    />
                                    <span>{e.name} <span className="text-muted-foreground">({e.email})</span></span>
                                  </label>
                                );
                              })}
                              {employees.length === 0 && (
                                <div className="text-xs text-muted-foreground">No employees found.</div>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                           {editingField && (
                                <Button type="button" variant="outline" onClick={cancelEdit} className="w-full mt-2">
                                    Cancel Edit
                                </Button>
                            )}
                            <Button type="submit" disabled={isSubmittingField} className="w-full">
                                {isSubmittingField ? <Loader2 className="animate-spin" /> : (editingField ? <Save /> : <PlusCircle />)}
                                {editingField ? "Save Changes" : "Add Field"}
                            </Button>
                        </div>
                    </form>
                </Form>

                <div className="mt-6">
                    <h3 className="text-sm font-medium mb-2 text-muted-foreground">Current Fields</h3>
                    {loadingFields ? (
                         <div className="flex justify-center items-center h-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Placeholder</TableHead>
                                    <TableHead>Scope</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {taskFields.map(field => (
                                    <TableRow key={field.id}>
                                        <TableCell>{field.label}</TableCell>
                                        <TableCell>{field.placeholder}</TableCell>
                                        <TableCell>
                                            <Badge variant={ (field.scope || 'all') === 'all' ? 'secondary' : 'default' }>
                                                { (field.scope || 'all') === 'all' ? 'All' : 'Specific' }
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => startEditField(field)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteField(field.id)} disabled={isSystemName(field.name)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {taskFields.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-20 text-muted-foreground">No fields yet. Add one above.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </div>
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle>{editingGenericKey ? 'Edit API Key' : 'Manage External API Keys'}</CardTitle>
                <CardDescription>
                    {editingGenericKey ? `Editing the key for "${editingGenericKey.websiteName}".` : 'Add or remove API keys for other services.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...genericApiKeyForm}>
                    <form onSubmit={genericApiKeyForm.handleSubmit(onGenericApiKeySubmit)} className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-end gap-4">
                          <FormField
                            control={genericApiKeyForm.control}
                            name="websiteName"
                            render={({ field }) => (
                              <FormItem className="flex-1 w-full">
                                <FormLabel>Website Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Some Service" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={genericApiKeyForm.control}
                            name="apiKey"
                            render={({ field }) => (
                              <FormItem className="flex-1 w-full">
                                <FormLabel>API Key</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Enter the key" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" disabled={isSubmittingGenericKey} size="icon" aria-label={editingGenericKey ? "Save Changes" : "Add Key"} className="shrink-0">
                            {isSubmittingGenericKey ? <Loader2 className="animate-spin" /> : (editingGenericKey ? <Save /> : <PlusCircle />)}
                          </Button>
                        </div>
                         {editingGenericKey && (
                            <Button type="button" variant="outline" onClick={cancelEditGenericKey} className="w-full mt-2">
                                Cancel Edit
                            </Button>
                        )}
                    </form>
                </Form>

                 <div className="mt-6">
                    <h3 className="text-sm font-medium mb-2 text-muted-foreground">Saved API Keys</h3>
                    {loadingGenericKeys ? (
                         <div className="flex justify-center items-center h-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Website</TableHead>
                                    <TableHead>API Key</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {genericApiKeys.map(key => (
                                    <TableRow key={key.id}>
                                        <TableCell>{key.websiteName}</TableCell>
                                        <TableCell className="font-mono">{maskApiKey(key.apiKey)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => startEditGenericKey(key)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteGenericKey(key.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {genericApiKeys.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">No API keys saved yet.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </div>
            </CardContent>
        </Card>
    </div>
  );
}

    
