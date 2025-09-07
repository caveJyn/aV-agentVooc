// /home/cave/projects/bots/venv/elizaOS_env/eliza-main/client/src/components/landing/features-section.tsx
import { Button } from "@/components/ui/button";

interface Feature {
  title: string;
  description: string;
  icon?: string;
}

interface FeaturesSectionProps {
  featuresSection: {
    heading: string;
    features: Feature[];
    ctaText: string;
  };
}

export const FeaturesSection = ({ featuresSection }: FeaturesSectionProps) => {
  // Fallback values
  const heading = featuresSection.heading || "Why Choose agentVooc?";
  const features =
    featuresSection.features.length > 0
      ? featuresSection.features
      : [
          {
            title: "Intelligent AI Agents",
            description: "Automate tasks with smart AI agents that learn and adapt.",
          },
          {
            title: "Seamless Automation",
            description: "Streamline workflows with one-click automation.",
          },
          {
            title: "Real-Time Insights",
            description: "Get actionable insights to make smarter decisions.",
          },
        ];
  const ctaText = featuresSection.ctaText || "Explore All Features";

  return (
    <section className="py-16 px-4 bg-agentvooc-primary-bg-dark">
      <div className="max-w-6xl mx-auto text-center">
        <h2 className="text-4xl font-bold mb-8 text-agentvooc-primary">
          {heading}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-agentvooc-secondary-accent rounded-lg shadow-agentvooc-glow hover:bg-agentvooc-secondary-accent/80 hover:shadow-lg transition-all duration-300"
            >
              {feature.icon && (
                <img
                  src={feature.icon}
                  alt={feature.title}
                  className="w-12 h-12 mx-auto mb-4 text-agentvooc-accent"
                />
              )}
              <h3 className="text-xl font-semibold text-agentvooc-primary mb-2">
                {feature.title}
              </h3>
              <p className="text-agentvooc-secondary">{feature.description}</p>
            </div>
          ))}
        </div>
        <Button className="mt-8 bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow rounded-full px-8 py-4 text-lg transform hover:scale-105 transition-all">
          {ctaText}
        </Button>
      </div>
    </section>
  );
};