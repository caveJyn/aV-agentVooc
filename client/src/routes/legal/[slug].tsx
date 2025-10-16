import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { apiClient } from "@/lib/api";
import { PortableText } from "@portabletext/react";

interface LegalDocument {
  title: string;
  slug: string;
  content?: Array<any>;
  lastUpdated: string;
}

export default function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [document, setDocument] = useState<LegalDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = import.meta.env.SERVER_URL;
  const defaultImage = `${baseUrl}/images/logo.png`; // Replace with your default image URL

  useEffect(() => {
    const fetchDocument = async () => {
      if (!slug) return;
      try {
        const response = await apiClient.getLegalDocumentBySlug(slug);
        setDocument(response.legalDocuments);
      } catch (err: any) {
        console.error(`Error fetching legal document for slug: ${slug}`, err);
        setError(err.message || "Failed to fetch legal document");
      }
    };

    fetchDocument();
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Error</title>
          <meta name="description" content="An error occurred while fetching the legal document." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading legal document..." />
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
        <title>agentVooc | {document.title}</title>
        <meta name="description" content={`Read the ${document.title.toLowerCase()} for agentVooc, your AI automation platform.`} />
        <meta name="keywords" content={`agentVooc, ${document.title.toLowerCase()}, AI automation, legal`} />
        <meta name="robots" content="index, follow" />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <link rel="canonical" href={`${baseUrl}/legal/${document.slug}`} />
        <meta property="og:title" content={document.title} />
        <meta property="og:description" content={`Read the ${document.title.toLowerCase()} for agentVooc, your AI automation platform.`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/legal/${document.slug}`} />
        <meta property="og:image" content={defaultImage} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={document.title} />
        <meta name="twitter:description" content={`Read the ${document.title.toLowerCase()} for agentVooc, your AI automation platform.`} />
        <meta name="twitter:image" content={defaultImage} />
        <meta name="twitter:site" content="@agentVooc" />
      </Helmet>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-4">{document.title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: {new Date(document.lastUpdated).toLocaleDateString()}
        </p>
        <div className="prose prose-invert">
          <PortableText value={document.content} />
        </div>
      </div>
    </div>
  );
}