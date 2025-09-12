
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
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
  role: z.enum(['employee', 'admin'], {
    required_error: 'You need to select a user role.',
  }),
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
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'employee',
    },
  });

  // Removed: Google Sheet webhook notifier

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      // Use secondary auth to avoid replacing the current admin session
      const secondaryAuth = getSecondaryAuth();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, values.email, values.password);
      
      const user = userCredential.user;
      const displayName = `${values.firstName} ${values.lastName}`;
      
      await updateProfile(user, { displayName });

      await setDoc(doc(db, "users", user.uid), {
        name: displayName,
        email: values.email,
        role: values.role,
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
          const displayName = `${values.firstName} ${values.lastName}`;

          // Create or update the users doc using the existing UID
          const userRef = doc(db, 'users', existingUser.uid);
          const userSnap = await getDoc(userRef);
          await setDoc(userRef, {
            name: displayName,
            email: values.email,
            role: values.role,
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
    const length = 12;
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_-+=[]{}';
    const all = uppers + lowers + numbers + specials;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    let pass = pick(uppers) + pick(lowers) + pick(numbers) + pick(specials);
    for (let i = pass.length; i < length; i++) pass += pick(all);
    // shuffle
    pass = pass.split('').sort(() => (Math.random() - 0.5)).join('');
    form.setValue('password', pass, { shouldDirty: true });
    setShowPassword(true);
    toast({ title: 'Password generated', description: 'A strong password was generated.' });
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
