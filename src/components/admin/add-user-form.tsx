
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Eye, EyeOff, Copy, Wand2 } from 'lucide-react';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db, getSecondaryAuth } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const formSchema = z.object({
  fullName: z.string().min(1, { message: 'Full name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['employee', 'admin'], { required_error: 'You need to select a user role.' }),
  // Additional profile fields set by admin at creation time
  title: z.string().optional(),
  department: z.string().optional(),
  employeeCode: z.string().optional(),
  joiningDate: z.string().optional(), // yyyy-MM-dd
  reportingManager: z.string().optional(),
});

interface AddUserFormProps {
  onUserAdded: () => void;
}

export function AddUserForm({ onUserAdded }: AddUserFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      role: 'employee',
      title: '',
      department: '',
      employeeCode: '',
      joiningDate: '',
      reportingManager: '',
    },
  });

  // Removed: Google Sheet webhook notifier

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

  const requestEmployeeId = async () => {
    const id = await fetchEmployeeId();
    if (id) {
      form.setValue('employeeCode', id, { shouldDirty: true });
      toast({ title: 'Generated', description: `Employee ID: ${id}` });
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      // Ensure we have a proper employee code (generate if empty)
      let employeeCode = (values.employeeCode || '').trim();
      if (!employeeCode) {
        const generated = await fetchEmployeeId();
        if (generated) employeeCode = generated;
      }

      // Use secondary auth to avoid replacing the current admin session
      const secondaryAuth = getSecondaryAuth();
      // Derive a 9-character password from name, title, and joining date if empty
      let passwordToUse = values.password;
      if (!passwordToUse) {
        const lettersOnly = (s: string) => (s || '').replace(/[^A-Za-z]/g, '');
        const firstN = (s: string, n: number, padChar = 'x') => {
          const t = (s || '').slice(0, n);
          return t.length < n ? t.padEnd(n, padChar) : t;
        };
        const namePart = firstN(lettersOnly(values.fullName || ''), 3).toLowerCase();
        const posPart = firstN(lettersOnly(values.title || ''), 3).toUpperCase();
        const digits = (values.joiningDate || '').replace(/[^0-9]/g, ''); // YYYYMMDD
        const yymmdd = digits.length >= 8 ? digits.slice(2) : digits; // prefer YYMMDD
        const datePart = (yymmdd.slice(-3) || '').padStart(3, '0');
        passwordToUse = `${namePart}${posPart}${datePart}`.slice(0, 9);
      }
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, values.email, passwordToUse);
      
      const user = userCredential.user;
      const displayName = values.fullName.trim();
      
      await updateProfile(user, { displayName });

      await setDoc(doc(db, "users", user.uid), {
        name: displayName,
        email: values.email,
        role: values.role,
        ...(values.title ? { title: values.title } : {}),
        ...(values.department ? { department: values.department } : {}),
        ...(employeeCode ? { employeeCode } : {}),
        ...(values.joiningDate ? { joiningDate: values.joiningDate } : {}),
        ...(values.reportingManager ? { reportingManager: values.reportingManager } : {}),
      });

      // Removed: Google Sheet webhook notifier

      toast({
        title: 'User Created Successfully!',
        description: `Account for ${displayName} (${values.email}) has been created with the role ${values.role}.`,
      });
      form.reset();
      onUserAdded(); // Callback to refresh the user list
      // Clean up secondary session
      await signOut(secondaryAuth);
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        // Try to link the existing account into the admin panel by writing its Firestore doc
        try {
          const secondaryAuth = getSecondaryAuth();
          const cred = await signInWithEmailAndPassword(secondaryAuth, values.email, values.password);
          const existingUser = cred.user;
          const displayName = values.fullName.trim();

          // Create or update the users doc using the existing UID
          const userRef = doc(db, 'users', existingUser.uid);
          const userSnap = await getDoc(userRef);
          // Ensure employee code exists; generate if empty
          let linkEmployeeCode = (values.employeeCode || '').trim();
          if (!linkEmployeeCode) {
            const generated = await fetchEmployeeId();
            if (generated) linkEmployeeCode = generated;
          }
          await setDoc(userRef, {
            name: displayName,
            email: values.email,
            role: values.role,
            ...(values.title ? { title: values.title } : {}),
            ...(values.department ? { department: values.department } : {}),
            ...(linkEmployeeCode ? { employeeCode: linkEmployeeCode } : {}),
            ...(values.joiningDate ? { joiningDate: values.joiningDate } : {}),
            ...(values.reportingManager ? { reportingManager: values.reportingManager } : {}),
          }, { merge: true });

          // Removed: Google Sheet webhook notifier

          toast({
            title: userSnap.exists() ? 'User Updated' : 'Existing Account Linked',
            description: userSnap.exists()
              ? `Updated ${displayName} (${values.email}) in the admin panel.`
              : `Linked existing account ${values.email} and added it to the admin panel.`,
          });
          form.reset();
          onUserAdded();
          // Sign out the secondary session so we don't keep an extra user signed in
          await signOut(secondaryAuth);
        } catch (linkErr: any) {
          console.error('Error linking existing account:', linkErr);
          toast({
            variant: 'destructive',
            title: 'Email Already Registered',
            description: linkErr?.code === 'auth/invalid-credential' || linkErr?.code === 'auth/wrong-password'
              ? 'This email is already registered, but the password you entered does not match. Enter the user\'s correct password or ask them to log in once to complete setup.'
              : linkErr?.message || 'Could not link existing account. Please verify credentials.',
          });
        }
      } else {
        console.error('Error creating user:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to Create User',
          description: error.message || 'An unexpected error occurred.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const generatePassword = () => {
    const lettersOnly = (s: string) => (s || '').replace(/[^A-Za-z]/g, '');
    const firstN = (s: string, n: number, padChar = 'x') => {
      const t = (s || '').slice(0, n);
      return t.length < n ? t.padEnd(n, padChar) : t;
    };
    const fullName = (form.getValues('fullName') || '').trim();
    const title = (form.getValues('title') || '').trim();
    const joiningDate = (form.getValues('joiningDate') || '').trim();
    const namePart = firstN(lettersOnly(fullName), 3).toLowerCase();
    const posPart = firstN(lettersOnly(title), 3).toUpperCase();
    const digits = joiningDate.replace(/[^0-9]/g, ''); // YYYYMMDD
    const yymmdd = digits.length >= 8 ? digits.slice(2) : digits; // prefer YYMMDD
    const datePart = (yymmdd.slice(-3) || '').padStart(3, '0');
    const pass = `${namePart}${posPart}${datePart}`.slice(0, 9);
    form.setValue('password', pass, { shouldDirty: true });
    setShowPassword(true);
    toast({ title: 'Password generated', description: 'Generated from name, position, and joining date (9 chars).' });
  };

  const copyPassword = async () => {
    try {
      const pwd = form.getValues('password');
      if (!pwd) { toast({ variant: 'destructive', title: 'No password', description: 'Please enter or generate a password first.' }); return; }
      await navigator.clipboard.writeText(pwd);
      toast({ title: 'Copied', description: 'Password copied to clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy to clipboard.' });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="new.user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Job Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Digital Marketing Executive" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department / Team</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Marketing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="employeeCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input placeholder="e.g. TLY-202509-0001" {...field} />
                    <Button type="button" variant="outline" onClick={requestEmployeeId} disabled={idGenerating} aria-label="Generate Employee ID">
                      {idGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="joiningDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Joining Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="reportingManager"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reporting Manager</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Jane Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                <FormControl>
                  <Input className="w-full" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                </FormControl>
                <Button type="button" variant="outline" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" onClick={generatePassword} aria-label="Generate password">
                  <Wand2 className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={copyPassword} aria-label="Copy password">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 animate-spin" />
          ) : (
            <UserPlus className="mr-2" />
          )}
          Create User
        </Button>
      </form>
    </Form>
  );
}
