// /home/cave/projects/bots/venv/elizaOS_env/eliza-main/client/src/components/landing/benefits-section.tsx
interface BenefitsSectionProps {
  benefitsSection: {
    heading: string;
    description: string;
    benefitsList: string[];
    image: string;
  };
}

export const BenefitsSection = ({ benefitsSection }: BenefitsSectionProps) => {
  // Fallback values
  const heading = benefitsSection.heading || "Solve Your Biggest Challenges";
  const description =
    benefitsSection.description ||
    "agentVooc helps you save time, make smarter decisions, and scale effortlessly with AI-driven automation.";
  const benefitsList =
    benefitsSection.benefitsList.length > 0
      ? benefitsSection.benefitsList
      : [
          "Save Time with Automation",
          "Make Smarter Decisions",
          "Scale Effortlessly",
        ];
  const image = benefitsSection.image || "/dashboard-screenshot.png";

  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
        <div className="md:w-1/2">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-agentvooc-primary relative">
            {heading}
            <span className="absolute bottom-0 left-0 w-24 h-1 bg-agentvooc-accent -mb-3"></span>
          </h2>
          <p className="text-agentvooc-secondary mb-4">{description}</p>
          <ul className="list-disc list-inside text-agentvooc-secondary custom-bullets">
            {benefitsList.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
        </div>
        <div className="md:w-1/2">
          <img
            src={image}
            alt="Benefits"
            className="rounded-lg border border-agentvooc-accent/30 shadow-agentvooc-glow transform rotate-2 hover:rotate-0 transition-transform duration-300"
          />
        </div>
      </div>
    </section>
  );
};