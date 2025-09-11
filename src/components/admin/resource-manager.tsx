
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Resource } from "@/lib/types";
import { AddResourceForm } from './add-resource-form';
import { ResourceList } from './resource-list';
import { db } from '@/lib/firebase';
import { collection, writeBatch, getDocs, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { initialResourcesData } from '@/lib/data';

interface ResourceManagerProps {
  resources: Resource[];
}

export function ResourceManager({ resources }: ResourceManagerProps) {
  const { toast } = useToast();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const seedInitialData = async () => {
    setIsSeeding(true);
    try {
        const resourcesCollection = collection(db, "resources");
        const snapshot = await getDocs(resourcesCollection);
        if (snapshot.empty) {
            const batch = writeBatch(db);
            initialResourcesData.forEach(resource => {
                const docRef = doc(collection(db, "resources"));
                batch.set(docRef, resource);
            });
            await batch.commit();
            toast({
                title: "Initial Resources Added!",
                description: "Your resource library has been populated with default templates."
            });
        } else {
             toast({
                title: "Database Not Empty",
                description: "Initial resources were not added because the database already contains data.",
                variant: "default"
            });
        }
    } catch(error) {
        console.error("Error seeding data:", error);
        toast({
            variant: "destructive",
            title: "Seeding Failed",
            description: "Could not add initial resources.",
        });
    } finally {
        setIsSeeding(false);
    }
  };

  const importResourcePack = async () => {
    setIsImporting(true);
    try {
      const resourcesCollection = collection(db, "resources");
      const snapshot = await getDocs(resourcesCollection);
      const existing = new Set(
        snapshot.docs.map((d) => {
          const data = d.data() as Resource;
          return `${(data.category || '').toLowerCase()}|${(data.title || '').toLowerCase()}`;
        })
      );

      const batch = writeBatch(db);
      let added = 0;
      initialResourcesData.forEach((resource) => {
        const key = `${resource.category.toLowerCase()}|${resource.title.toLowerCase()}`;
        if (!existing.has(key)) {
          const docRef = doc(collection(db, "resources"));
          batch.set(docRef, resource);
          added++;
        }
      });

      if (added > 0) {
        await batch.commit();
        toast({
          title: "Resource Pack Imported",
          description: `${added} new item(s) added to your resource library.`,
        });
      } else {
        toast({
          title: "No New Items",
          description: "All items from the pack already exist.",
        });
      }
    } catch (error) {
      console.error("Error importing pack:", error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: "Could not import the resource pack.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Add New Resource</CardTitle>
            <CardDescription>Create a new template or a handy link for your team.</CardDescription>
          </CardHeader>
          <CardContent>
            <AddResourceForm />
             <div className="mt-4 border-t pt-4">
                 <Button onClick={seedInitialData} disabled={isSeeding || resources.length > 0} variant="outline" size="sm" className="w-full">
                    {isSeeding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Seed Initial Data
                </Button>
                 <Button onClick={importResourcePack} disabled={isImporting} variant="secondary" size="sm" className="w-full mt-2">
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import Resource Pack
                 </Button>
             </div>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <ResourceList resources={resources} />
      </div>
    </div>
  );
}
