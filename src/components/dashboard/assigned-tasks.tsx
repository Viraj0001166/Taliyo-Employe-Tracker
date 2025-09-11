
"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AssignedTask } from "@/lib/types";
import { db } from '@/lib/firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday } from 'date-fns';

interface AssignedTasksProps {
  tasks: AssignedTask[];
}

const formatDate = (date: Date | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : date;
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM dd');
};


export function AssignedTasks({ tasks }: AssignedTasksProps) {
  const { toast } = useToast();
  
  const handleCheckedChange = async (taskId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    try {
      const taskDocRef = doc(db, "tasks", taskId);
      await updateDoc(taskDocRef, {
        isCompleted: newStatus
      });
       toast({
        title: "Task Updated",
        description: `Task status has been changed.`,
      });
    } catch (error) {
      console.error("Error updating task status:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "Could not update task status.",
      });
    }
  };

  const sortedTasks = React.useMemo(() => {
    return [...tasks].sort((a, b) => {
        const dateA = a.assignedAt instanceof Timestamp ? a.assignedAt.toMillis() : new Date(a.assignedAt).getTime();
        const dateB = b.assignedAt instanceof Timestamp ? b.assignedAt.toMillis() : new Date(b.assignedAt).getTime();
        return dateB - dateA;
    });
  }, [tasks]);

  return (
    <Card className="h-full shadow-sm">
      <CardHeader>
        <CardTitle>My Assigned Tasks</CardTitle>
        <CardDescription>Tasks assigned to you by your admin.</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedTasks.length > 0 ? (
          <div className="space-y-4">
            {sortedTasks.map((task) => (
                <div key={task.id} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                    <Checkbox 
                        id={`task-${task.id}`} 
                        checked={task.isCompleted}
                        onCheckedChange={() => handleCheckedChange(task.id, task.isCompleted)}
                    />
                    <div className="grid gap-1.5 leading-none">
                        <Label 
                            htmlFor={`task-${task.id}`}
                            className={`font-medium ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}
                        >
                           {task.task}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Assigned by {task.assignedBy} on {formatDate(task.assignedAt)}
                        </p>
                    </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            <p>You have no assigned tasks. Great job!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
