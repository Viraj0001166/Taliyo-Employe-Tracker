
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Loader2, PlusCircle, Link as LinkIcon, Sparkles } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '../ui/separator';
import { fetchUrlContent } from '@/ai/flows/fetch-url-content-flow';
import { generateResourceContent } from '@/ai/flows/generate-resource-content-flow';

const formSchema = z.object({
  category: z.string().min(1, { message: 'Category is required.' }),
  customCategory: z.string().optional(),
  title: z.string().min(1, { message: 'Title is required.' }),
  content: z.string().min(10, { message: 'Content must be at least 10 characters.' }),
  importUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
}).refine(data => {
    if (data.category === 'Other' && (!data.customCategory || data.customCategory.trim() === '')) {
        return false;
    }
    return true;
}, {
    message: 'Custom category cannot be empty.',
    path: ['customCategory'],
});

const predefinedCategories = [
    "Email Templates",
    "Lead Generation Tools & Links",
    "Scripts",
    "Daily Task Sheet / Workflow",
    "Training & Tutorials",
    "Motivation & Guidelines",
];

function AiGeneratorDialog({ onContentGenerated }: { onContentGenerated: (content: string) => void }) {
    const { toast } = useToast();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!prompt) {
            toast({ variant: 'destructive', title: 'Prompt is empty', description: 'Please enter a prompt to generate content.' });
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateResourceContent({ prompt });
            onContentGenerated(result.content);
            toast({ title: 'Content Generated', description: 'AI has generated the content for you.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Generation Failed', description: error.message || 'Could not generate content.' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="w-full">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate with AI
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Generate Resource with AI</DialogTitle>
                    <DialogDescription>
                        Enter a prompt and let AI create the resource content for you. For example: &quot;Write a short follow-up email for a lead who missed a demo.&quot;
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="ai-prompt">Your Prompt</Label>
                    <Textarea id="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., Write a cold call script..." />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}
                        Generate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export function AddResourceForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      category: '',
      customCategory: '',
      title: '',
      content: '',
      importUrl: '',
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        form.setValue('content', text);
        toast({ title: 'File Content Loaded', description: 'The text from the file has been loaded into the content field.' });
      };
      reader.readAsText(file);
    } else {
        toast({ variant: 'destructive', title: 'Invalid File', description: 'Please select a .txt file.' });
    }
  };

  const handleImportFromUrl = async () => {
    const url = form.getValues('importUrl');
    if (!url) {
        form.setError('importUrl', { type: 'manual', message: 'URL cannot be empty.' });
        return;
    }
    setIsFetchingUrl(true);
    try {
        const result = await fetchUrlContent({ url });
        form.setValue('content', result.content);
        toast({ title: 'Content Imported', description: 'Content from the URL has been successfully imported.' });
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Import Failed', description: error.message || 'Could not fetch content from the URL.'});
    } finally {
        setIsFetchingUrl(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      const finalCategory = values.category === 'Other' ? values.customCategory : values.category;

      await addDoc(collection(db, "resources"), {
        category: finalCategory,
        title: values.title,
        content: values.content,
      });

      toast({
        title: 'Resource Added!',
        description: `The resource "${values.title}" has been added successfully.`,
      });
      form.reset();
      setShowCustomCategory(false);
    } catch (error: any) {
      console.error('Error adding resource:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to Add Resource',
        description: error.message || 'An unexpected error occurred.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        
        <div className='space-y-3'>
            <Label className="text-sm font-medium">Import from File or URL</Label>
            <div className="flex items-center gap-2">
                <Input type="file" accept=".txt" onChange={handleFileChange} className="text-xs" />
            </div>
             <div className="relative flex items-center">
                <FormField
                control={form.control}
                name="importUrl"
                render={({ field }) => (
                    <FormItem className="w-full">
                        <FormControl>
                            <Input placeholder="Or paste a URL to import from" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="button" onClick={handleImportFromUrl} disabled={isFetchingUrl} size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10">
                    {isFetchingUrl ? <Loader2 className="animate-spin" /> : <LinkIcon />}
                </Button>
            </div>
        </div>

        <Separator />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
               <Select 
                onValueChange={(value) => {
                    field.onChange(value);
                    setShowCustomCategory(value === 'Other');
                }} 
                defaultValue={field.value}
               >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {predefinedCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other (Please specify)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showCustomCategory && (
            <FormField
            control={form.control}
            name="customCategory"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Custom Category Name</FormLabel>
                <FormControl>
                    <Input placeholder="Enter the new category name" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        )}
        
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Initial Cold Outreach" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Content</FormLabel>
              <FormControl>
                <Textarea placeholder="Write the template or resource content here..." {...field} rows={8} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <AiGeneratorDialog onContentGenerated={(content) => form.setValue('content', content)} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="mr-2 animate-spin" /> : <PlusCircle className="mr-2" />}
          Add Resource
        </Button>
      </form>
    </Form>
  );
}
