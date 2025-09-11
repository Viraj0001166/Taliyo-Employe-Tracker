import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { DailyLog } from '@/lib/types';
import { analyzeEmployeePerformance } from '@/ai/flows/analyze-employee-performance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const employeeId = body?.employeeId as string | undefined;
    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    // Fetch last 5 logs for the employee
    const logsCollection = collection(db, 'dailyLogs');
    const q = query(
      logsCollection,
      where('employeeId', '==', employeeId),
      orderBy('date', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return NextResponse.json({
        analysis: '',
        suggestions: 'No recent logs found. Try setting a simple goal for tomorrow: 20 connections and 5 messages.'
      });
    }

    const logs = snapshot.docs.map((d) => d.data() as DailyLog);

    // Build a short report string for the AI flow
    const weeklyReport = logs
      .map((log) => {
        const { employeeId: _emp, id: _id, submittedAt, timestamp, notes, ...metrics } = log;
        const lines = Object.entries(metrics)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        return `Date: ${log.date}\n${lines}`;
      })
      .join('\n\n');

    const result = await analyzeEmployeePerformance({
      employeeName: 'Employee',
      weeklyReport,
    });

    return NextResponse.json({
      analysis: result.analysis,
      suggestions: result.suggestions,
    });
  } catch (err: any) {
    console.error('suggest-improvements error:', err);
    return NextResponse.json({ error: 'Internal error generating suggestions.' }, { status: 500 });
  }
}
