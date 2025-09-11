
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Loader2 } from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import type { Announcement } from "@/lib/types";

export function BroadcastForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchLastAnnouncement = async () => {
      const announcementRef = doc(db, "announcements", "latest");
      const docSnap = await getDoc(announcementRef);
      if (docSnap.exists()) {
        setMessage(docSnap.data().message);
      }
    };
    fetchLastAnnouncement();
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    if (!message || message.trim() === "") {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Message cannot be empty."
        });
        setLoading(false);
        return;
    }

    try {
        const announcementRef = doc(db, "announcements", "latest");
        await setDoc(announcementRef, {
            message: message,
            updatedAt: serverTimestamp(),
            updatedBy: auth.currentUser?.displayName || "Admin",
        });

        toast({
            title: "Announcement Published!",
            description: "Your message is now visible to all employees.",
        });
    } catch (error: any) {
        console.error("Error publishing announcement:", error);
        toast({
            variant: "destructive",
            title: "Publishing Failed",
            description: "Could not publish the announcement. Please try again.",
        });
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="broadcast-message">Announcement Message</Label>
        <Textarea
          id="broadcast-message"
          name="message"
          placeholder="e.g., 'This week's focus is on enterprise clients. Let's aim for 10 new demos!'"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
        {loading ? "Publishing..." : "Publish Announcement"}
      </Button>
    </form>
  );
}
