
"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { DailyLog } from "@/lib/types"
import { format } from "date-fns"
import { useMemo } from "react"

interface WeeklySummaryProps {
  data: DailyLog[]
}

// Fixed metric set with distinct colors
const metricKeys = [
  'interestedLeads',
  'messagesSent',
  // 'status' is a string in our data model, so we do NOT chart it as a number
  'accepted',
  'connectionsSent',
  'replies',
] as const;

export function WeeklySummary({ data }: WeeklySummaryProps) {
  const { chartData, chartConfig } = useMemo(() => {
    // Map fixed metrics to labels + colors
    const config: Record<string, { label: string; color: string }> = {
      interestedLeads: { label: 'Interested Leads', color: 'hsl(var(--chart-1))' },
      messagesSent: { label: 'Messages Sent', color: 'hsl(var(--chart-2))' },
      accepted: { label: 'Accepted', color: 'hsl(var(--chart-3))' },
      connectionsSent: { label: 'Connections Sent', color: 'hsl(var(--chart-4))' },
      replies: { label: 'Replies', color: 'hsl(var(--chart-5))' },
    };

    const aData = data.map((log) => {
      const dayData: Record<string, any> = {
        date: format(new Date(log.date), 'EEE'),
      };
      metricKeys.forEach((k) => {
        dayData[k] = Number((log as any)[k] ?? 0);
      });
      return dayData;
    });
    return { chartData: aData, chartConfig: config };
  }, [data]);

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    data.forEach((log) => {
      const s = String((log as any).status ?? '').trim() || 'Unspecified';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [data]);

  const getStatusChipClasses = (label: string) => {
    const l = label.toLowerCase();
    if (/(hire|selected|accepted|joined)/.test(l)) return "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    if (/(progress|follow|ongoing|pending)/.test(l)) return "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    if (/(reject|decline|not|drop)/.test(l)) return "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    if (/(active|new|interested)/.test(l)) return "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800";
    return "bg-muted text-foreground border-border/50";
  };

  return (
    <Card className="h-full flex flex-col shadow-sm">
      <CardHeader>
        <CardTitle>Recruitment Progress</CardTitle>
        <CardDescription>Your performance over the last 7 days.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer
          config={chartConfig}
          className="w-full max-w-2xl mx-auto h-72 aspect-auto"
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis />
            <ChartTooltip
              content={<ChartTooltipContent />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {Object.keys(chartConfig).map((key) => (
                 <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={4} />
            ))}
          </BarChart>
        </ChartContainer>
        {/* Mobile-only status summary */}
        <div className="mt-3 block md:hidden">
          <div className="text-xs text-muted-foreground mb-1">Status summary (last 7 days)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusSummary)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <span
                  key={label}
                  className={
                    "rounded-full border px-2 py-1 text-xs " + getStatusChipClasses(label)
                  }
                >
                  {label}: <span className="font-medium">{count}</span>
                </span>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
