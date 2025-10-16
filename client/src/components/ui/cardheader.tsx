import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardHeader = ({ className, ...props }: CardHeaderProps) => {
  return (
    <div
      className={cn(
        "px-6 pt-6 pb-4 border-b border-agentvooc-accent/20",
        className
      )}
      {...props}
    />
  );
};

export { CardHeader };