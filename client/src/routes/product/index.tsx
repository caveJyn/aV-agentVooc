import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { apiClient, type ProductPage } from "@/lib/api";
import { Card } from "@/components/ui/card";

interface StarPosition {
  top: string;
  left: string;
  width: string;
  height: string;
  animationDelay: string;
  animationDuration: string;
}

export default function ProductListPage() {
  const [pages, setPages] = useState<ProductPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [starPositions, setStarPositions] = useState<StarPosition[]>([]);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  useEffect(() => {
      const fetchPages = async () => {
        try {
          setIsLoading(true);
          const response = await apiClient.getProductPages();
          // console.log("[BlogList] Fetched posts:", JSON.stringify(response.productPages, null, 2));
          setPages(response.productPages as ProductPage[]);
        } catch (err: any) {
          console.error("[BlogList] Error fetching blog posts:", err);
          setError(err.message || "Failed to fetch blog posts");
        } finally {
          setIsLoading(false);
        }
      };
  

    const positions = [...Array(20)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 4 + 2}px`,
      height: `${Math.random() * 4 + 2}px`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${Math.random() * 3 + 2}s`,
    }));
    setStarPositions(positions);

    fetchPages();
  }, []);

  // Structured data for ItemList
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "agentVooc Products",
    description: pages.length > 0 ? pages[0].seoDescription : "Explore agentVooc's AI-powered products for automation and innovation.",
    url: `${baseUrl}/product`,
    itemListElement: pages.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "WebPage",
        name: page.title,
        url: `${baseUrl}/product/${page.slug}`,
        datePublished: page.publishedAt,
        dateModified: page.modifiedAt || page.publishedAt,
        description: page.seoDescription,
        image: {
          "@type": "ImageObject",
          url: page.mainImage || defaultImage,
          description: page.mainImageAlt || defaultImageAlt,
        },
        author: {
          "@type": "Organization",
          name: "agentVooc",
        },
        publisher: {
          "@type": "Organization",
          name: "agentVooc",
          logo: {
            "@type": "ImageObject",
            url: defaultImage,
            description: defaultImageAlt,
          },
        },
        keywords: page.tags?.join(", ") || "",
      },
    })),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading product pages..." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>Products | agentVooc</title>
          <meta name="description" content="An error occurred while fetching the product pages." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/product`} />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4 text-white">Products</h1>
          <p>{error}</p>
          <Link to="/product" className="text-agentvooc-accent hover:underline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen relative overflow-hidden bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg">
      <Helmet>
        <title>agentVooc | Products</title>
        <meta
          name="description"
          content={
            pages.length > 0
              ? pages[0].seoDescription
              : "Explore agentVooc's AI-powered products for automation and innovation."
          }
        />
        <meta name="keywords" content={pages[0]?.tags?.join(", ") || "AI automation, agentVooc, products, technology"} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/product`} />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <meta property="og:title" content="Products | agentVooc" />
        <meta
          property="og:description"
          content={
            pages.length > 0
              ? pages[0].seoDescription
              : "Explore agentVooc's AI-powered products for automation and innovation."
          }
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/product`} />
        <meta property="og:image" content={pages[0]?.mainImage || defaultImage} />
        <meta property="og:image:alt" content={pages[0]?.mainImageAlt || defaultImageAlt} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Products | agentVooc" />
        <meta
          name="twitter:description"
          content={
            pages.length > 0
              ? pages[0].seoDescription
              : "Explore agentVooc's AI-powered products for automation and innovation."
          }
        />
        <meta name="twitter:image" content={pages[0]?.mainImage || defaultImage} />
        <meta name="twitter:image:alt" content={pages[0]?.mainImageAlt || defaultImageAlt} />
        <meta name="twitter:site" content="@agentVooc" />
        <script type="application/ld+json">{JSON.stringify(productSchema)}</script>
      </Helmet>
      <div className="absolute inset-0 bg-gradient-to-br from-agentvooc-secondary-bg via-agentvooc-primary-bg to-agentvooc-secondary-accent">
        <div className="absolute inset-0 bg-black/60" />
      </div>
      <div className="absolute -top-40 -right-32 opacity-5 pointer-events-none z-0">
        <div className="w-96 h-96 bg-agentvooc-accent rounded-full blur-3xl animate-pulse" />
      </div>
      <div className="absolute inset-0 pointer-events-none z-5">
        {starPositions.map((position, index) => (
          <div
            key={index}
            className="absolute bg-agentvooc-stars rounded-full animate-star-sequence"
            style={{
              width: position.width,
              height: position.height,
              top: position.top,
              left: position.left,
              animationDelay: position.animationDelay,
              animationDuration: position.animationDuration,
            }}
          />
        ))}
      </div>
      <div className="relative z-10 w-full max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8 text-white">Products</h1>
        {pages.length === 0 ? (
          <div className="text-white">
            <p>No product pages available yet. Check back soon for AI-powered automation solutions!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pages.map((page) => (
              <Card key={page.slug} className="bg-agentvooc-primary-bg border-agentvooc-border">
                <Link
                  to={`/product/${page.slug}`} // Fixed from /company/products
                  className="group block p-6"
                  aria-label={`View product: ${page.title}`}
                >
                  {page.thumbnailImage && (
                    <img
                      src={`${page.thumbnailImage}?w=300&h=200&auto=format&q=80`}
                      alt={page.mainImageAlt || page.title}
                      loading="lazy"
                      className="w-full h-48 object-cover rounded-t-lg mb-4 hidden md:block"
                      onError={(e) => {
                        // console.error("[ProductList] Thumbnail image failed to load:", page.thumbnailImage);
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <h2 className="text-xl font-semibold mb-2">
                    <span className="transition duration-300 ease-in-out group-hover:bg-agentvooc-accent group-active:bg-agentvooc-accent group-hover:text-black group-active:text-black px-2 py-1 rounded-md group-hover:shadow-md">
                      {page.title}
                    </span>
                  </h2>
                  <p className="text-sm text-gray-300 mb-4 px-2">
                    Published: {new Date(page.publishedAt).toLocaleDateString()}
                  </p>
                  <p className="px-2">{page.excerpt}</p>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}