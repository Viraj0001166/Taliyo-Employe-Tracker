
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { analyzeEmployeePerformance } from "@/ai/flows/analyze-employee-performance";
import type { Employee, DailyLog } from "@/lib/types";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Separator } from "../ui/separator";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface AIPerformanceAnalyzerProps {
  employee: Employee;
}

type AnalysisState = "idle" | "loading" | "success" | "error";

export function AIPerformanceAnalyzer({ employee }: AIPerformanceAnalyzerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<AnalysisState>("idle");
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setState("loading");
    try {
      // Fetch the last 7 daily logs for the employee
      const logsCollection = collection(db, "dailyLogs");
      const q = query(
        logsCollection,
        where("employeeId", "==", employee.id),
        orderBy("date", "desc"),
        limit(7)
      );
      const logSnapshot = await getDocs(q);
      
      if (logSnapshot.empty) {
        toast({
            variant: "destructive",
            title: "No Data Found",
            description: `No performance logs found for ${employee.name} to analyze.`,
        });
        setState("idle");
        return;
      }
      
      const weeklyReportData = logSnapshot.docs.map(doc => doc.data() as DailyLog);
      // Convert the data to a simple string format for the AI
      const weeklyReport = weeklyReportData.map(log => {
          const { employeeId, id, timestamp, ...metrics } = log;
          return `Date: ${metrics.date}\n` + Object.entries(metrics).map(([key, value]) => `${key}: ${value}`).join('\n');
      }).join('\n\n');


      const result = await analyzeEmployeePerformance({
        employeeName: employee.name,
        weeklyReport,
      });

      setAnalysis(result.analysis);
      setSuggestions(result.suggestions);
      setState("success");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: "Could not generate AI analysis. Please try again.",
      });
      setState("error");
    }
  };
  
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset state when dialog is closed
      setTimeout(() => {
        setState("idle");
        setAnalysis(null);
        setSuggestions(null);
      }, 300);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkles className="mr-2 h-4 w-4" />
          Analyze with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary"/>
            AI Performance Analysis for {employee.name}
          </DialogTitle>
          <DialogDescription>
            AI-powered insights and suggestions based on the last 7 days of performance data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 min-h-[200px] flex items-center justify-center">
          {state === "idle" && (
            <div className="text-center p-8">
              <p className="mb-4 text-muted-foreground">Click the button below to start the AI analysis.</p>
              <Button onClick={handleAnalyze}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Insights
              </Button>
            </div>
          )}
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing performance data...</p>
            </div>
          )}
          {state === "error" && (
             <div className="flex flex-col items-center justify-center gap-4 p-8 text-destructive">
                <AlertTriangle className="h-8 w-8" />
                <p>Failed to generate analysis. Please try again.</p>
                <Button variant="destructive" onClick={handleAnalyze}>Retry</Button>
            </div>
          )}
          {state === "success" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Analysis</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{analysis}</p>
              </div>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-2">Suggestions</h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{suggestions}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
