import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative rounded-b-sm border border-agentvooc-border/30 bg-agentvooc-card-bg text-agentvooc-primary shadow-2xl",
      "transform-gpu perspective-1000 transition-all duration-700 ease-out",
      "backdrop-saturate-200 backdrop-brightness-110",
      "before:absolute before:inset-0 before:rounded-3xl before:bg-agentvooc-accent-muted/5 before:opacity-0 before:transition-all before:duration-700 before:ease-out before:backdrop-blur-xl before:z-0",
      "shadow-inner shadow-agentvooc-accent/5",
      "mask-[url(#wave-mask)] mask-no-repeat mask-right mask-contain",
      className
    )}
    style={{
      transformStyle: "preserve-3d",
      boxShadow: `
        0 10px 20px -12px hsl(var(--agentvooc-primary-bg) / 0.8),
        0 0 0 1px hsl(var(--agentvooc-border) / 0.3),
        inset 0 1px 0 hsl(var(--agentvooc-accent) / 0.1),
        0 0 20px -10px hsl(var(--agentvooc-accent) / 0.2)
      `
    }}
    {...props}
  >
    <svg className="absolute w-0 h-0">
      <defs>
        <mask id="wave-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill="white" />
          <path
            d="M100%,0 C80%,40% 80%,60% 100%,100%"
            fill="black"
            stroke="black"
            strokeWidth="80"
            transform="translate(-20, 0)"
          />
        </mask>
      </defs>
    </svg>

    
    <div className="relative z-20">{children}</div>
  </div>
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-2 p-8 relative z-20 bg-agentvooc-card-header z-[-1]",
      "before:absolute before:inset-0 before:bg-gradient-to-br before:from-agentvooc-accent/8 before:via-agentvooc-accent-muted/5 before:to-transparent before:rounded-t-3xl before:z-[-1]",
      "after:absolute after:top-0 after:bottom-0 after:right-4 after:left-3/4 after:bg-gradient-to-r after:from-transparent after:via-agentvooc-accent/5 after:to-transparent after:rounded-t-3xl after:z-[-1]",
      className
    )}
  >
    <div
      className="absolute top-0 left-8 right-8 h-px after:absolute after:inset-0 after:bg-gradient-to-r after:from-agentvooc-accent/0 after:via-agentvooc-accent/40 after:to-agentvooc-accent/0 after:animate-pulse after:z-[-1]"
    />
    <div
      className="absolute bottom-0 left-8 right-8 h-px after:absolute after:inset-0 after:bg-gradient-to-r after:from-agentvooc-accent/0 after:via-agentvooc-accent/40 after:to-agentvooc-accent/0 after:animate-pulse after:z-[-1]"
    />
    {props.children}
  </div>
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "font-bold text-md leading-tight tracking-tight bg-gradient-to-r from-agentvooc-primary via-agentvooc-accent-muted to-agentvooc-primary bg-clip-text z-30",
      "drop-shadow-[0_0_10px_hsl(var(--agentvooc-accent)/0.2)]",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-sm text-agentvooc-secondary leading-relaxed relative py-6 px-4 z-30",
      "drop-shadow-[0_0_5px_hsl(var(--agentvooc-accent)/0.2)]",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "py-6 px-10 mb-4 relative z-20  text-agentvooc-primary",
      className
    )}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center p-8 pt-0 relative z-20",
      "before:absolute before:bottom-0 before:left-8 before:right-8 before:h-px before:bg-gradient-to-r before:from-transparent before:via-agentvooc-accent/15 before:to-transparent before:z-[-1]",
      "after:absolute after:bottom-0 after:left-8 after:right-8 after:h-px after:bg-gradient-to-r after:from-agentvooc-accent/0 after:via-agentvooc-accent/30 after:to-agentvooc-accent/0 after:blur-sm after:z-[-1]",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};