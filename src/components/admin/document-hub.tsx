"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { db, storage, auth } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { DocFile } from "@/lib/types";
import { Loader2, Trash2, Upload } from "lucide-react";

export function DocumentHub() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Policies");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'documents'), orderBy('uploadedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DocFile));
      setDocs(arr);
    });
    return () => unsub();
  }, []);

  const upload = async () => {
    if (!file) { toast({ variant: 'destructive', title: 'Select a file' }); return; }
    if (!title.trim()) { toast({ variant: 'destructive', title: 'Enter title' }); return; }
    setUploading(true);
    try {
      const uid = auth.currentUser?.uid || 'admin';
      const metaRef = await addDoc(collection(db, 'documents'), {
        title: title.trim(),
        category: category.trim(),
        filePath: '',
        uploadedBy: uid,
        uploadedAt: serverTimestamp(),
      });
      const path = `documents/${metaRef.id}/${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'documents', metaRef.id, 'versions'), { path, url, uploadedAt: serverTimestamp(), name: file.name });
      await updateDoc(doc(db, 'documents', metaRef.id), { filePath: path, url });
      setTitle("");
      setFile(null);
      toast({ title: 'Uploaded', description: 'Document uploaded successfully.' });
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Upload failed', description: e?.message || 'Could not upload file' });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docItem: DocFile) => {
    try {
      if (docItem.filePath) {
        await deleteObject(ref(storage, docItem.filePath)).catch(() => {});
      }
      await deleteDoc(doc(db, 'documents', docItem.id));
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: e?.message || 'Could not delete' });
    }
  };

  const download = async (docItem: DocFile) => {
    try {
      const url = docItem.filePath ? await getDownloadURL(ref(storage, docItem.filePath)) : (docItem as any).url;
      if (url) window.open(url, '_blank');
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Hub</CardTitle>
        <CardDescription>Upload and manage company documents for employees.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leave Policy" />
          </div>
          <div>
            <Label htmlFor="doc-category">Category</Label>
            <Input id="doc-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Policies" />
          </div>
          <div>
            <Label htmlFor="doc-file">File</Label>
            <Input id="doc-file" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={upload} disabled={uploading || !file}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}Upload
          </Button>
        </div>
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>{d.category}</TableCell>
                  <TableCell>{(d as any).uploadedAt?.seconds ? new Date((d as any).uploadedAt.seconds * 1000).toLocaleString() : ''}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => download(d)}>Download</Button>
                      <Button size="sm" variant="destructive" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
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
