import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { apiClient, type Docs } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function DocsList() {
  const [docs, setDocs] = useState<Docs[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  // Function to sort docs by sortOrder, with fallback to title
  const sortDocs = (docsArray: Docs[]): Docs[] => {
    return [...docsArray].sort((a, b) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      // Fallback to title if sortOrder is the same or undefined
      return (a.title || "").localeCompare(b.title || "");
    });
  };

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getDocs();
        console.log("[DocsList] Fetched docs:", JSON.stringify(response.docs, null, 2));
        // Sort docs before setting state
        setDocs(sortDocs(response.docs as Docs[]));
      } catch (err: any) {
        console.error("[DocsList] Error fetching docs:", err);
        setError(err.message || "Failed to fetch documentation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocs();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Documentation</title>
          <meta name="description" content="Explore agentVooc's documentation for AI automation and platform usage." />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={`${baseUrl}/company/docs`} />
        </Helmet>
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Error</title>
          <meta name="description" content="An error occurred while fetching documentation." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/company/docs`} />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>agentVooc | Documentation</title>
        <meta name="description" content="Explore agentVooc's documentation for AI automation and platform usage." />
        <meta name="keywords" content="AI automation, agentVooc, documentation, technology" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/company/docs`} />
        <meta property="og:title" content="agentVooc Documentation" />
        <meta property="og:description" content="Explore agentVooc's documentation for AI automation and platform usage." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/company/docs`} />
        <meta property="og:image" content={defaultImage} />
        <meta property="og:image:alt" content={defaultImageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="agentVooc Documentation" />
        <meta name="twitter:description" content="Explore agentVooc's documentation for AI automation and platform usage." />
        <meta name="twitter:image" content={defaultImage} />
        <meta name="twitter:image:alt" content={defaultImageAlt} />
      </Helmet>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Documentation</h1>
        {docs.length === 0 ? (
          <p>No documentation available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {docs.map((doc) => (
              <Card
                key={doc.slug}
                onMouseEnter={() => setHoveredCard(doc.slug)}
                onMouseLeave={() => setHoveredCard(null)}
                className="transition-all duration-200 hover:shadow-lg"
              >
                <Link
                  to={`/company/docs/${doc.slug}`}
                  className="block p-4"
                  aria-label={`Read documentation: ${doc.title}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {doc.mainImage && (
                    <div className="w-full h-32 rounded-t-lg mb-2">
                      <img
                        src={doc.mainImage}
                        alt={doc.mainImageAlt || doc.title}
                        loading="lazy"
                        className="w-full h-32 object-cover rounded-t-lg"
                        onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                        onError={(e) => {
                          console.error("[DocsList] Thumbnail image failed to load:", doc.mainImage);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  {hoveredCard === doc.slug ? (
                    <div className="text-lg font-semibold mb-2 footer-link inline-block">
                      {doc.title}
                    </div>
                  ) : (
                    <h2 className="text-lg font-semibold mb-2">{doc.title}</h2>
                  )}
                  <p className="text-sm mb-2 line-clamp-2">{doc.excerpt}</p>
                  <p className="text-sm">
                    Published: {new Date(doc.publishedAt).toLocaleDateString()}
                  </p>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}