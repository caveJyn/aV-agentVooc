import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { apiClient } from "@/lib/api";
import { PortableText } from "@portabletext/react";

interface CompanyPage {
  title: string;
  slug: string;
  content?: Array<any>;
  lastUpdated: string;
  mainImage?: string;
}

export default function CompanyPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CompanyPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = import.meta.env.SERVER_URL;
  const defaultImage = `${baseUrl}/images/logo.png`; // Replace with your default image URL

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) return;
      try {
        const response = await apiClient.getCompanyPageBySlug(slug);
        setPage(response.companyPages);
      } catch (err: any) {
        console.error(`Error fetching company page for slug: ${slug}`, err);
        setError(err.message || "Failed to fetch company page");
      }
    };

    fetchPage();
  }, [slug]);

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

  if (!page) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading company page..." />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>agentVooc | {page.title}</title>
        <meta name="description" content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`} />
        <meta name="keywords" content={`agentVooc, ${page.title.toLowerCase()}, AI automation`} />
        <meta name="robots" content="index, follow" />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <link rel="canonical" href={`${baseUrl}/company/${page.slug}`} />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/company/${page.slug}`} />
        <meta property="og:image" content={page.mainImage || defaultImage} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={`Learn more about ${page.title.toLowerCase()} at agentVooc, your AI automation platform.`} />
        <meta name="twitter:image" content={page.mainImage || defaultImage} />
        <meta name="twitter:site" content="@agentVooc" />
      </Helmet>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-4">{page.title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: {new Date(page.lastUpdated).toLocaleDateString()}
        </p>
        <div className="prose prose-invert">
          <PortableText value={page.content} />
        </div>
      </div>
    </div>
  );
}