// /home/cave/projects/bots/venv/elizaOS_env/eliza-main/client/src/components/landing/sub-footer.tsx
interface SubFooterSection {
  ctaText: string;
  ctaUrl: string;
  copyright: string;
}

interface SubFooterProps {
  subFooterSection: SubFooterSection;
}

export const SubFooter = ({ subFooterSection }: SubFooterProps) => {
  // Fallback values
  const ctaText = subFooterSection.ctaText || "Still Not Sure?";
  const ctaUrl = subFooterSection.ctaUrl || "/demo";
  const copyright =
    subFooterSection.copyright || "© 2025 agentVooc. All rights reserved.";

  return (
    <div className="text-sm py-4 px-4 bg-agentvooc-primary-bg text-center border-t border-agentvooc-accent/30">
      <p className="text-agentvooc-secondary mb-2">
        {ctaText}{" "}
        <a href={ctaUrl} className="text-agentvooc-accent hover:underline shadow-agentvooc-glow inline-block px-2 py-1 rounded-full">
          Watch Our Demo
        </a>
      </p>
      <p className="text-sm text-agentvooc-secondary">{copyright}</p>
    </div>
  );
};