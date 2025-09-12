import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export async function notifyUser(uid: string, payload: { title: string; message?: string; type?: string; link?: string }) {
  try {
    const col = collection(db, 'notifications', uid, 'items');
    await addDoc(col, {
      title: payload.title,
      message: payload.message || '',
      type: payload.type || 'info',
      link: payload.link || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // fail silently
    console.warn('notifyUser failed', e);
  }
}
