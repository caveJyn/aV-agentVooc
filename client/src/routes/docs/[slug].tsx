// /home/kaijin/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/routes/docs/[slug].tsx
import { useEffect, useState, useRef, useMemo, memo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2, Clock, Calendar, Menu, X } from "lucide-react";
import { apiClient, type Docs } from "@/lib/api";
import { PortableText, PortableTextComponents } from "@portabletext/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Define props for DocImage
interface DocImageProps {
  src: string;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

const DocImage = memo(
  ({ src, alt, className, onError, onLoad }: DocImageProps) => {
    return (
      <div className="rounded-xl overflow-hidden shadow-lg mb-6">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={className || "w-full h-auto"}
          onLoad={onLoad}
          onError={onError}
        />
      </div>
    );
  },
  (prevProps: DocImageProps, nextProps: DocImageProps) =>
    prevProps.src === nextProps.src &&
    prevProps.alt === nextProps.alt &&
    prevProps.className === nextProps.className
);

// Define TOC item interface
interface TocItem {
  id: string;
  text: string;
  style: string;
}

// MobileTOC Component
const MobileTOC = memo(
  ({
    tocItems,
    isOpen,
    onToggle,
    onItemClick,
  }: {
    tocItems: (TocItem & { isActive: boolean })[];
    isOpen: boolean;
    onToggle: () => void;
    onItemClick: (id: string) => void;
  }) => (
    <div className="mb-8">
      <Button
        variant="outline"
        className="flex items-center justify-between w-full p-4 rounded-lg border-2 transition-all duration-200"
        onClick={onToggle}
        aria-label={isOpen ? "Hide Table of Contents" : "Show Table of Contents"}
      >
        <span className="font-medium">Table of Contents</span>
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>
      {isOpen && (
        <div className="mt-4 rounded-lg border border-agentvooc-border overflow-hidden">
          <ul className="py-4 max-h-[50vh] overflow-y-auto">
            {tocItems.map((item) => (
              <li
                key={item.id}
                className={`px-6 py-2 cursor-pointer transition-all duration-200 hover:bg-white hover:bg-opacity-5 border-l-4 ${
                  item.isActive
                    ? "border-l-white bg-white bg-opacity-10"
                    : "border-l-transparent"
                } ${
                  item.style === "h1"
                    ? "ml-0 text-base font-semibold"
                    : item.style === "h2"
                    ? "ml-4 text-base"
                    : item.style === "h3"
                    ? "ml-8 text-sm"
                    : "ml-12 text-sm"
                }`}
                onClick={() => onItemClick(item.id)}
                aria-current={item.isActive ? "true" : undefined}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
);

export default function DocPage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [doc, setDoc] = useState<Docs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const isInitialRender = useRef(true);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  // Detect narrow viewport (e.g., <1024px) to determine TOC rendering
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    typeof window !== "undefined" && window.innerWidth < 1024
  );

  useEffect(() => {
    const handleResize = () => {
      setIsNarrowViewport(window.innerWidth < 1024);
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Generate TOC for the current document
  const tocItems = useMemo(() => {
    if (!doc?.content) return [];

    return doc.content
      .filter(
        (block): block is {
          _type: "block";
          _key: string;
          style: string;
          children: { _key: string; _type: string; text?: string; marks?: string[] }[];
        } =>
          block._type === "block" &&
          block.style != null &&
          ["h1", "h2", "h3", "h4", "h5", "h6"].includes(block.style) &&
          Array.isArray(block.children)
      )
      .map((block) => {
        const text = block.children
          .filter((child) => child._type === "span" && child.text)
          .map((child) => child.text || "")
          .join("");
        return {
          id: block._key,
          text: text || "Untitled Heading",
          style: block.style,
        };
      });
  }, [doc]);

  // TOC items with active state
  const tocItemsWithActive = useMemo(
    () =>
      tocItems.map((item) => ({
        ...item,
        isActive: item.id === activeHeadingId,
      })),
    [tocItems, activeHeadingId]
  );

  // Fetch document
  useEffect(() => {
    const fetchDoc = async () => {
      if (!slug) {
        console.error("[DocPage] No slug provided");
        setError("No slug provided");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await apiClient.getDocBySlug(slug);
        if (isInitialRender.current) {
          console.log("[DocPage] Fetched doc:", JSON.stringify(response.docs, null, 2));
          isInitialRender.current = false;
        }
        if (Array.isArray(response.docs)) {
          console.error(`[DocPage] Expected single Doc, got array for slug: ${slug}`);
          setError("Invalid response format");
          return;
        }
        setDoc(response.docs as Docs);
      } catch (err: unknown) {
        console.error(`[DocPage] Error fetching doc for slug: ${slug}`, err);
        setError(err instanceof Error ? err.message : "Failed to fetch documentation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDoc();
  }, [slug]);

  // Handle initial hash-based scrolling
  useEffect(() => {
    if (location.hash && doc) {
      const id = location.hash.replace("#", "");
      setActiveHeadingId(id);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        window.scrollBy(0, -96);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash, doc]);

  // Set up IntersectionObserver to track visible headings
  useEffect(() => {
    if (!tocItems.length || !doc) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            setActiveHeadingId(id);
            window.history.replaceState(null, "", `#${id}`);
          }
        });
      },
      {
        rootMargin: "-96px 0px -50% 0px",
        threshold: 0.1,
      }
    );

    tocItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [tocItems, doc]);

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollBy(0, -96);
      setActiveHeadingId(id);
      setIsTocOpen(false);
    }
  };

  const portableTextComponents: PortableTextComponents = useMemo(
  () => ({
    block: {
      h1: ({ children, value }) => (
        <h1
          id={value._key}
          className="text-4xl font-bold mb-8 mt-12 first:mt-0  leading-tight"
        >
          {children}
        </h1>
      ),
      h2: ({ children, value }) => (
        <h2
          id={value._key}
          className="text-3xl font-bold mb-6 mt-10  leading-snug"
        >
          {children}
        </h2>
      ),
      h3: ({ children, value }) => (
        <h3
          id={value._key}
          className="text-2xl font-semibold mb-4 mt-8  leading-snug"
        >
          {children}
        </h3>
      ),
      h4: ({ children, value }) => (
        <h4
          id={value._key}
          className="text-xl font-semibold mb-3 mt-6 "
        >
          {children}
        </h4>
      ),
      h5: ({ children, value }) => (
        <h5
          id={value._key}
          className="text-lg font-semibold mb-3 mt-5 "
        >
          {children}
        </h5>
      ),
      h6: ({ children, value }) => (
        <h6
          id={value._key}
          className="text-base font-semibold mb-2 mt-4 "
        >
          {children}
        </h6>
      ),
      normal: ({ children }) => (
        <p className="mb-6 leading-relaxed text-lg">{children}</p>
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
      bullet: ({ children }) => (
        <li className="mb-2">{children}</li>
      ),
      number: ({ children }) => (
        <li className="mb-2">{children}</li>
      ),
    },
    types: {
      image: ({ value }) => {
        if (!value?.asset?.url) {
          console.error(
            "[PortableText] Image asset URL is missing:",
            JSON.stringify(value, null, 2)
          );
          return null;
        }
        return (
          <div className="my-8">
            <DocImage
              src={value.asset.url}
              alt={value.alt || "Documentation image"}
              onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
                (e.currentTarget.parentElement!.style.background = "none")
              }
              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                console.error(
                  "[PortableText] Image failed to load:",
                  value.asset.url
                );
                e.currentTarget.style.display = "none";
              }}
            />
            {value.alt && (
              <p className="text-center text-sm opacity-75 mt-2 italic">
                {value.alt}
              </p>
            )}
          </div>
        );
      },
    },
    marks: {
      link: ({ children, value }) => {
        // Ensure href exists and is valid
        const href = value?.href || "#";
        const isExternal = href.startsWith("http") || href.startsWith("https");

        return (
          <a
            href={href}
            className="text-agentvooc-accent hover:underline transition-colors duration-200"
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
            aria-label={typeof children === "string" ? children : "Link"}
          >
            {children}
          </a>
        );
      },
      // Optional: Handle other marks like strong, em, etc.
      strong: ({ children }) => (
        <strong className="font-bold">{children}</strong>
      ),
      em: ({ children }) => <em className="italic">{children}</em>,
      code: ({ children }) => (
        <code className="bg-gray-800 text-agentvooc-accent px-1 py-0.5 rounded">
          {children}
        </code>
      ),
    },
  }),
  []
);

  const structuredData = useMemo(() => {
    if (!doc) return null;

    return {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: doc.title,
      description: doc.seoDescription,
      datePublished: doc.publishedAt,
      dateModified: doc.modifiedAt || doc.publishedAt,
      image: {
        "@type": "ImageObject",
        url: doc.mainImage || defaultImage,
        description: doc.mainImageAlt || defaultImageAlt,
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
        "@id": `${baseUrl}/company/docs/${doc.slug}`,
      },
      keywords: doc.tags?.join(", ") || "",
      relatedLink:
        doc.relatedContent?.map((item) => ({
          "@type":
            item._type === "doc"
              ? "TechArticle"
              : item._type === "blogPost"
              ? "BlogPosting"
              : "WebPage",
          url: `${baseUrl}/company/${
            item._type === "doc"
              ? "docs"
              : item._type === "blogPost"
              ? "blog"
              : "products"
          }/${item.slug}`,
          headline: item.title,
          image: {
            "@type": "ImageObject",
            url: item.mainImage || defaultImage,
            description: item.mainImageAlt || defaultImageAlt,
          },
        })) || [],
    };
  }, [doc, baseUrl, defaultImage, defaultImageAlt]);

  useEffect(() => {
    if (doc && !isInitialRender.current) {
      console.log("[DocPage] Rendering doc with images:", {
        mainImage: doc.mainImage,
        heroImage: doc.heroImage,
        contentImages: doc.content
          ?.filter((block) => block._type === "image")
          .map((block) =>
            block._type === "image" && block.asset ? block.asset.url : null
          )
          .filter((url): url is string => url !== null),
      });
    }
  }, [doc]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg  flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading documentation..." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg opacity-75">Loading documentation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg ">
        <Helmet>
          <title>agentVooc | Error</title>
          <meta
            name="description"
            content="An error occurred while fetching the documentation."
          />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/company/docs`} />
        </Helmet>
        <div className="max-w-4xl mx-auto py-12 px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Oops! Something went wrong</h1>
            <p className="text-lg mb-6 opacity-75">{error}</p>
            <Link
              to="/company/docs"
              className="inline-flex items-center px-6 py-3 rounded-lg border border-agentvooc-border hover:bg-white hover:bg-opacity-10 transition-all duration-200"
            >
              ← Back to Documentation
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!doc) {
    return null;
  }

  // Render MobileTOC when viewport is narrow or on mobile
  const useMobileTOC = isMobile || isNarrowViewport;

  return (
  <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg">
    <Helmet>
      <title>{doc.title} | agentVooc</title>
      <meta name="description" content={doc.seoDescription} />
      <meta
        name="keywords"
        content={
          doc.tags?.join(", ") || "AI automation, agentVooc, documentation, technology"
        }
      />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={`${baseUrl}/company/docs/${doc.slug}`} />
      <link
        rel="sitemap"
        href={`${baseUrl}/sitemap.xml`}
        type="application/xml"
      />
      <meta property="og:title" content={`${doc.title} | agentVooc`} />
      <meta property="og:description" content={doc.seoDescription} />
      <meta property="og:type" content="article" />
      <meta property="og:url" content={`${baseUrl}/company/docs/${doc.slug}`} />
      <meta property="og:image" content={doc.mainImage || defaultImage} />
      <meta
        property="og:image:alt"
        content={doc.mainImageAlt || defaultImageAlt}
      />
      <meta property="og:site_name" content="agentVooc" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`${doc.title} | agentVooc`} />
      <meta name="twitter:description" content={doc.seoDescription} />
      <meta name="twitter:image" content={doc.mainImage || defaultImage} />
      <meta
        name="twitter:image:alt"
        content={doc.mainImageAlt || defaultImageAlt}
      />
      <meta name="twitter:site" content="@agentVooc" />
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>

    <Card className="py-12 px-6">
      {/* Flex container for main content and TOC */}
      <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
        <div className="flex gap-8">
          <main className={`flex-1 ${isNarrowViewport && !isMobile ? "max-w-2xl" : "max-w-4xl"}`}>
            {useMobileTOC && tocItems.length > 0 && (
              <MobileTOC
                tocItems={tocItemsWithActive}
                isOpen={isTocOpen}
                onToggle={() => setIsTocOpen(!isTocOpen)}
                onItemClick={handleTocClick}
              />
            )}
            {doc.heroImage && (
              <div className="rounded-lg mb-8">
                <DocImage
                  src={doc.heroImage}
                  alt={doc.heroImageAlt || doc.title}
                  onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
                    (e.currentTarget.parentElement!.style.background = "none")
                  }
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    if (doc.heroImage) {
                      console.error(
                        "[DocPage] Hero image failed to load:",
                        doc.heroImage
                      );
                    }
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            {doc.mainImage && (
              <div className="rounded-lg mb-8">
                <DocImage
                  src={doc.mainImage}
                  alt={doc.mainImageAlt || doc.title}
                  onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
                    (e.currentTarget.parentElement!.style.background = "none")
                  }
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    if (doc.mainImage) {
                      console.error(
                        "[DocPage] Main image failed to load:",
                        doc.mainImage
                      );
                    }
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}

            <header className="mb-10">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {doc.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm opacity-75 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Published{" "}
                    {new Date(doc.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {doc.modifiedAt && doc.modifiedAt !== doc.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>
                      Updated{" "}
                      {new Date(doc.modifiedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {doc.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-xs font-medium rounded-full border border-agentvooc-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            <div className="prose prose-lg prose-invert max-w-none">
              {doc.content ? (
                <PortableText
                  value={doc.content}
                  components={portableTextComponents}
                />
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg opacity-75">
                    No content available for this documentation.
                  </p>
                </div>
              )}
            </div>
          </main>

          {!useMobileTOC && tocItems.length > 0 && (
            <aside className="w-64 sticky top-24 self-start hidden md:block">
              <div className="rounded-lg p-4 border border-agentvooc-border shadow-agentvooc-glow">
                <h2 className="text-lg font-semibold mb-4">
                  Table of Contents
                </h2>
                <nav>
                  <ul className="space-y-2">
                    {tocItems.map((item) => (
                      <li
                        key={item.id}
                        className={`${
                          item.style === "h1"
                            ? "ml-0"
                            : item.style === "h2"
                            ? "ml-2"
                            : item.style === "h3"
                            ? "ml-4"
                            : item.style === "h4"
                            ? "ml-6"
                            : item.style === "h5"
                            ? "ml-8"
                            : "ml-10"
                        }`}
                      >
                        <a
                          href={`#${item.id}`}
                          className={`block text-sm hover:text-agentvooc-accent transition-colors ${
                            activeHeadingId === item.id
                              ? "font-medium"
                              : "text-agentvooc-secondary"
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            const element = document.getElementById(item.id);
                            if (element) {
                              element.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                              window.history.pushState(null, "", `#${item.id}`);
                              setActiveHeadingId(item.id);
                            }
                          }}
                          aria-label={`Go to section: ${item.text}`}
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Related content section moved outside the flex container */}
      {doc.relatedContent && doc.relatedContent.length > 0 && (
        <section className="mt-16 w-full max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Related Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doc.relatedContent.slice(0, 3).map((item) => (
              <Card
                key={`${item._type}-${item.slug}`}
                onMouseEnter={() => setHoveredCard(item.slug)}
                onMouseLeave={() => setHoveredCard(null)}
                className="transition-all duration-200 hover:shadow-lg"
              >
                <Link
                  to={`/company/${
                    item._type === "doc"
                      ? "docs"
                      : item._type === "blogPost"
                      ? "blog"
                      : "product"
                  }/${item.slug}`}
                  className="block p-4"
                  aria-label={`View ${
                    item._type === "doc"
                      ? "documentation"
                      : item._type === "blogPost"
                      ? "blog post"
                      : "product"
                  }: ${item.title}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {/* {item.mainImage && (
              <div className="w-full h-32 rounded-t-lg mb-2">
                <DocImage
                  src={item.mainImage}
                  alt={item.mainImageAlt || item.title}
                  className="w-full h-32 object-cover rounded-t-lg"
                  onLoad={(e: React.SyntheticEvent<HTMLImageElement>) =>
                    (e.currentTarget.parentElement!.style.background = "none")
                  }
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    if (item.mainImage) {
                      console.error(
                        "[DocPage] Related content image failed to load:",
                        item.mainImage
                      );
                    }
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )} */}
                  <div className="mb-3">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-white bg-opacity-10 rounded-full">
                      {item._type === "doc"
                        ? "Documentation"
                        : item._type === "blogPost"
                        ? "Blog Post"
                        : "Product"}
                    </span>
                  </div>
                  {hoveredCard === item.slug ? (
                    <div className="text-lg font-semibold mb-2 footer-link inline-block">
                      {item.title}
                    </div>
                  ) : (
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  )}
                  {item.excerpt && (
                    <p className="text-sm mb-2 line-clamp-2">{item.excerpt}</p>
                  )}
                  <p className="text-sm">
                    Published:{" "}
                    {new Date(item.publishedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      )}
    </Card>
  </div>
);
}