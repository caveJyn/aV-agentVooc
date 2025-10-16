import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

const CardTitle = ({ className, ...props }: CardTitleProps) => {
  return (
    <h3
      className={cn(
        "text-xl font-semibold text-agentvooc-primary leading-tight",
        className
      )}
      {...props}
    />
  );
};

export { CardTitle };