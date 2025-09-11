'use server';
/**
 * @fileOverview A conversational AI agent for administrative tasks.
 * This agent can understand natural language commands to manage company resources.
 *
 * - adminAgentChat - A function that handles the chat interaction for the admin agent.
 * - AdminAgentChatInput - The input type for the adminAgentChat function.
 * - AdminAgentChatOutput - The return type for the adminAgentChat function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { collection, addDoc, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Resource } from '@/lib/types';
import { gemini15Flash } from '@genkit-ai/googleai';

// Tool to create or update a resource in Firestore
const createOrUpdateResource = ai.defineTool(
  {
    name: 'createOrUpdateResource',
    description: 'Creates a new resource or updates an existing one if a resource with the same title already exists. Use this to fulfill user requests for creating or modifying resources like email templates, scripts, or guidelines.',
    inputSchema: z.object({
      category: z.string().describe("The category for the resource, e.g., 'Email Templates', 'Scripts'."),
      title: z.string().describe('The title of the resource.'),
      content: z.string().describe('The full content of the resource.'),
    }),
    outputSchema: z.string(),
  },
  async ({ category, title, content }) => {
    const resourcesCollection = collection(db, "resources");
    const q = query(resourcesCollection, where("title", "==", title));
    const snapshot = await getDocs(q);
    /*
    (Moved) Memory tool definitions were accidentally placed here. They are now defined at top-level below.
    */

    if (snapshot.empty) {
      // Create new resource
      await addDoc(resourcesCollection, { category, title, content });
      return `Successfully created a new resource titled "${title}".`;
    } else {
      // Update existing resource
      const docId = snapshot.docs[0].id;
      await updateDoc(doc(db, "resources", docId), { category, content });
      return `Successfully updated the existing resource titled "${title}".`;
    }
  }
);

