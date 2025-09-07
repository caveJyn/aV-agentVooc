// /home/cave/projects/bots/venv/elizaOS_env/eliza-main/client/src/components/landing/cta-section.tsx
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  ctaSection: {
    heading: string;
    description: string;
    ctaText: string;
  };
}

export const CTASection = ({ ctaSection }: CTASectionProps) => {
  // Fallback values
  const heading = ctaSection.heading || "Ready to Transform Your Workflow?";
  const description =
    ctaSection.description ||
    "Join thousands of users automating their tasks with agentVooc.";
  const ctaText = ctaSection.ctaText || "Get Started Now";

  return (
    <section className="py-16 px-4 bg-gradient-to-r from-agentvooc-button-bg to-agentvooc-secondary-accent text-center">
      <h2 className="text-4xl md:text-5xl font-bold mb-4 text-agentvooc-accent shadow-agentvooc-glow inline-block px-4 py-1 rounded-full">
        {heading}
      </h2>
      <p className="text-agentvooc-primary mb-8">{description}</p>
      <Button className="bg-agentvooc-accent text-agentvooc-primary-bg hover:bg-agentvooc-accent/80 shadow-agentvooc-glow animate-pulse-glow rounded-full px-8 py-4 text-xl transform hover:scale-105 transition-all">
        {ctaText}
      </Button>
    </section>
  );
};