import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { apiClient, type BlogPost } from "@/lib/api";
import { Card } from "@/components/ui/card";

export default function BlogList() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null); // Track hovered card

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = "agentVooc Logo";

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getBlogPosts();
        // console.log("[BlogList] Fetched posts:", JSON.stringify(response.blogPosts, null, 2));
        setPosts(response.blogPosts as BlogPost[]);
      } catch (err: any) {
        console.error("[BlogList] Error fetching blog posts:", err);
        setError(err.message || "Failed to fetch blog posts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Blog</title>
          <meta name="description" content="Explore the latest blog posts from agentVooc about AI automation and technology." />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href={`${baseUrl}/company/blog`} />
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
          <meta name="description" content="An error occurred while fetching blog posts." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/company/blog`} />
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
        <title>agentVooc | Blog</title>
        <meta name="description" content="Explore the latest blog posts from agentVooc about AI automation and technology." />
        <meta name="keywords" content="AI automation, agentVooc, blog, technology" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/company/blog`} />
        <meta property="og:title" content="agentVooc Blog" />
        <meta property="og:description" content="Explore the latest blog posts from agentVooc about AI automation and technology." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${baseUrl}/company/blog`} />
        <meta property="og:image" content={defaultImage} />
        <meta property="og:image:alt" content={defaultImageAlt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="agentVooc Blog" />
        <meta name="twitter:description" content="Explore the latest blog posts from agentVooc about AI automation and technology." />
        <meta name="twitter:image" content={defaultImage} />
        <meta name="twitter:image:alt" content={defaultImageAlt} />
      </Helmet>
      <div className="max-w-6xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Blog</h1>
        {posts.length === 0 ? (
          <p >No blog posts available.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Card
                key={post.slug}
                onMouseEnter={() => setHoveredCard(post.slug)}
                onMouseLeave={() => setHoveredCard(null)}
                className="transition-all duration-200 hover:shadow-lg"
              >
                <Link
                  to={`/company/blog/${post.slug}`}
                  className="block p-4"
                  aria-label={`Read blog post: ${post.title}`}
                  onClick={() => window.scrollTo(0, 0)}
                >
                  {post.mainImage && (
                    <div className="w-full h-32 rounded-t-lg mb-2">
                      <img
                        src={post.mainImage}
                        alt={post.mainImageAlt || post.title}
                        loading="lazy"
                        className="w-full h-32 object-cover rounded-t-lg"
                        onLoad={(e) => (e.currentTarget.parentElement!.style.background = "none")}
                        onError={(e) => {
                          // console.error("[BlogList] Thumbnail image failed to load:", post.mainImage);
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  {hoveredCard === post.slug ? (
                    <div
                      className="text-lg font-semibold mb-2 footer-link inline-block"
                    >
                      {post.title}
                    </div>
                  ) : (
                    <h2 className="text-lg font-semibold mb-2">{post.title}</h2>
                  )}
                  <p className="text-sm mb-2 line-clamp-2">{post.excerpt}</p>
                  <p className="text-sm">
                    Published: {new Date(post.publishedAt).toLocaleDateString()}
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