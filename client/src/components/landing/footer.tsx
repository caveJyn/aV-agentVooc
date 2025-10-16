import { useFooter } from "@/context/footerContext";
import { X, Github} from "lucide-react";
import { FaFacebookF, FaLinkedin } from 'react-icons/fa';
import { FiMessageCircle } from 'react-icons/fi';


export function Footer() {
  const { footerSection, subFooterSection } = useFooter();

  // Map platform to corresponding Lucide icon
  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "twitter":
        return <X className="w-6 h-6" aria-hidden="true" />;
      case "facebook":
        return <FaFacebookF className="w-6 h-6" aria-hidden="true" />;
      case "whatsapp":
        return <FiMessageCircle className="w-6 h-6" aria-hidden="true" />;
      case "github":
        return <Github className="w-6 h-6" aria-hidden="true" />;
      case "linkedin":
        return <FaLinkedin className="w-6 h-6" aria-hidden="true" />;
      // Add more cases for other platforms as needed
      default:
        return null;
    }
  };

  return (
    <footer className="py-12 px-4 bg-agentvooc-primary-bg border-t border-agentvooc-border  animate-fade-in">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <section aria-label="About agentVooc">
          <h3 className="text-lg font-semibold mb-4">
            agentVooc
          </h3>
          <div></div>
          <p>{footerSection.tagline}</p>
          <div className="flex space-x-4 mt-4">
            {footerSection.socialLinks.map((social, index) => (
              <a
                key={index}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow us on ${social.platform}`}
                className="text-agentvooc-accent hover:text-agentvooc-accent-dark transition-colors"
              >
                {getSocialIcon(social.platform)}
              </a>
            ))}
          </div>
        </section>
        <section aria-label="Company Links">
          <h3 className="text-lg font-semibold mb-4">
            Company
          </h3>
          <ul className="space-y-2">
            {footerSection.companyLinks.length > 0 ? (
              footerSection.companyLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className=""
                  >
                    {link.label}
                  </a>
                </li>
              ))
            ) : (
              <li className="">No company links available.</li>
            )}
          </ul>
        </section>
        <section aria-label="Product Links">
          <h3 className="text-lg font-semibold mb-4">
            Product
          </h3>
          <ul className="space-y-2">
            {footerSection.productLinks.length > 0 ? (
              footerSection.productLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className=""
                  >
                    {link.label}
                  </a>
                </li>
              ))
            ) : (
              <li className="">No product links available.</li>
            )}
          </ul>
        </section>
        <section aria-label="Legal Links">
          <h3 className="text-lg font-semibold text-agentvooc-primary mb-4">
            Legal
          </h3>
          <ul className="space-y-2">
            {/* {footerSection.legalLinks.length > 0 ? (
              footerSection.legalLinks.map((link, index) => (
                <li key={index}>
                  <a
                    href={link.url}
                    className=""
                  >
                    {link.label}
                  </a>
                </li>
              ))
            ) : (
              <li className="">No legal links available.</li>
            )} */}
            <li>
              <a
                href="/api/sitemap.xml"
                className=""
              >
                Sitemap
              </a>
            </li>
          </ul>
        </section>
      </div>
      <div className="mt-8 pt-8 border-t border-agentvooc-border text-center">
        <a
          href={subFooterSection.ctaUrl}
          className="text-agentvooc-accent hover:underline"
        >
          {subFooterSection.ctaText}
        </a>
        <p className="mt-4 text-sm">{subFooterSection.copyright}</p>
      </div>
    </footer>
  );
}