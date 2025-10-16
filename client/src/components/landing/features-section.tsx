import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NavLink } from "react-router";

interface ImageVariants {
  main: string;
  thumbnail: string;
  medium: string;
}

interface Feature {
  title: string;
  description: string;
  icon?: ImageVariants;
}

interface FeaturesSectionProps {
  featuresSection: {
    heading: string;
    features: Feature[];
    ctaText: string;
  };
}

export const FeaturesSection = ({ featuresSection }: FeaturesSectionProps) => {
  const heading = featuresSection.heading || "Why Choose agentVooc?";
  const features =
    featuresSection.features.length > 0
      ? featuresSection.features
      : [
          {
            title: "Intelligent AI Agents",
            description: "Automate tasks with smart AI agents that learn and adapt.",
            icon: null,
          },
          {
            title: "Seamless Automation",
            description: "Streamline workflows with one-click automation.",
            icon: null,
          },
          {
            title: "Real-Time Insights",
            description: "Get actionable insights to make smarter decisions.",
            icon: null,
          },
        ];
  const ctaText = featuresSection.ctaText || "Explore All Features";

  return (
  <section className="py-16 px-4 animate-fade-in" aria-label="Features">
    <div className="max-w-6xl mx-auto text-center">
      <h2 className="text-4xl font-bold mb-8">{heading}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {features.map((feature, index) => (
          <Card
            key={index}
            className=""
            aria-labelledby={`feature-${index}-title`}
          >
            <CardContent className="">
              {feature.icon && feature.icon.main ? (
                <img
                  src={feature.icon.main}
                  alt={feature.title}
                  className="w-12 h-12 mx-auto mb-4 object-contain"
                  onError={(e) => {
                    console.error(`Failed to load feature icon for ${feature.title}:`, feature.icon?.main);
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-12 h-12 mx-auto mb-4 bg-agentvooc-primary-bg/70 rounded-full flex items-center justify-center">
                  <span className="text-agentvooc-accent text-lg">
                    {feature.title.charAt(0)}
                  </span>
                </div>
              )}
              <h3 id={`feature-${index}-title`} className="text-xl font-semibold mb-2">
                {feature.title}
              </h3>
              <p>{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <NavLink to="https://agentvooc.com/product/features">
      <Button
        variant="default"
        size="lg"
        className="mt-8 animate-glow-pulse"
        aria-label="Explore All Features"
      >
        {ctaText}
      </Button>
      </NavLink>
    </div>
  </section>
);
};