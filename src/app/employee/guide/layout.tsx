import { Suspense } from "react";

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading guide…</div>}>
      {children}
    </Suspense>
  );
}
