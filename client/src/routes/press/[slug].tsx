import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { apiClient, type PressPost } from "@/lib/api";
import { PortableText, PortableTextComponents } from "@portabletext/react";

export default function PressPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PressPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        console.error("[PressPostPage] No slug provided");
        setError("No slug provided");
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await apiClient.getPressPostBySlug(slug);
        console.log("[PressPostPage] Fetched post:", JSON.stringify(response.pressPosts, null, 2));
        setPost(response.pressPosts);
      } catch (err: any) {
        console.error(`[PressPostPage] Error fetching press post for slug: ${slug}`, err);
        setError(err.message || "Failed to fetch press post");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Custom PortableText components for SEO
  const portableTextComponents: PortableTextComponents = {
    block: {
      h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 ">{children}</h1>,
      h2: ({ children }) => <h2 className="text-2xl font-semibold mb-3 ">{children}</h2>,
      h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 ">{children}</h3>,
      normal: ({ children }) => <p className="mb-4">{children}</p>,
    },
    types: {
      image: ({ value }) => {
        if (!value?.asset?.url) {
          console.error("[PortableText] Image asset URL is missing:", JSON.stringify(value, null, 2));
          return null;
        }
        return (
          <div className="w-full h-64 rounded-lg my-4">
            <img
              src={value.asset.url} // Use pre-formatted URL from endpoint
              alt={value.alt || "Press post image"}
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
          <meta name="description" content="Loading press post..." />
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
          <meta name="description" content="An error occurred while fetching the press post." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/company/press`} />
        </Helmet>
        <div className="max-w-6xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-4">Error</h1>
          <p>{error}</p>
          <Link to="/company/press" className="text-agentvooc-accent hover:underline">
            Back to Press
          </Link>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  // Structured data for NewsArticle
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.seoDescription,
    datePublished: post.publishedAt,
    dateModified: post.modifiedAt || post.publishedAt,
    image: {
      "@type": "ImageObject",
      url: post.mainImage || defaultImage,
      description: post.mainImageAlt || defaultImageAlt,
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
      "@id": `${baseUrl}/company/press/${post.slug}`,
    },
    keywords: post.tags?.join(", ") || "",
    relatedLink: post.relatedContent?.map((item) => ({
      "@type": item._type === "blogPost" ? "BlogPosting" : item._type === "pressPost" ? "NewsArticle" : "WebPage",
      url: `${baseUrl}/company/${item._type === "blogPost" ? "blog" : item._type === "pressPost" ? "press" : "products"}/${item.slug}`,
      headline: item.title,
      image: {
        "@type": "ImageObject",
        url: item.mainImage || defaultImage,
        description: item.mainImageAlt || defaultImageAlt,
      },
    })) || [],
  };

  console.log("[PressPostPage] Rendering post with images:", {
    mainImage: post.mainImage,
    heroImage: post.heroImage,
    galleryImages: post.galleryImages,
    contentImages: post.content?.filter((block) => block._type === "image").map((block) => block.asset?.url),
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>{post.title} | agentVooc</title>
        <meta name="description" content={post.seoDescription} />
        <meta name="keywords" content={post.tags?.join(", ") || "AI automation, agentVooc, press release, technology"} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/company/press/${post.slug}`} />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <meta property="og:title" content={`${post.title} | agentVooc`} />
        <meta property="og:description" content={post.seoDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${baseUrl}/company/press/${post.slug}`} />
        <meta property="og:image" content={post.mainImage || defaultImage} />
        <meta property="og:image:alt" content={post.mainImageAlt || defaultImageAlt} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${post.title} | agentVooc`} />
        <meta name="twitter:description" content={post.seoDescription} />
        <meta name="twitter:image" content={post.mainImage || defaultImage} />
        <meta name="twitter:image:alt" content={post.mainImageAlt || defaultImageAlt} />
        <meta name="twitter:site" content="@agentVooc" />
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      </Helmet>
      <div className="max-w-3xl mx-auto py-12 px-4">
        {post.heroImage && (
          <div className="w-full h-64 rounded-lg mb-8">
            <img
              src={post.heroImage} // Use pre-formatted URL from endpoint
              alt={post.heroImageAlt || post.title}
              loading="lazy"
              className="w-full h-auto rounded-lg"
              onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
              onError={(e) => {
                console.error("[PressPostPage] Hero image failed to load:", post.heroImage);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        {post.mainImage && (
          <div className="w-full h-64 rounded-lg mb-8">
            <img
              src={post.mainImage} // Use pre-formatted URL from endpoint
              alt={post.mainImageAlt || post.title}
              loading="lazy"
              className="w-full h-auto rounded-lg"
              onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
              onError={(e) => {
                console.error("[PressPostPage] Main image failed to load:", post.mainImage);
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        <h1 className="text-3xl font-bold mb-4 ">{post.title}</h1>
        <p className="text-sm text-gray-500 mb-8">
          Published: {new Date(post.publishedAt).toLocaleDateString()}
          {post.modifiedAt && post.modifiedAt !== post.publishedAt && (
            <> | Updated: {new Date(post.modifiedAt).toLocaleDateString()}</>
          )}
        </p>
        <div className="prose prose-invert max-w-none">
          {post.content ? (
            <PortableText value={post.content} components={portableTextComponents} />
          ) : (
            <p className="text-gray-300">No content available</p>
          )}
        </div>
        {post.galleryImages && post.galleryImages.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 ">Gallery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {post.galleryImages.map((image, index) => (
                <div key={index} className="w-full h-64 rounded-lg">
                  <img
                    src={image.url} // Use pre-formatted URL from endpoint
                    alt={image.alt || post.title}
                    loading="lazy"
                    className="w-full h-auto rounded-lg"
                    onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                    onError={(e) => {
                      console.error("[PressPostPage] Gallery image failed to load:", image.url);
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {post.relatedContent && post.relatedContent.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold mb-4 ">Related Content</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {post.relatedContent.slice(0, 3).map((item) => (
                <Link
                  key={`${item._type}-${item.slug}`}
                  to={`/company/${item._type === "blogPost" ? "blog" : item._type === "pressPost" ? "press" : "products"}/${item.slug}`}
                  className="block p-4 rounded-lg border border-agentvooc-border  hover:bg-agentvooc-accent hover:text-black hover:shadow-lg transition-all duration-300"
                  aria-label={`View ${item._type === "blogPost" ? "blog post" : item._type === "pressPost" ? "press release" : "product"}: ${item.title}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {item.mainImage && (
                    <div className="w-full h-32 rounded-t-lg mb-2">
                      <img
                        src={item.mainImage} // Use pre-formatted URL from endpoint
                        alt={item.mainImageAlt || item.title}
                        loading="lazy"
                        className="w-full h-32 object-cover rounded-t-lg"
                        onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                        onError={(e) => {
                          console.error("[PressPostPage] Related content image failed to load:", item.mainImage);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  {item.excerpt && (
                    <p className="text-sm mb-2 line-clamp-2">{item.excerpt}</p>
                  )}
                  <span className="inline-block px-2 py-1 text-xs font-medium  bg-agentvooc-accent rounded-full">
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