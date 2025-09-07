// /home/cave/projects/bots/venv/elizaOS_env/eliza-main/client/src/components/landing/footer.tsx
interface FooterSection {
  tagline: string;
  companyLinks: Array<{ label: string; url: string }>;
  productLinks: Array<{ label: string; url: string }>;
  legalLinks: Array<{ label: string; url: string }>;
}

interface FooterProps {
  footerSection: FooterSection;
}

export const Footer = ({ footerSection }: FooterProps) => {
  // Fallback values
  const tagline =
    footerSection.tagline || "Empowering the future with AI automation.";
  const companyLinks =
    footerSection.companyLinks.length > 0
      ? footerSection.companyLinks
      : [
          { label: "About", url: "/about" },
          { label: "Careers", url: "/careers" },
          { label: "Contact", url: "/contact" },
        ];
  const productLinks =
    footerSection.productLinks.length > 0
      ? footerSection.productLinks
      : [
          { label: "Features", url: "/features" },
          { label: "Pricing", url: "/pricing" },
          { label: "Documentation", url: "/docs" },
        ];
  const legalLinks =
    footerSection.legalLinks.length > 0
      ? footerSection.legalLinks
      : [
          { label: "Privacy Policy", url: "/privacy" },
          { label: "Terms of Service", url: "/terms" },
        ];

  return (
    <footer className="py-12 px-4 bg-agentvooc-primary-bg-dark border-t  text-agentvooc-secondary">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <h3 className="text-lg font-semibold text-agentvooc-primary mb-4">
            agentVooc
          </h3>
          <p>{tagline}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-agentvooc-primary mb-4">
            Company
          </h3>
          <ul>
            {companyLinks.map((link, index) => (
              <li key={index}>
                <a href={link.url} className="hover:text-agentvooc-accent">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-agentvooc-primary mb-4">
            Product
          </h3>
          <ul>
            {productLinks.map((link, index) => (
              <li key={index}>
                <a href={link.url} className="hover:text-agentvooc-accent">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-agentvooc-primary mb-4">
            Legal
          </h3>
          <ul>
            {legalLinks.map((link, index) => (
              <li key={index}>
                <a href={link.url} className="hover:text-agentvooc-accent">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};