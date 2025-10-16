interface SubFooterSection {
  ctaText: string;
  ctaUrl: string;
  copyright: string;
}

interface SubFooterProps {
  subFooterSection: SubFooterSection;
}

export const SubFooter = ({ subFooterSection }: SubFooterProps) => {
  const ctaText = subFooterSection.ctaText || "Still Not Sure?";
  const ctaUrl = subFooterSection.ctaUrl || "/demo";
  const copyright =
    subFooterSection.copyright || "© 2025 agentVooc. All rights reserved.";

  return (
    <section
      className="text-sm py-4 px-4 bg-agentvooc-primary-bg text-center border-t border-agentvooc-border animate-fade-in"
      aria-label="Sub Footer"
    >
      <p className="text-agentvooc-secondary mb-2">
        {ctaText}{" "}
        <a
          href={ctaUrl}
          className="text-agentvooc-accent hover:text-agentvooc-accent-dark footer-link shadow-agentvooc-glow inline-block px-2 py-1 rounded-full"
          aria-label="Watch Demo"
        >
          Watch Our Demo
        </a>
      </p>
      <p className="text-agentvooc-secondary">{copyright}</p>
    </section>
  );
};