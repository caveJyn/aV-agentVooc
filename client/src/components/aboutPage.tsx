// /home/kaijin/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/AboutPage.tsx
import React, { useEffect, useState } from "react"; // Explicitly import React
import { Helmet } from "react-helmet-async";
import { apiClient, type CompanyPage } from "@/lib/api";
import { PortableText, PortableTextComponents } from "@portabletext/react";

interface ContentBlock {
  _key: string;
  _type: "block";
  style?: string;
  children?: Array<{
    _key: string;
    _type: string;
    text?: string;
    marks?: string[];
  }>;
  markDefs?: Array<any>;
}

interface ContentImage {
  _key: string;
  _type: "image";
  asset?: {
    url: string;
  };
  alt?: string;
}

type ContentItem = ContentBlock | ContentImage;

const portableTextComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-lg leading-relaxed mb-4">{children}</p>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl font-bold mb-4">{children}</h2>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-agentvooc-accent pl-4 italic text-lg mb-6 text-agentvooc-secondary">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-6 mb-6 text-lg">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-6 mb-6 text-lg">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="mb-2">{children}</li>,
    number: ({ children }) => <li className="mb-2">{children}</li>,
  },
  marks: {
    link: ({ children, value }) => {
      const href = value?.href || "#";
      const isExternal = href.startsWith("http") || href.startsWith("https");
      return (
        <a
          href={href}
          className="text-agentvooc-accent hover:underline"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    code: ({ children }) => (
      <code className="bg-gray-800 text-agentvooc-accent px-1 py-0.5 rounded">
        {children}
      </code>
    ),
  },
};

export default function AboutPage() {
  console.log("[AboutPage] Component mounted");
  const [page, setPage] = useState<CompanyPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const slug = "about"; // Hardcode the slug for this specific page
  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;

  useEffect(() => {
    const fetchPage = async () => {
      try {
        console.log(`[AboutPage] Fetching page for slug: ${slug}`);
        const response = await apiClient.getCompanyPageBySlug(slug);
        console.log("[AboutPage] API response:", response);
        console.log("[AboutPage] Fetched content:", JSON.stringify(response.companyPages.content, null, 2));
        setPage(response.companyPages);
      } catch (err: any) {
        console.error(`[AboutPage] Error fetching page for slug: ${slug}`, err);
        setError(err.message || "Failed to fetch page");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
  }, []);

  // Custom rendering function to group content into sections
  const renderContent = (content: ContentItem[]): React.ReactElement[] => {
    const sections: React.ReactElement[] = [];
    let currentSection: { heading?: ContentBlock; paragraphs: ContentBlock[]; image?: ContentImage } = {
      paragraphs: [],
    };

    content.forEach((item, index) => {
      if (item._type === "block" && item.style === "h2") {
        // Start a new section when an h2 is encountered
        if (currentSection.heading || currentSection.paragraphs.length > 0) {
          // Render the previous section
          sections.push(
            <div key={currentSection.heading?._key || `section-${index}`} className="flex flex-col md:flex-row items-start gap-8 mb-12">
              <div className="flex-1">
                {currentSection.heading && (
                  <PortableText value={[currentSection.heading]} components={portableTextComponents} />
                )}
                {currentSection.paragraphs.map((paragraph) => (
                  <PortableText key={paragraph._key} value={[paragraph]} components={portableTextComponents} />
                ))}
              </div>
              {currentSection.image?.asset?.url && (
                <div className="w-full md:w-1/3">
                  <img
                    src={currentSection.image.asset.url}
                    alt={currentSection.image.alt || "Section image"}
                    className="w-full h-auto rounded-lg shadow-lg object-cover"
                    onError={(e) => {
                      console.error(`[AboutPage] Image failed to load: ${currentSection.image?.asset?.url}`);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  {currentSection.image.alt && (
                    <p className="text-sm text-gray-500 mt-2 italic">{currentSection.image.alt}</p>
                  )}
                </div>
              )}
            </div>
          );
        }
        // Start a new section
        currentSection = { heading: item as ContentBlock, paragraphs: [], image: undefined };
      } else if (item._type === "block" && item.style === "normal") {
        // Add paragraph to the current section
        currentSection.paragraphs.push(item as ContentBlock);
      } else if (item._type === "image") {
        // Add image to the current section
        currentSection.image = item as ContentImage;
      }
    });

    // Render the final section
    if (currentSection.heading || currentSection.paragraphs.length > 0) {
      sections.push(
        <div key={currentSection.heading?._key || "final-section"} className="flex flex-col md:flex-row items-start gap-8 mb-12">
          <div className="flex-1">
            {currentSection.heading && (
              <PortableText value={[currentSection.heading]} components={portableTextComponents} />
            )}
            {currentSection.paragraphs.map((paragraph) => (
              <PortableText key={paragraph._key} value={[paragraph]} components={portableTextComponents} />
            ))}
          </div>
          {currentSection.image?.asset?.url && (
            <div className="w-full md:w-1/3">
              <img
                src={currentSection.image.asset.url}
                alt={currentSection.image.alt || "Section image"}
                className="w-full h-auto rounded-lg shadow-lg object-cover"
                onError={(e) => {
                  console.error(`[AboutPage] Image failed to load: ${currentSection.image?.asset?.url}`);
                  e.currentTarget.style.display = "none";
                }}
              />
              {currentSection.image.alt && (
                <p className="text-sm text-gray-500 mt-2 italic">{currentSection.image.alt}</p>
              )}
            </div>
          )}
        </div>
      );
    }

    return sections;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading page..." />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Error</title>
          <meta name="description" content="An error occurred while fetching the page." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!page || !page.content) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Not Found</title>
          <meta name="description" content="Page not found." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
          <p>The requested page could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>agentVooc | {page.title}</title>
        <meta
          name="description"
          content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`}
        />
        <meta name="keywords" content={`agentVooc, ${page.title.toLowerCase()}, AI automation`} />
        <meta name="robots" content="index, follow" />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <link rel="canonical" href={`${baseUrl}/company/${page.slug}`} />
        <meta property="og:title" content={page.title} />
        <meta
          property="og:description"
          content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`}
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/company/${page.slug}`} />
        <meta property="og:image" content={page.mainImage || defaultImage} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.title} />
        <meta
          name="twitter:description"
          content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`}
        />
        <meta name="twitter:image" content={page.mainImage || defaultImage} />
        <meta name="twitter:site" content="@agentVooc" />
      </Helmet>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-4">{page.title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: {new Date(page.lastUpdated).toLocaleDateString()}
        </p>
        <div className="prose prose-invert max-w-none">
          {renderContent(page.content)}
        </div>
      </div>
    </div>
  );
}