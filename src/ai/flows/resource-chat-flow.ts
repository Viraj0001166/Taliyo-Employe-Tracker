'use server';
/**
 * @fileOverview A flow to answer questions about the company's resources.
 *
 * - resourceChat - A function that handles the chat interaction.
 * - ResourceChatInput - The input type for the resourceChat function.
 * - ResourceChatOutput - The return type for the resourceChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Resource } from '@/lib/types';
import { gemini15Flash, gemini15Flash8b } from '@genkit-ai/googleai';
import { generateResourceContent } from '@/ai/flows/generate-resource-content-flow';

// Define a tool to get the knowledge base from Firestore
const getKnowledgeBase = ai.defineTool(
  {
    name: 'getKnowledgeBase',
    description: 'Retrieves the list of all available company resources to answer user questions.',
    inputSchema: z.object({}),
    outputSchema: z.array(z.object({
        category: z.string(),
        title: z.string(),
        content: z.string(),
    })),
  },
  async () => {
    const resourcesCollection = collection(db, "resources");
    const snapshot = await getDocs(resourcesCollection);
    if (snapshot.empty) {
      return [];
    }
    return snapshot.docs.map(doc => doc.data() as Resource);
  }
);


const ResourceChatInputSchema = z.object({
  history: z.array(z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
  })),
  question: z.string().describe('The user\'s question about the resources.'),
  tone: z.string().optional().describe("Preferred tone: 'friendly' (default), 'formal', or 'hinglish'."),
});
export type ResourceChatInput = z.infer<typeof ResourceChatInputSchema>;

const ResourceChatOutputSchema = z.object({
  answer: z.string().describe('The AI\'s answer to the user\'s question.'),
});
export type ResourceChatOutput = z.infer<typeof ResourceChatOutputSchema>;


const prompt = ai.definePrompt({
    name: 'resourceChatPrompt',
    model: gemini15Flash,
    input: { schema: ResourceChatInputSchema },
    output: { schema: ResourceChatOutputSchema },
    tools: [getKnowledgeBase],
    prompt: `You are a friendly, professional AI assistant for employees.
Your primary goal is to help with questions about the company's internal resources.

Style:
- Be concise, supportive, and clear. Prefer short paragraphs and bullet points.
- Keep a helpful tone, avoid jargon, and include tiny actionable tips when useful.

Tone preference from the user (if provided): {{tone}}
When tone = 'hinglish', you may mix simple Hindi/English phrases lightly (e.g., "Chaliye shuru karte hain"), while keeping it professional.
When tone = 'formal', keep responses crisp, polite, and business-like.

Scope:
- Answer using ONLY the knowledge base via the tool provided.
- If the knowledge base does not contain the answer, reply exactly: "I do not have information on that topic."
- Do not fabricate information.

This is the conversation history so far:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

This is the user's latest question:
"{{question}}"

Answer the user's question based on the provided resources.`,
});

// Fallback prompt using a lighter model to reduce overload errors (503)
const promptFallback = ai.definePrompt({
    name: 'resourceChatPromptFallback',
    model: gemini15Flash8b,
    input: { schema: ResourceChatInputSchema },
    output: { schema: ResourceChatOutputSchema },
    tools: [getKnowledgeBase],
    prompt: `You are a friendly, professional AI assistant for employees.
Your primary goal is to help with questions about the company's internal resources.

Style:
- Be concise, supportive, and clear. Prefer short paragraphs and bullet points.
- Keep a helpful tone, avoid jargon, and include tiny actionable tips when useful.

Tone preference from the user (if provided): {{tone}}
When tone = 'hinglish', you may mix simple Hindi/English phrases lightly (e.g., "Chaliye shuru karte hain"), while keeping it professional.
When tone = 'formal', keep responses crisp, polite, and business-like.

Scope:
- Answer using ONLY the knowledge base via the tool provided.
- If the knowledge base does not contain the answer, reply exactly: "I do not have information on that topic."
- Do not fabricate information.

This is the conversation history so far:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

This is the user's latest question:
"{{question}}"

Answer the user's question based on the provided resources.`,
});

const resourceChatFlow = ai.defineFlow(
  {
    name: 'resourceChatFlow',
    inputSchema: ResourceChatInputSchema,
    outputSchema: ResourceChatOutputSchema,
  },
  async (input) => {
    // Retry logic with fallback model to handle 503 overloads
    const runWithRetry = async () => {
      const attempts: Array<() => Promise<any>> = [
        () => prompt({ ...input, tone: input.tone || 'friendly' }),
        () => promptFallback({ ...input, tone: input.tone || 'friendly' }),
      ];
      let lastErr: any = null;
      for (let i = 0; i < attempts.length; i++) {
        try {
          return await attempts[i]();
        } catch (e: any) {
          lastErr = e;
          // Small backoff before next attempt
          await new Promise(res => setTimeout(res, 400 + i * 400));
        }
      }
      throw lastErr;
    };

    let outputObj: any;
    try {
      outputObj = await runWithRetry();
    } catch (e: any) {
      // Graceful degradation when both models are unavailable
      return { answer: 'The AI service is busy right now. Please try again in a moment.' };
    }

    const ans = (outputObj?.answer || '').trim();
    // Friendly fallback: if KB doesn't have the answer, generate a short draft
    if (!ans || /i do not have information on that topic\.?/i.test(ans)) {
      try {
        const gen = await generateResourceContent({
          prompt: `Write a short, ${input.tone || 'friendly'} draft to help the employee with this request. Keep it on-brand and concise (5-8 lines max). If it's a script/template, include placeholders like [Name], [Company]. If tone is 'hinglish', mix simple Hindi/English phrases lightly while remaining professional.

Employee question: ${input.question}`,
        });
        const draft = (gen.content || '').trim();
        const friendly = draft
          ? `I couldn't find this in the library, so here's a short draft you can use and refine:\n\n${draft}`
          : `I couldn't find this in the library. Try asking an admin to add it to Resources.`;
        return { answer: friendly };
      } catch {
        return { answer: 'I do not have information on that topic.' };
      }
    }
    return { answer: ans };
  }
);

export async function resourceChat(input: ResourceChatInput): Promise<ResourceChatOutput> {
    return resourceChatFlow(input);
}
