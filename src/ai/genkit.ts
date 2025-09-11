import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
// Prefer IPv4 first to avoid wsarecv/IPv6 issues in some networks
try {
  const dns = require('dns');
  if (dns?.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // no-op on non-Node environments
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY || '',
    }),
  ],
});

// Helpful warning during development if API key is missing
if (!process.env.GEMINI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[Genkit] GEMINI_API_KEY is not set. AI flows may fail at runtime.');
}
