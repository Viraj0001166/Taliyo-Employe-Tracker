import { getApps, initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const hasEnvCreds = !!(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

// Only use ADC if an explicit hint is present; otherwise fail fast with a helpful error
const useADC = !!(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_PROJECT_ID
);

const initOptions = hasEnvCreds
  ? {
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    }
  : useADC
    ? {
        credential: applicationDefault(),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      }
    : null as any;

const app = getApps().length
  ? getApps()[0]
  : (() => {
      if (!initOptions) {
        throw new Error(
          'Firebase Admin credentials not configured. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (and FIREBASE_STORAGE_BUCKET) in your environment, or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON for ADC.'
        );
      }
      return initializeApp(initOptions as any);
    })();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

export default app;
