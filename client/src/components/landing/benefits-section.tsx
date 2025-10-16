interface ImageVariants {
  main: string;
  thumbnail: string;
  medium: string;
}

interface BenefitsSectionProps {
  benefitsSection: {
    heading: string;
    description: string;
    benefitsList: string[];
    image: ImageVariants;
  };
}

export const BenefitsSection = ({ benefitsSection }: BenefitsSectionProps) => {
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
  const image = "/ccfade.png"; // Use main image from props, fallback to default

  return (
    <section className="py-16 px-4 bg-agentvooc-secondary-bg animate-fade-in" aria-label="Benefits">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-8">
        <div className="md:w-1/2">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 relative">
            {heading}
            <span className="absolute bottom-0 left-0 w-24 h-1 bg-agentvooc-accent -mb-3"></span>
          </h2>
          <p className="mb-4">{description}</p>
          <ul className="list-disc list-inside custom-bullets space-y-2">
            {benefitsList.map((benefit, index) => (
              <li key={index} className="flex items-center">
                <span className="text-agentvooc-accent mr-2">•</span>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <div className="md:w-1/2">
          <div className="text-xl md:text-3xl justify-center flex font-bold mb-4 relative">
            Create Your Character
          </div>
          <div className="relative w-full">
            <img
              src={image}
              alt="Benefits of agentVooc"
              className="rounded-lg shadow-agentvooc-glow w-full h-auto object-contain"
            />
            <div
              className="absolute inset-0 bg-black/10 rounded-lg"
              aria-hidden="true"
            ></div>
            <div
              className="absolute bottom-0 left-0 w-full h-[30%] bg-gradient-to-t from-agentvooc-secondary-bg to-transparent"
              aria-hidden="true"
            ></div>
          </div>
        </div>
      </div>
    </section>
  );
};