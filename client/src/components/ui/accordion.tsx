import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Accordion({ title, children, defaultOpen = false }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center p-4 bg-agentvooc-secondary-accent/20 rounded-lg hover:bg-agentvooc-secondary-accent/30 transition-all duration-300"
      >
        <span className="text-lg font-semibold text-agentvooc-primary">{title}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-agentvooc-accent" />
        ) : (
          <ChevronDown className="w-5 h-5 text-agentvooc-accent" />
        )}
      </button>
      {isOpen && (
        <div className="mt-2 p-4 bg-agentvooc-secondary-bg/80 border border-agentvooc-accent/30 rounded-lg">
          {children}
        </div>
      )}
    </div>
  );
}