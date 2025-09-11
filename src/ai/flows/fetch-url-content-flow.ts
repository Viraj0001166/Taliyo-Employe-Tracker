'use server';
/**
 * @fileOverview A flow to fetch and parse content from a given URL.
 *
 * - fetchUrlContent - Fetches content from a URL and returns the main text.
 * - FetchUrlContentInput - The input type for the fetchUrlContent function.
 * - FetchUrlContentOutput - The return type for the fetchUrlContent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { gemini15Flash } from '@genkit-ai/googleai';

const FetchUrlContentInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch content from.'),
});
export type FetchUrlContentInput = z.infer<typeof FetchUrlContentInputSchema>;

const FetchUrlContentOutputSchema = z.object({
  content: z.string().describe('The main text content of the webpage.'),
});
export type FetchUrlContentOutput = z.infer<typeof FetchUrlContentOutputSchema>;

export async function fetchUrlContent(input: FetchUrlContentInput): Promise<FetchUrlContentOutput> {
  return fetchUrlContentFlow(input);
}

const prompt = ai.definePrompt({
    name: 'fetchUrlContentPrompt',
    model: gemini15Flash,
    input: { schema: FetchUrlContentInputSchema },
    output: { schema: FetchUrlContentOutputSchema },
    prompt: `You are a web page content extractor. Your task is to extract the main article or body content from the provided URL.
Exclude all navigation links, headers, footers, advertisements, and other boilerplate content. Return only the primary text content.

URL: {{{url}}}
`,
});

const fetchUrlContentFlow = ai.defineFlow(
  {
    name: 'fetchUrlContentFlow',
    inputSchema: FetchUrlContentInputSchema,
    outputSchema: FetchUrlContentOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
