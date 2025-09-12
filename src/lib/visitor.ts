"use client";

import { addDoc, collection } from "firebase/firestore";
import { auth, db } from "./firebase";

// Fetch public IP with a short timeout and safe fallback
async function fetchPublicIp(timeoutMs = 3000): Promise<string> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return "Unknown";
    const data = (await res.json()) as { ip?: string };
    return data?.ip || "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function createVisitorLogForCurrentUser(portal?: 'employee' | 'training' | 'admin'): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user to create visitor log for");

  const ipAddress = await fetchPublicIp();
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const employeeName = user.displayName || (user.email ? user.email.split("@")[0] : "Unknown");
  const employeeEmail = user.email || "Unknown";

  await addDoc(collection(db, "visitorLogs"), {
    employeeId: user.uid,
    employeeName,
    employeeEmail,
    loginTime: new Date(),
    ipAddress,
    userAgent,
    ...(portal ? { portal } : {}),
  });
}
