import { Button } from "@/components/ui/button";
import { Link } from "react-router";

interface CTASectionProps {
  ctaSection: {
    heading: string;
    description: string;
    ctaText: string;
    ctaUrl?: string;
  };
}

export const CTASection = ({ ctaSection }: CTASectionProps) => {
  const heading = ctaSection.heading || "Ready to Transform Your Workflow?";
  const description =
    ctaSection.description ||
    "Join thousands of users automating their tasks with agentVooc.";
  const ctaText = ctaSection.ctaText || "Get Started Now";
  const ctaUrl = ctaSection.ctaUrl || "/company/blog/how-it-works";

  return (
  <section
    className="py-16 px-4 bg-gradient-to-r from-agentvooc-button-bg/60 to-agentvooc-secondary-accent text-center animate-fade-in"
    aria-label="Call to Action"
  >
    <h2 className="text-4xl md:text-5xl font-bold mb-4 shadow-agentvooc-glow inline-block px-4 py-1 rounded-full">
      {heading}
    </h2>
    <p className="mb-8 max-w-2xl mx-auto">{description}</p>
    <Link to={ctaUrl} className="inline-block">
      <Button
        variant="default"
        size="lg"
        className="animate-glow-pulse"
        aria-label={ctaText}
      >
        {ctaText}
      </Button>
    </Link>
  </section>
);
};