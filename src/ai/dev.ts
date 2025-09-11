import { config } from 'dotenv';
import { existsSync } from 'fs';

// Load .env.local if present, otherwise fall back to .env
config({ path: existsSync('.env.local') ? '.env.local' : '.env' });

import '@/ai/flows/analyze-employee-performance.ts';
import '@/ai/flows/fetch-url-content-flow.ts';
import '@/ai/flows/generate-resource-content-flow.ts';
import '@/ai/flows/resource-chat-flow.ts';
// import '@/ai/flows/admin-agent-flow.ts';
