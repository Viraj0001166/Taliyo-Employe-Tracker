
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Announcement } from "@/lib/types";
import { Megaphone } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';

interface AnnouncementProps {
  announcement: Announcement | null;
}

export function Announcements({ announcement }: AnnouncementProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Latest Announcement
        </CardTitle>
        <CardDescription>
          A message from your admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {announcement ? (
            <p className="text-foreground whitespace-pre-wrap">{announcement.message}</p>
        ) : (
            <p className="text-muted-foreground">No announcements at this time.</p>
        )}
      </CardContent>
      {announcement && (
        <CardFooter className="text-xs text-muted-foreground">
            <p>
                Last updated by {announcement.updatedBy} {formatDistanceToNow(new Date(announcement.updatedAt.seconds * 1000), { addSuffix: true })}
            </p>
        </CardFooter>
      )}
    </Card>
  );
}
