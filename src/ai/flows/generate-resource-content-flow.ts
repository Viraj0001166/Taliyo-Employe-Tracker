'use server';
/**
 * @fileOverview A flow to generate resource content based on a user prompt.
 *
 * - generateResourceContent - A function that takes a prompt and generates content.
 * - GenerateResourceContentInput - The input type for the generateResourceContent function.
 * - GenerateResourceContentOutput - The return type for the generateResourceContent function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { gemini15Flash, gemini15Flash8b } from '@genkit-ai/googleai';
import { applyTaliyo } from '@/ai/prompts/taliyo-assistant';

const GenerateResourceContentInputSchema = z.object({
  prompt: z.string().describe('The user prompt to generate content from.'),
});

// Define output schema early so prompts/flows can reference it safely
const GenerateResourceContentOutputSchema = z.object({
  content: z.string().describe('The AI-generated content for the resource.'),
});
export type GenerateResourceContentOutput = z.infer<typeof GenerateResourceContentOutputSchema>;

// Normalize content to plain text (no code fences / no JSON wrappers)
function sanitizeContent(raw: string): string {
  try {
    let text = String(raw ?? '').trim();
    // Remove Markdown code fences ```lang ... ```
    if (text.startsWith('```')) {
      // Strip first fence
      const firstNewline = text.indexOf('\n');
      if (firstNewline !== -1) {
        text = text.slice(firstNewline + 1);
      }
      // Strip closing fence
      if (text.endsWith('```')) {
        text = text.slice(0, -3);
      }
      text = text.trim();
    }
    // If full JSON object is returned, try extracting a common field
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        const obj = JSON.parse(text);
        if (typeof obj === 'string') return obj;
        if (obj && typeof obj === 'object') {
          // Try common fields
          const candidate = (obj.content || obj.text || obj.message || '').toString();
          if (candidate) return candidate.trim();
          // Special-case: script arrays -> flatten to 'Speaker: line'
          if (Array.isArray((obj as any).script)) {
            const items = (obj as any).script;
            const lines = items.map((it: any) => {
              const speaker = (it?.speaker ?? it?.role ?? 'Speaker').toString();
              const line = (it?.line ?? it?.text ?? '').toString();
              return `${speaker}: ${line}`.trim();
            }).filter(Boolean);
            if (lines.length) return lines.join('\n');
          }
          // If the JSON itself is an array of speaker/line style items
          if (Array.isArray(obj) && obj.every((x: any) => typeof x === 'object' && (x?.speaker || x?.role) && (x?.line || x?.text))) {
            const lines = (obj as any[]).map((it: any) => {
              const speaker = (it?.speaker ?? it?.role ?? 'Speaker').toString();
              const line = (it?.line ?? it?.text ?? '').toString();
              return `${speaker}: ${line}`.trim();
            }).filter(Boolean);
            if (lines.length) return lines.join('\n');
          }
          // Convert arbitrary JSON to a readable plain-text outline
          const toPlain = (value: any, depth = 0): string => {
            const indent = '  '.repeat(depth);
            if (value == null) return '';
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              return String(value);
            }
            if (Array.isArray(value)) {
              const lines: string[] = [];
              value.forEach((item: any) => {
                const rendered = toPlain(item, depth + 1);
                const renderedLines = rendered.split('\n');
                if (renderedLines.length === 1) {
                  lines.push(`${indent}- ${rendered}`);
                } else {
                  lines.push(`${indent}- ${renderedLines.shift()}`);
                  renderedLines.forEach(l => lines.push(`${indent}  ${l}`));
                }
              });
              return lines.join('\n');
            }
            if (typeof value === 'object') {
              const lines: string[] = [];
              Object.keys(value).forEach((k) => {
                const v = (value as any)[k];
                if (v == null || v === '') return;
                if (typeof v === 'object') {
                  const nested = toPlain(v, depth + 1);
                  if (nested) {
                    lines.push(`${indent}${k}:`);
                    nested.split('\n').forEach(l => lines.push(`${indent}  ${l}`));
                  }
                } else {
                  lines.push(`${indent}${k}: ${toPlain(v, 0)}`);
                }
              });
              return lines.join('\n');
            }
            return '';
          };
          const outlined = toPlain(obj, 0).trim();
          if (outlined) return outlined;
        }
      } catch {
        // fallthrough: keep original text
      }
    }
    return text;
  } catch {
    return raw;
  }
}

// Fallback using 8B model
const promptFallback = ai.definePrompt({
    name: 'generateResourceContentPromptFallback',
    model: gemini15Flash8b,
    input: { schema: GenerateResourceContentInputSchema },
    output: { schema: GenerateResourceContentOutputSchema },
    prompt: applyTaliyo(`You are an expert content writer for a business development team.
Generate a resource content based on the following prompt.
The content should be clear, concise, and professional. It could be an email template, a call script, or a guideline.

STRICT OUTPUT RULES:
- Return ONLY plain text.
- Do NOT return JSON.
- Do NOT wrap in Markdown/code fences.
- Keep placeholders like [Name], [Company] if relevant.

Prompt: {{{prompt}}}

Now output the content (plain text only).`),
});

const generateResourceContentFallbackFlow = ai.defineFlow(
  {
    name: 'generateResourceContentFallbackFlow',
    inputSchema: GenerateResourceContentInputSchema,
    outputSchema: GenerateResourceContentOutputSchema,
  },
  async input => {
    const { output } = await promptFallback(input);
    return output!;
  }
);
export type GenerateResourceContentInput = z.infer<typeof GenerateResourceContentInputSchema>;

export async function generateResourceContent(input: GenerateResourceContentInput): Promise<GenerateResourceContentOutput> {
  try {
    const res = await generateResourceContentFlow(input);
    return { content: sanitizeContent(res.content) };
  } catch (e: any) {
    // Fallback to lighter model on overload
    try {
      const res2 = await generateResourceContentFallbackFlow(input);
      return { content: sanitizeContent(res2.content) };
    } catch {
      return { content: 'The AI service is busy right now. Please try again shortly.' };
    }
  }
}

const prompt = ai.definePrompt({
    name: 'generateResourceContentPrompt',
    model: gemini15Flash,
    input: { schema: GenerateResourceContentInputSchema },
    output: { schema: GenerateResourceContentOutputSchema },
    prompt: applyTaliyo(`You are an expert content writer for a business development team.
Generate a resource content based on the following prompt.
The content should be clear, concise, and professional. It could be an email template, a call script, or a guideline.

Prompt: {{{prompt}}}

Generate the content.`),
});

const generateResourceContentFlow = ai.defineFlow(
  {
    name: 'generateResourceContentFlow',
    inputSchema: GenerateResourceContentInputSchema,
    outputSchema: GenerateResourceContentOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return { content: sanitizeContent(output!.content) };
  }
);
