"use client";

import dynamic from 'next/dynamic';

// Dynamically import the client Toaster with client-side rendering only
const ToasterInner = dynamic(() => import('@/components/ui/toaster').then(m => m.Toaster), {
  ssr: false,
});

export default function ToasterLazy() {
  return <ToasterInner />;
}
