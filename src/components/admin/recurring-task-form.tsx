
"use client";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Employee } from "@/lib/types";
import { Send, Loader2, CalendarIcon } from "lucide-react";
import { useState } from "react";
import { collection, writeBatch, doc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { addDays, format, isAfter } from "date-fns";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface RecurringTaskFormProps {
  employees: Employee[];
}

export function RecurringTaskForm({ employees }: RecurringTaskFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>();
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [task, setTask] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (!employeeId || !task || !date?.from) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an employee, a task, and at least a start date.",
      });
      return;
    }

    setLoading(true);

    const employeeName = employees.find(e => e.id === employeeId)?.name;
    const adminName = auth.currentUser?.displayName || "Admin";

    try {
      const batch = writeBatch(db);
      
      let currentDate = date.from;
      const endDate = date.to || date.from;

      if (isAfter(currentDate, endDate)) {
          toast({ variant: "destructive", title: "Error", description: "Start date cannot be after end date." });
          setLoading(false);
          return;
      }

      let taskCount = 0;
      while (currentDate <= endDate) {
        const taskDocRef = doc(collection(db, "tasks"));
        batch.set(taskDocRef, {
          employeeId,
          task,
          assignedBy: adminName,
          isCompleted: false,
          assignedAt: currentDate, // Storing the date for which the task is assigned
        });
        currentDate = addDays(currentDate, 1);
        taskCount++;
      }

      await batch.commit();

      toast({
        title: "Task(s) Assigned!",
        description: `${taskCount} task(s) have been assigned to ${employeeName}.`,
      });

      // Reset form
      setDate(undefined);
      setEmployeeId(undefined);
      setTask("");

    } catch (error) {
      console.error("Error assigning recurring task:", error);
      toast({
        variant: "destructive",
        title: "Failed to assign tasks",
        description: "An unexpected error occurred.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="employee-select">Select Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger id="employee-select">
            <SelectValue placeholder="Choose an employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-description">Task Description</Label>
        <Textarea
          id="task-description"
          name="task"
          placeholder="e.g., 'Focus on following up with enterprise leads this week.'"
          required
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Task Dates</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        {loading ? "Assigning..." : "Assign Task(s)"}
      </Button>
    </form>
  );
}
