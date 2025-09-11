"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type RotatingTechProps = {
  intervalMs?: number;
  className?: string;
};

export default function RotatingTech({ intervalMs = 5000, className = "" }: RotatingTechProps) {
  // Custom tech illustrations - no copyright issues
  const images = useMemo(
    () => [
      "/tech-illustrations/coding.svg",
      "/tech-illustrations/ai-brain.svg", 
      "/tech-illustrations/cloud-server.svg",
      "/tech-illustrations/data-analytics.svg",
      "/tech-illustrations/mobile-app.svg",
      "/tech-illustrations/security.svg"
    ],
    []
  );

  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      // trigger fade out then swap image then fade in
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % images.length);
        setFade(true);
      }, 250);
    }, intervalMs);
    return () => clearInterval(id);
  }, [images.length, intervalMs]);

  const src = images[index];

  return (
    <div className={`relative w-full aspect-[4/3] md:aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 ring-1 ring-white/10 shadow-xl ${className}`}>
      {/* current image */}
      <Image
        key={src}
        src={src}
        alt="Welcome illustration"
        fill
        sizes="(max-width: 768px) 100vw, 50vw"
        className={`object-cover transition-opacity duration-500 ${fade ? "opacity-100" : "opacity-0"}`}
        priority
      />
      {/* overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
    </div>
  );
}
