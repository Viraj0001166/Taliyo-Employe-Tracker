import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const hasEnvCreds = !!(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);

const app = getApps().length
  ? getApps()[0]
  : initializeApp(
      hasEnvCreds
        ? {
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
          }
        : {
            // Falls back to ADC if env vars are not provided
            credential: applicationDefault(),
          }
    );

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export default app;
