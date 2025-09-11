'use server';

/**
 * @fileOverview Analyzes employee performance metrics from weekly reports and provides suggestions for improvement.
 *
 * - analyzeEmployeePerformance - A function that handles the performance analysis process.
 * - AnalyzeEmployeePerformanceInput - The input type for the analyzeEmployeePerformance function.
 * - AnalyzeEmployeePerformanceOutput - The return type for the analyzeEmployeePerformance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { gemini15Flash } from '@genkit-ai/googleai';

const AnalyzeEmployeePerformanceInputSchema = z.object({
  employeeName: z.string().describe('The name of the employee to analyze.'),
  weeklyReport: z.string().describe('The employee\'s weekly performance report data.'),
});
export type AnalyzeEmployeePerformanceInput = z.infer<typeof AnalyzeEmployeePerformanceInputSchema>;

const AnalyzeEmployeePerformanceOutputSchema = z.object({
  analysis: z.string().describe('AI analysis of the employee\'s performance.'),
  suggestions: z.string().describe('Suggestions for improving the employee\'s performance.'),
});
export type AnalyzeEmployeePerformanceOutput = z.infer<typeof AnalyzeEmployeePerformanceOutputSchema>;

export async function analyzeEmployeePerformance(
  input: AnalyzeEmployeePerformanceInput
): Promise<AnalyzeEmployeePerformanceOutput> {
  return analyzeEmployeePerformanceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeEmployeePerformancePrompt',
  model: gemini15Flash,
  input: {schema: AnalyzeEmployeePerformanceInputSchema},
  output: {schema: AnalyzeEmployeePerformanceOutputSchema},
  prompt: `You are an AI performance analyst. Analyze the weekly report of {{employeeName}} and provide detailed analysis and suggestions for improvement.

Weekly Report:
{{weeklyReport}}

Provide your analysis and suggestions in a structured format.`,
});

const analyzeEmployeePerformanceFlow = ai.defineFlow(
  {
    name: 'analyzeEmployeePerformanceFlow',
    inputSchema: AnalyzeEmployeePerformanceInputSchema,
    outputSchema: AnalyzeEmployeePerformanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
