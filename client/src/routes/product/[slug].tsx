import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { apiClient, type ProductPage } from "@/lib/api";
import { PortableText, PortableTextComponents } from "@portabletext/react";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<ProductPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) {
        console.error("[ProductPage] No slug provided");
        setError("No slug provided");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await apiClient.getProductPageBySlug(slug);
        console.log("[ProductPage] Fetched page:", JSON.stringify(response.productPages, null, 2));
        setPage(response.productPages);
      } catch (err: any) {
        console.error(`[ProductPage] Error fetching product page for slug: ${slug}`, err);
        setError(err.message || "Failed to fetch product page");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Custom PortableText components for SEO
  const portableTextComponents: PortableTextComponents = {
    block: {
      h1: ({ children }) => <h1 className="text-3xl font-bold mb-4">{children}</h1>,
      h2: ({ children }) => <h2 className="text-2xl font-semibold mb-3">{children}</h2>,
      h3: ({ children }) => <h3 className="text-xl font-semibold mb-2">{children}</h3>,
      normal: ({ children }) => <p className="mb-4 ">{children}</p>,
    },
    types: {
      image: ({ value }) => {
        if (!value?.asset?.url) {
          console.error("[PortableText] Image asset URL is missing:", JSON.stringify(value, null, 2));
          return null;
        }
        return (
          <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg my-4">
            <img
              src={value.asset.url} // Use pre-formatted URL from endpoint
              alt={value.alt || "Product page image"}
              loading="lazy"
              className="w-full h-auto rounded-lg"
              onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
              onError={(e) => {
                console.error("[PortableText] Image failed to load:", value.asset.url);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        );
      },
    },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading product page..." />
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
          <title>agentVooc | Error</title>
          <meta name="description" content="An error occurred while fetching the product page." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/product`} />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p>{error}</p>
          <Link to="/product" className=" hover:underline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  // Structured data for WebPage
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.seoDescription,
    datePublished: page.publishedAt,
    dateModified: page.modifiedAt || page.publishedAt,
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
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/product/${page.slug}`,
    },
    keywords: page.tags?.join(", ") || "",
    relatedLink: page.relatedContent?.map((item) => ({
      "@type": item._type === "blogPost" ? "BlogPosting" : item._type === "pressPost" ? "NewsArticle" : "WebPage",
      url: `${baseUrl}/${
        item._type === "blogPost" ? "company/blog" : item._type === "pressPost" ? "company/press" : "product"
      }/${item.slug}`,
      name: item.title,
      image: {
        "@type": "ImageObject",
        url: item.mainImage || defaultImage,
        description: item.mainImageAlt || defaultImageAlt,
      },
    })) || [],
  };

  console.log("[ProductPage] Rendering page with images:", {
    mainImage: page.mainImage,
    heroImage: page.heroImage,
    galleryImages: page.galleryImages,
    contentImages: page.content?.filter((block) => block._type === "image").map((block) => block.asset?.url),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>agentVooc | {page.title}</title>
        <meta name="description" content={page.seoDescription} />
        <meta name="keywords" content={page.tags?.join(", ") || "AI automation, agentVooc, products, technology"} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/product/${page.slug}`} />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <meta property="og:title" content={`${page.title} | agentVooc`} />
        <meta property="og:description" content={page.seoDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/product/${page.slug}`} />
        <meta property="og:image" content={page.mainImage || defaultImage} />
        <meta property="og:image:alt" content={page.mainImageAlt || defaultImageAlt} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${page.title} | agentVooc`} />
        <meta name="twitter:description" content={page.seoDescription} />
        <meta name="twitter:image" content={page.mainImage || defaultImage} />
        <meta name="twitter:image:alt" content={page.mainImageAlt || defaultImageAlt} />
        <meta name="twitter:site" content="@agentVooc" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <div className="max-w-3xl mx-auto py-12 px-4">
        {page.heroImage && (
          <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg mb-8">
            <img
              src={page.heroImage} // Use pre-formatted URL
              alt={page.heroImageAlt || page.title}
              loading="lazy"
              className="w-full h-auto rounded-lg"
              onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
              onError={(e) => {
                console.error("[ProductPage] Hero image failed to load:", page.heroImage);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        {page.mainImage && (
          <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg mb-8">
            <img
              src={page.mainImage} // Use pre-formatted URL
              alt={page.mainImageAlt || page.title}
              loading="lazy"
              className="w-full h-auto rounded-lg"
              onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
              onError={(e) => {
                console.error("[ProductPage] Main image failed to load:", page.mainImage);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        <h1 className="text-3xl font-bold mb-4">{page.title}</h1>
        <p className="text-sm  mb-8">
          Published: {new Date(page.publishedAt).toLocaleDateString()}
          {page.modifiedAt && page.modifiedAt !== page.publishedAt && (
            <> | Updated: {new Date(page.modifiedAt).toLocaleDateString()}</>
          )}
        </p>
        <div className="prose prose-invert max-w-none">
          {page.content ? (
            <PortableText value={page.content} components={portableTextComponents} />
          ) : (
            <p className="">No content available</p>
          )}
        </div>
        {page.galleryImages && page.galleryImages.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {page.galleryImages.map((image, index) => (
                <div key={index} className="w-full h-64 bg-gray-200 animate-pulse rounded-lg">
                  <img
                    src={image.url} // Use pre-formatted URL
                    alt={image.alt || page.title}
                    loading="lazy"
                    className="w-full h-auto rounded-lg"
                    onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                    onError={(e) => {
                      console.error("[ProductPage] Gallery image failed to load:", image.url);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {page.relatedContent && page.relatedContent.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4">Related Content</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {page.relatedContent.slice(0, 3).map((item) => (
                <Link
                  key={`${item._type}-${item.slug}`}
                  to={`/company/${item._type === "blogPost" ? "blog" : item._type === "pressPost" ? "press" : "product"}/${item.slug}`}
                  className="block p-4 bg-agentvooc-primary-bg rounded-lg border border-agentvooc-border hover:bg-agentvooc-accent hover:text-black hover:shadow-lg transition-all duration-300"
                  aria-label={`View ${item._type === "blogPost" ? "blog post" : item._type === "pressPost" ? "press release" : "product"}: ${item.title}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {item.mainImage && (
                    <div className="w-full h-32 bg-gray-200 animate-pulse rounded-t-lg mb-2">
                      <img
                        src={item.mainImage} // Use pre-formatted URL
                        alt={item.mainImageAlt || item.title}
                        loading="lazy"
                        className="w-full h-32 object-cover rounded-t-lg"
                        onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                        onError={(e) => {
                          console.error("[ProductPage] Related content image failed to load:", item.mainImage);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  {item.excerpt && (
                    <p className="text-sm  mb-2 line-clamp-2">{item.excerpt}</p>
                  )}
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-agentvooc-accent rounded-full">
                    {item._type === "blogPost" ? "Blog Post" : item._type === "pressPost" ? "Press Release" : "Product"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}