// Web Search Tool (SerpAPI)
const searchWeb = ai.defineTool(
  {
    name: 'searchWeb',
    description: 'Search the web for relevant pages and return top results with title, url, and snippet. Requires SERPAPI_API_KEY to be set.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
    }),
    outputSchema: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        snippet: z.string().optional(),
      })
    ),
  },
  async ({ query }) => {
    try {
      const apiKey = process.env.SERPAPI_API_KEY || process.env.NEXT_PUBLIC_SERPAPI_API_KEY || '';
      if (!apiKey) {
        // Graceful fallback: no key configured
        return [] as { title: string; url: string; snippet?: string }[];
      }
      const endpoint = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&engine=google&num=5&api_key=${apiKey}`;
      const res = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
      const data = await res.json();
      const results: any[] = Array.isArray(data?.organic_results) ? data.organic_results : [];
      return results.slice(0, 5).map((r: any) => ({
        title: String(r.title || ''),
        url: String(r.link || ''),
        snippet: r.snippet ? String(r.snippet) : undefined,
      }));
    } catch {
      return [] as { title: string; url: string; snippet?: string }[];
    }
  }
);

// Web Browsing Tool
const fetchWebPage = ai.defineTool(
  {
    name: 'fetchWebPage',
    description: 'Fetches a public web page and returns plain text content for research and referencing. Use sparingly and summarize.',
    inputSchema: z.object({
      url: z.string().describe('HTTP/HTTPS URL to fetch'),
    }),
    outputSchema: z.object({
      url: z.string(),
      title: z.string().optional(),
      text: z.string(),
    }),
  },
  async ({ url }) => {
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('Only http/https URLs are supported.');
    }
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    const withoutScripts = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ');
    const text = withoutScripts
      .replace(/<[^>]+>/g, ' ') // strip tags
      .replace(/\s+/g, ' ')     // collapse whitespace
      .trim()
      .slice(0, 8000);          // limit length
    return { url, title, text };
  }
);


// Memory Tools
const saveMemory = ai.defineTool(
  {
    name: 'saveMemory',
    description: 'Save a persistent memory (fact/preference) for the given admin. If a memory with the same key exists, it will be updated.',
    inputSchema: z.object({
      adminId: z.string().describe('Firebase Auth UID of the admin user'),
      key: z.string().describe('Short key or title for this memory'),
      value: z.string().describe('The content/value to remember'),
      tags: z.array(z.string()).optional().describe('Optional tags to categorize the memory'),
    }),
    outputSchema: z.string(),
  },
  async ({ adminId, key, value, tags = [] }) => {
    const memoriesCol = collection(db, 'aiMemories', adminId, 'memories');
    const q = query(memoriesCol, where('key', '==', key));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDoc(memoriesCol, {
        key,
        value,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return `Saved new memory for key "${key}".`;
    } else {
      const memDoc = snapshot.docs[0];
      await updateDoc(doc(db, 'aiMemories', adminId, 'memories', memDoc.id), {
        value,
        tags,
        updatedAt: Date.now(),
      });
      return `Updated existing memory for key "${key}".`;
    }
  }
);

const getMemories = ai.defineTool(
  {
    name: 'getMemories',
    description: 'Retrieve all saved memories for the given admin (facts, preferences, instructions).',
    inputSchema: z.object({
      adminId: z.string().describe('Firebase Auth UID of the admin user'),
    }),
    outputSchema: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
        tags: z.array(z.string()).optional(),
      })
    ),
  },
  async ({ adminId }) => {
    const memoriesCol = collection(db, 'aiMemories', adminId, 'memories');
    const snapshot = await getDocs(memoriesCol);
    if (snapshot.empty) return [] as { key: string; value: string; tags?: string[] }[];
    return snapshot.docs.map(d => {
      const data: any = d.data();
      return { key: data.key, value: data.value, tags: data.tags };
    });
  }
);


const AdminAgentChatInputSchema = z.object({
  history: z.array(z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
  })),
  prompt: z.string().describe("The admin's latest request or command."),
  adminId: z.string().describe('Firebase Auth UID to scope memory to'),
  memories: z.array(z.object({ key: z.string(), value: z.string(), tags: z.array(z.string()).optional() })).optional(),
});
export type AdminAgentChatInput = z.infer<typeof AdminAgentChatInputSchema>;

const AdminAgentChatOutputSchema = z.object({
  response: z.string().describe("The AI's response to the admin."),
});
export type AdminAgentChatOutput = z.infer<typeof AdminAgentChatOutputSchema>;


const prompt = ai.definePrompt({
    name: 'adminAgentPrompt',
    model: gemini15Flash,
    input: { schema: AdminAgentChatInputSchema },
    output: { schema: AdminAgentChatOutputSchema },
    tools: [createOrUpdateResource, saveMemory, getMemories, searchWeb, fetchWebPage],
    prompt: `You are an AI Administrative Assistant for Taliyo. Your name is 'LeadTrack Pulse AI'.
You are friendly, professional, and highly capable.
Your primary role is to help the administrator manage company resources by understanding their commands and using the available tools.

- **Engage Naturally:** Start with a friendly greeting. Understand the user's intent, even if it's not perfectly phrased.
- **Confirm Actions:** Before you act, confirm what you're about to do. For example, "You want me to create a new email template titled 'Follow-Up', is that correct?". After the action, confirm the result.
- **Use Tools:** You MUST use the provided tools to create, update, or find resources. Do not just generate text. You must call the tool.
- **Handle Ambiguity:** If a command is unclear (e.g., "update the script"), ask for clarification (e.g., "Which script would you like me to update? Please provide the title.").
- **Decline Out-of-Scope Requests:** If the admin asks for something unrelated to managing resources (e.g., "what's the weather?"), politely decline and state your purpose.

- **Memory:** You have persistent memory tools.
  - Use getMemories with the provided adminId at the start of a conversation or when context is needed.
  - When the admin shares stable preferences, company facts, or instructions to remember, confirm and call saveMemory with a concise key and the value.
  - When relevant, incorporate recalled memories into your responses.

- **Web Research:** When the admin requests internet research, first use searchWeb to find relevant links, then use fetchWebPage to read a chosen URL. Summarize succinctly with sources. Do not copy large chunks; prefer concise insights with links.

Admin context:
- adminId: {{adminId}}

Known memories for this admin (if any):
{{#each memories}}
- {{this.key}}: {{this.value}}
{{/each}}

This is the conversation history so far:
{{#each history}}
- {{role}}: {{content}}
{{/each}}

This is the admin's latest request:
"{{prompt}}"

Based on this, understand the user's goal and respond or use a tool.`,
});

const adminAgentFlow = ai.defineFlow(
  {
    name: 'adminAgentFlow',
    inputSchema: AdminAgentChatInputSchema,
    outputSchema: AdminAgentChatOutputSchema,
  },
  async (input) => {
    // Preload memories so the model has context without needing a tool call
    let memories: { key: string; value: string }[] = [];
    try {
      if (input.adminId) {
        const memCol = collection(db, 'aiMemories', input.adminId, 'memories');
        const memSnap = await getDocs(memCol);
        memories = memSnap.docs.map((d) => {
          const data: any = d.data();
          return { key: data.key, value: data.value };
        });
      }
    } catch (e) {
      // ignore memory preload failures
    }
    const { output } = await prompt({ ...input, memories });
    return output!;
  }
);

export async function adminAgentChat(input: AdminAgentChatInput): Promise<AdminAgentChatOutput> {
    return adminAgentFlow(input);
}
