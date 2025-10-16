import { createContext, useContext, useEffect, useState } from "react";
import { apiClient, LegalDocument, CompanyPage, ProductPage } from "@/lib/api";

interface FooterSection {
  tagline: string;
  companyLinks: Array<{ label: string; url: string }>;
  productLinks: Array<{ label: string; url: string }>;
  legalLinks: Array<{ label: string; url: string }>;
  socialLinks: Array<{ platform: string; url: string }>;
}

interface SubFooterSection {
  ctaText: string;
  ctaUrl: string;
  copyright: string;
}

const fallbackFooterSection: FooterSection = {
  tagline: "Empowering the future with AI automation.",
  companyLinks: [
    { label: "About", url: "/company/about" },
    { label: "Blog", url: "/company/blog" },
    { label: "Press", url: "/company/press" },
  ],
  productLinks: [
    { label: "Pricing", url: "/product/pricing" },
  ],
  legalLinks: [
    { label: "Privacy Policy", url: "/legal/privacy" },
    { label: "Terms of Service", url: "/legal/terms" },
    { label: "DMCA Policy", url: "/legal/dmca" },
    { label: "Trademark Guidelines", url: "/legal/trademark" },
    { label: "Content Moderation Policy", url: "/legal/content-moderation" },
    { label: "Payment Policies", url: "/legal/payment-policies" },
  ],
  socialLinks: [
    { platform: "twitter", url: "https://twitter.com/agentVooc" },
    { platform: "facebook", url: "https://facebook.com/agentVooc" },
    { platform: "whatsapp", url: "https://wa.me/1234567890" },
    { platform: "github", url: "https://github.com/agentVooc" },
  ],
};

const fallbackSubFooterSection: SubFooterSection = {
  ctaText: "Still Not Sure?",
  ctaUrl: "/demo",
  copyright: `© ${new Date().getFullYear()} agentVooc. All rights reserved.`,
};

interface FooterContextType {
  footerSection: FooterSection;
  subFooterSection: SubFooterSection;
}

const FooterContext = createContext<FooterContextType>({
  footerSection: fallbackFooterSection,
  subFooterSection: fallbackSubFooterSection,
});

export function FooterProvider({ children }: { children: React.ReactNode }) {
  const [footerSection, setFooterSection] = useState<FooterSection>(fallbackFooterSection);
  const [subFooterSection, setSubFooterSection] = useState<SubFooterSection>(fallbackSubFooterSection);

  useEffect(() => {
    const fetchFooterData = async () => {
      try {
        const [
          landingResponse,
          legalResponse,
          companyResponse,
          productResponse,
          blogResponse,
          pressResponse,
          docsResponse,
        ] = await Promise.all([
          apiClient.getLandingPage(),
          apiClient.getLegalDocuments(),
          apiClient.getCompanyPages(),
          apiClient.getProductPages(),
          apiClient.getBlogPosts(),
          apiClient.getPressPosts(),
          apiClient.getDocs(),
        ]);

        // console.log("[FooterProvider] Company Pages:", companyResponse);

        const landingFooter = landingResponse.landingPage.footerSection || fallbackFooterSection;
        const landingSubFooter = landingResponse.landingPage.subFooterSection || fallbackSubFooterSection;

        const legalLinks = legalResponse.legalDocuments.map((doc: LegalDocument) => ({
          label: doc.title,
          url: `/legal/${doc.slug}`,
        }));

        const companyPages = Array.isArray(companyResponse.companyPages)
          ? companyResponse.companyPages
          : [companyResponse.companyPages];
        const companyLinks = companyPages
          .filter((page: CompanyPage) => page && page.slug && page.title)
          .map((page: CompanyPage) => ({
            label: page.title,
            url: `/company/${page.slug}`,
          }));

        const blogPosts = Array.isArray(blogResponse.blogPosts)
          ? blogResponse.blogPosts
          : [blogResponse.blogPosts];
        const blogLinks = blogPosts.length > 0 ? [{ label: "Blog", url: "/company/blog" }] : [];

        const pressPosts = Array.isArray(pressResponse.pressPosts)
          ? pressResponse.pressPosts
          : [pressResponse.pressPosts];
        const pressLinks = pressPosts.length > 0 ? [{ label: "Press", url: "/company/press" }] : [];

        const docs = Array.isArray(docsResponse.docs)
          ? docsResponse.docs
          : [docsResponse.docs];
        const docsLinks = docs.length > 0 ? [{ label: "Documentation", url: "/company/docs" }] : [];

        const productPages = Array.isArray(productResponse.productPages)
          ? productResponse.productPages
          : [productResponse.productPages];
        const productLinks = productPages.map((page: ProductPage) => ({
          label: page.title,
          url: `/product/${page.slug}`,
        }));

        const updatedFooterSection = {
          tagline: landingFooter.tagline || fallbackFooterSection.tagline,
          companyLinks: [...companyLinks, ...blogLinks, ...pressLinks, ...docsLinks],
          productLinks:
            productLinks.length > 0 ? productLinks : landingFooter.productLinks || fallbackFooterSection.productLinks,
          legalLinks: legalLinks.length > 0 ? legalLinks : landingFooter.legalLinks || fallbackFooterSection.legalLinks,
          socialLinks: landingFooter.socialLinks || fallbackFooterSection.socialLinks,
        };

        setFooterSection(updatedFooterSection);
        setSubFooterSection(landingSubFooter);

        const cacheData = { footerSection: updatedFooterSection, subFooterSection: landingSubFooter };
        localStorage.setItem("footerData", JSON.stringify(cacheData));
        localStorage.setItem("footerDataUpdatedAt", landingResponse.landingPage._updatedAt || Date.now().toString());
        localStorage.setItem("footerDataCacheTime", Date.now().toString());
        // console.log("[FooterProvider] Fetched and cached footer data");
      } catch (err) {
        console.error("[FooterProvider] Error fetching footer data:", err);
        setFooterSection(fallbackFooterSection);
        setSubFooterSection(fallbackSubFooterSection);
        // console.log("[FooterProvider] Fallback to default footer data due to error");
      }
    };
    fetchFooterData();
  }, []);

  return (
    <FooterContext.Provider value={{ footerSection, subFooterSection }}>
      {children}
    </FooterContext.Provider>
  );
}

export function useFooter() {
  return useContext(FooterContext);
}