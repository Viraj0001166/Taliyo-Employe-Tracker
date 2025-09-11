"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend, Tooltip } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { PerformanceData } from "@/lib/types"

const chartConfig = {
  linkedinConnections: {
    label: "LinkedIn",
    color: "hsl(var(--chart-1))",
  },
  coldEmails: {
    label: "Emails",
    color: "hsl(var(--chart-2))",
  },
  leadsGenerated: {
    label: "Leads",
    color: "hsl(var(--chart-3))",
  },
}

interface LeaderboardProps {
  data: PerformanceData[]
}

export function Leaderboard({ data }: LeaderboardProps) {
  const sortedData = [...data].sort((a, b) => b.leadsGenerated - a.leadsGenerated);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Performance Leaderboard</CardTitle>
        <CardDescription>Comparison of employee performance this week.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="w-full h-[400px]">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{
              left: 10,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="employeeName"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              width={120}
            />
            <XAxis dataKey="leadsGenerated" type="number" hide />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
            <Legend content={<ChartLegendContent />} />
            <Bar dataKey="linkedinConnections" stackId="a" fill="var(--color-linkedinConnections)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="coldEmails" stackId="a" fill="var(--color-coldEmails)" radius={[0, 4, 4, 0]} />
            <Bar dataKey="leadsGenerated" stackId="a" fill="var(--color-leadsGenerated)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
