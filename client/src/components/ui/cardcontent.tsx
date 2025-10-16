import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

const CardContent = ({ className, ...props }: CardContentProps) => {
  return (
    <div
      className={cn(
        "px-6 py-4",
        className
      )}
      {...props}
    />
  );
};

export { CardContent };