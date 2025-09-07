// /client/src/components/BackgroundWrapper.tsx
import { cn } from "@/lib/utils"; // Shadcn's utility for className merging
import { ReactNode } from "react";

interface BackgroundWrapperProps {
  children: ReactNode;
  className?: string; // Allow custom background overrides
}

export function BackgroundWrapper({ children, className }: BackgroundWrapperProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-gradient-to-b from-agentvooc-primary-bg to-background",
        className
      )}
    >
      {children}
    </div>
  );
}