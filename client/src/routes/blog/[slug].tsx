import { useEffect, useState, useRef, useCallback, memo, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, Menu, X, Clock, Calendar } from 'lucide-react';
import { apiClient, type BlogPost } from '@/lib/api';
import { PortableText, PortableTextComponents } from '@portabletext/react';
import { Button } from '@/components/ui/button';
import AdSenseUnit from '@/components/adSenseUnit';
import { Card } from '@/components/ui/card';

// Define types for content blocks to fix TypeScript errors
interface BlockChild {
  _key: string;
  _type: string;
  text?: string;
  marks?: string[];
}

interface TocItem {
  id: string;
  text: string;
  style: string;
}

// Memoized Image Component to prevent re-renders
const BlogImage = memo(
  ({ src, alt, className, onError, onLoad }: { src: string; alt: string; className?: string; onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void; onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void }) => {
    return (
      <div className="rounded-xl overflow-hidden shadow-lg mb-6 w-full">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={className || 'w-full h-auto object-contain'}
          onLoad={onLoad}
          onError={onError}
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.src === nextProps.src && prevProps.alt === nextProps.alt && prevProps.className === nextProps.className
);

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [activeTocId, setActiveTocId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isInitialRender = useRef(true);

  const baseUrl = import.meta.env.VITE_SERVER_BASE_URL;
  const defaultImage = `${baseUrl}/images/logo.png`;
  const defaultImageAlt = 'agentVooc Logo';

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) {
        console.error('[BlogPostPage] No slug provided');
        setError('No slug provided');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const response = await apiClient.getBlogPosts(slug);
        if (isInitialRender.current) {
          // console.log('[BlogPostPage] Fetched post:', JSON.stringify(response.blogPosts, null, 2));
          isInitialRender.current = false;
        }
        if (Array.isArray(response.blogPosts)) {
          console.error(`[BlogPostPage] Expected single BlogPost, got array for slug: ${slug}`);
          setError('Invalid response format');
          return;
        }
        setPost(response.blogPosts as BlogPost);
        const generatedToc = generateToc(response.blogPosts.content);
        setToc(generatedToc);
      } catch (err: any) {
        console.error(`[BlogPostPage] Error fetching blog post for slug: ${slug}`, err);
        setError(err.message || 'Failed to fetch blog post');
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

  // Track active section with IntersectionObserver
  useEffect(() => {
    if (!toc.length) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveTocId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -50% 0px', threshold: 0.1 }
    );

    observerRef.current = observer;

    toc.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [toc.length]);

  const generateToc = useCallback((content: BlogPost['content']): TocItem[] => {
  if (!content) return [];

  const toc: TocItem[] = content
    .filter((block: any) => 
      block._type === 'block' && 
      typeof block.style === 'string' && 
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(block.style)
    )
    .map((block: { _key: string; style: string; children: BlockChild[] }) => {
      const text = block.children
        .filter((child: BlockChild) => child._type === 'span')
        .map((child: BlockChild) => child.text || '')
        .join('');
      return {
        id: block._key,
        text: text || 'Untitled Heading',
        style: block.style,
      };
    });

  // console.log('[generateToc] Generated TOC:', toc);
  return toc;
}, []);

  const handleTocClick = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      window.scrollBy(0, -96); // Adjust for 6rem (96px) top offset
      setActiveTocId(id);
    }
  }, []);

  // Memoize TOC items with active state to prevent unnecessary re-renders
  const tocItemsWithActive = useMemo(() => {
    return toc.map((item) => ({
      ...item,
      isActive: item.id === activeTocId,
    }));
  }, [toc, activeTocId]);

  // Memoize the mobile TOC component
  const MobileTocComponent = memo(({ tocItems, isOpen, onToggle, onItemClick }: {
    tocItems: (TocItem & { isActive: boolean })[];
    isOpen: boolean;
    onToggle: () => void;
    onItemClick: (id: string) => void;
  }) => (
    <div className="lg:hidden mb-8">
      <Button
        variant="outline"
        className="flex items-center justify-between w-full p-4 rounded-lg border-2 hover:bg-opacity-10 hover:bg-white transition-all duration-200"
        onClick={onToggle}
        aria-label={isOpen ? 'Hide Table of Contents' : 'Show Table of Contents'}
      >
        <span className="font-medium">Table of Contents</span>
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>
      {isOpen && (
        <div className="mt-4 bg-agentvooc-primary-bg rounded-lg border border-agentvooc-border overflow-hidden">
          <ul className="py-4 max-h-[50vh] overflow-y-auto">
            {tocItems.map((item) => (
              <li
                key={item.id}
                className={`px-6 py-2 cursor-pointer transition-all duration-200 hover:bg-white hover:bg-opacity-5 border-l-4 ${
                  item.isActive ? 'border-l-white bg-white bg-opacity-10' : 'border-l-transparent'
                } ${
                  item.style === 'h1'
                    ? 'ml-0 text-base font-semibold'
                    : item.style === 'h2'
                      ? 'ml-4 text-base'
                      : item.style === 'h3'
                        ? 'ml-8 text-sm'
                        : 'ml-12 text-sm'
                }`}
                onClick={() => onItemClick(item.id)}
                aria-current={item.isActive ? 'true' : undefined}
              >
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ));

  // Memoize the desktop TOC component
  const DesktopTocComponent = memo(({ tocItems, onItemClick }: {
    tocItems: (TocItem & { isActive: boolean })[];
    onItemClick: (id: string) => void;
  }) => (
    <div className="bg-agentvooc-primary-bg rounded-xl border border-agentvooc-border p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-6 underline">Contents</h2>
      <ul className="space-y-1">
        {tocItems.map((item) => (
          <li
            key={item.id}
            className={`cursor-pointer transition-all duration-200 hover:bg-white hover:bg-opacity-5 rounded-lg border-l-4 ${
              item.isActive ? '' : 'border-l-transparent'
            }`}
            onClick={() => onItemClick(item.id)}
            aria-current={item.isActive ? 'true' : undefined}
          >
            <div className={`px-3 text-sm py-1 ${
              item.style === 'h1'
                ? 'text-base font-semibold'
                : item.style === 'h2'
                  ? 'ml-2 text-base'
                  : item.style === 'h3'
                    ? 'ml-4 '
                    : 'ml-6 opacity-90'
            }`}>
              {item.text}
            </div>
          </li>
        ))}
      </ul>
    </div>
  ));

  // Custom PortableText components for SEO and TOC - memoized to prevent recreation
  const portableTextComponents: PortableTextComponents = useMemo(() => ({
  block: {
    h1: ({ children, value }) => (
      <h1 id={value._key} className="text-4xl font-bold mb-8 mt-12 first:mt-0 text-agentvooc-primary leading-tight">
        {children}
      </h1>
    ),
    h2: ({ children, value }) => (
      <h2 id={value._key} className="text-3xl font-bold mb-6 mt-10 text-agentvooc-primary leading-snug">
        {children}
      </h2>
    ),
    h3: ({ children, value }) => (
      <h3 id={value._key} className="text-2xl font-semibold mb-4 mt-8 text-agentvooc-primary leading-snug">
        {children}
      </h3>
    ),
    h4: ({ children, value }) => (
      <h4 id={value._key} className="text-xl font-semibold mb-3 mt-6 text-agentvooc-primary">
        {children}
      </h4>
    ),
    h5: ({ children, value }) => (
      <h5 id={value._key} className="text-lg font-semibold mb-3 mt-5 text-agentvooc-primary">
        {children}
      </h5>
    ),
    h6: ({ children, value }) => (
      <h6 id={value._key} className="text-base font-semibold mb-2 mt-4 text-agentvooc-primary">
        {children}
      </h6>
    ),
    normal: ({ children }) => (
      <p className="mb-6 leading-relaxed text-lg">{children}</p>
    ),
    blockquote: ({ children, value }) => (
      <blockquote
        id={value._key}
        className="border-l-4 border-agentvooc-primary/50 pl-4 sm:pl-6 py-4 my-8 bg-white bg-opacity-5 rounded-r-lg text-lg leading-relaxed text-agentvooc-primary ml-0 sm:ml-2 lg:ml-8 mr-0 max-w-full overflow-x-auto"
      >
        {children}
      </blockquote>
    ),
  },
  marks: {
    strong: ({ children }) => (
      <span className="font-bold text-agentvooc-primary">{children}</span>
    ),
    em: ({ children }) => (
      <span className="italic text-agentvooc-primary">{children}</span>
    ),
    underline: ({ children }) => (
      <span className="underline text-agentvooc-primary">{children}</span>
    ),
    code: ({ children }) => (
      <code className="font-mono bg-agentvooc-primary-bg/50 px-1 rounded text-agentvooc-accent">{children}</code>
    ),
    link: ({ children, value }) => {
      const { href, openInNewTab } = value;
      const isInternal = href.startsWith('/') || href.startsWith(baseUrl);
      const rel = openInNewTab ? 'noopener noreferrer' : undefined;
      return isInternal ? (
        <Link
          to={href.replace(baseUrl, '')}
          className="text-agentvooc-accent hover:underline"
          onClick={() => window.scrollTo(0, 0)}
        >
          {children}
        </Link>
      ) : (
        <a
          href={href}
          className="text-agentvooc-accent hover:underline"
          target={openInNewTab ? '_blank' : '_self'}
          rel={rel}
        >
          {children}
        </a>
      );
    },
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset?.url) {
        console.error('[PortableText] Image asset URL is missing:', JSON.stringify(value, null, 2));
        return null;
      }
      return (
        <div className="my-8">
          <BlogImage
            src={value.asset.url}
            alt={value.alt || 'Blog post image'}
            onLoad={(e) => (e.currentTarget.parentElement!.style.background = 'none')}
            onError={(e) => {
              console.error('[PortableText] Image failed to load:', value.asset.url);
              e.currentTarget.style.display = 'none';
            }}
          />
          {value.alt && (
            <p className="text-center text-sm opacity-75 mt-2 italic">{value.alt}</p>
          )}
        </div>
      );
    },
    table: ({ value }) => {
      if (!value?.rows?.length || !value?.columns?.length) {
        console.warn('[PortableText] Table is missing rows or columns:', value);
        return null;
      }
      return (
        <figure className="my-8">
          <div className="overflow-x-auto">
            <table
  role="table"
  className="w-full border-collapse border border-agentvooc-border text-left text-sm md:text-base table-fixed"
>
  <thead>
    <tr className="border-b border-agentvooc-border bg-agentvooc-primary-bg/50">
      {value.columns.map((column: any, colIndex: number) => (
        <th
          key={`col-${colIndex}`}
          className={`p-3 border-r border-agentvooc-border last:border-r-0 font-semibold text-${column.align || 'left'}`}
          style={{ width: `${100 / value.columns.length}%` }}
          role="columnheader"
          scope="col"
        >
                      <PortableText
                        value={column.content}
                        components={{
                          block: {
                            normal: ({ children }) => <span className="text-sm md:text-base">{children}</span>,
                            h1: ({ children }) => <h1 className="text-xl font-bold">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-bold">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
                            h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
                            h5: ({ children }) => <h5 className="text-sm font-medium">{children}</h5>,
                            h6: ({ children }) => <h6 className="text-xs font-medium">{children}</h6>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-agentvooc-primary/50 pl-2 text-sm md:text-base italic">
                                {children}
                              </blockquote>
                            ),
                          },
                          marks: {
                            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            underline: ({ children }) => <span className="underline">{children}</span>,
                            code: ({ children }) => (
                              <code className="font-mono bg-agentvooc-primary-bg/50 px-1 rounded">{children}</code>
                            ),
                            link: ({ children, value }) => {
                              const { href, openInNewTab } = value;
                              const isInternal = href.startsWith('/') || href.startsWith(baseUrl);
                              const rel = openInNewTab ? 'noopener noreferrer' : undefined;
                              return isInternal ? (
                                <Link
                                  to={href.replace(baseUrl, '')}
                                  className="text-agentvooc-accent hover:underline"
                                  onClick={() => window.scrollTo(0, 0)}
                                >
                                  {children}
                                </Link>
                              ) : (
                                <a
                                  href={href}
                                  className="text-agentvooc-accent hover:underline"
                                  target={openInNewTab ? '_blank' : '_self'}
                                  rel={rel}
                                >
                                  {children}
                                </a>
                              );
                            },
                          },
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {value.rows.map((row: { _key: string; cells: any[] }) => (
                  <tr
                    key={row._key}
                    className="border-b border-agentvooc-border"
                    role="row"
                  >
                    {row.cells.map((cell: any, cellIndex: number) => (
                      <td
  key={`${row._key}-${cellIndex}`}
  className={`p-3 border-r border-agentvooc-border last:border-r-0 text-${cell.align || 'left'} align-top`}
  colSpan={cell.colspan || 1}
  rowSpan={cell.rowspan || 1}
  role="cell"
>
                        <PortableText
                          value={cell.content}
                          components={{
                            block: {
                              normal: ({ children }) => <span className="text-sm md:text-base">{children}</span>,
                              h1: ({ children }) => <h1 className="text-xl font-bold">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold">{children}</h3>,
                              h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
                              h5: ({ children }) => <h5 className="text-sm font-medium">{children}</h5>,
                              h6: ({ children }) => <h6 className="text-xs font-medium">{children}</h6>,
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-agentvooc-primary/50 pl-2 text-sm md:text-base italic">
                                  {children}
                                </blockquote>
                              ),
                            },
                            marks: {
                              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              underline: ({ children }) => <span className="underline">{children}</span>,
                              code: ({ children }) => (
                                <code className="font-mono bg-agentvooc-primary-bg/50 px-1 rounded">{children}</code>
                              ),
                              link: ({ children, value }) => {
                                const { href, openInNewTab } = value;
                                const isInternal = href.startsWith('/') || href.startsWith(baseUrl);
                                const rel = openInNewTab ? 'noopener noreferrer' : undefined;
                                return isInternal ? (
                                  <Link
                                    to={href.replace(baseUrl, '')}
                                    className="text-agentvooc-accent hover:underline"
                                    onClick={() => window.scrollTo(0, 0)}
                                  >
                                    {children}
                                  </Link>
                                ) : (
                                  <a
                                    href={href}
                                    className="text-agentvooc-accent hover:underline"
                                    target={openInNewTab ? '_blank' : '_self'}
                                    rel={rel}
                                  >
                                    {children}
                                  </a>
                                );
                              },
                            },
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {value.caption && (
            <figcaption className="text-sm text-center opacity-75 mt-2 italic">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
  },
}), [baseUrl]);

  

  // Memoize structured data to prevent recreation on every render
  const structuredData = useMemo(() => {
    if (!post) return null;
    
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.seoDescription,
      datePublished: post.publishedAt,
      dateModified: post.modifiedAt || post.publishedAt,
      image: {
        '@type': 'ImageObject',
        url: post.mainImage,
        description: post.mainImageAlt,
      },
      author: {
        '@type': 'Organization',
        name: 'agentVooc',
      },
      publisher: {
        '@type': 'Organization',
        name: 'agentVooc',
        logo: {
          '@type': 'ImageObject',
          url: defaultImage,
          description: defaultImageAlt,
        },
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/company/blog/${post.slug}`,
      },
      keywords: post.tags?.join(', ') || '',
      relatedLink: post.relatedContent?.map((item) => ({
        '@type': item._type === 'blogPost' ? 'BlogPosting' : item._type === 'pressPost' ? 'NewsArticle' : 'WebPage',
        url: `${baseUrl}/company/${item._type === 'blogPost' ? 'blog' : item._type === 'pressPost' ? 'press' : 'products'}/${item.slug}`,
        headline: item.title,
        image: {
          '@type': 'ImageObject',
          url: item.mainImage || defaultImage,
          description: item.mainImageAlt || defaultImageAlt,
        },
      })) || [],
    };
  }, [post, baseUrl, defaultImage, defaultImageAlt]);

  // Log image data only once when post changes
  useEffect(() => {
    if (post && !isInitialRender.current) {
      // console.log('[BlogPostPage] Rendering post with images:', {
      //   mainImage: post.mainImage,
      //   heroImage: post.heroImage,
      //   galleryImages: post.galleryImages,
      //   contentImages: post.content?.filter((block) => block._type === 'image').map((block) => block.asset?.url),
      // });
    }
  }, [post]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary flex items-center justify-center">
        <Helmet>
          <title>agentVooc | Loading</title>
          <meta name="description" content="Loading blog post..." />
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg opacity-75">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
        <Helmet>
          <title>agentVooc | Error</title>
          <meta name="description" content="An error occurred while fetching the blog post." />
          <meta name="robots" content="noindex" />
          <link rel="canonical" href={`${baseUrl}/company/blog`} />
        </Helmet>
        <div className="max-w-4xl mx-auto py-12 px-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Oops! Something went wrong</h1>
            <p className="text-lg mb-6 opacity-75">{error}</p>
            <Link 
              to="/company/blog" 
              className="inline-flex items-center px-6 py-3 rounded-lg border border-agentvooc-border hover:bg-white hover:bg-opacity-10 transition-all duration-200"
            >
              ← Back to Blog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-agentvooc-secondary-bg to-agentvooc-primary-bg text-agentvooc-primary">
      <Helmet>
        <title>{post.title} | agentVooc</title>
        <meta name="description" content={post.seoDescription} />
        <meta name="keywords" content={post.tags?.join(', ') || 'AI automation, agentVooc, blog, technology'} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${baseUrl}/company/blog/${post.slug}`} />
        <link rel="sitemap" href={`${baseUrl}/sitemap.xml`} type="application/xml" />
        <meta property="og:title" content={`${post.title} | agentVooc`} />
        <meta property="og:description" content={post.seoDescription} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`${baseUrl}/company/blog/${post.slug}`} />
        <meta property="og:image" content={post.mainImage || defaultImage} />
        <meta property="og:image:alt" content={post.mainImageAlt || defaultImageAlt} />
        <meta property="og:site_name" content="agentVooc" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${post.title} | agentVooc`} />
        <meta name="twitter:description" content={post.seoDescription} />
        <meta name="twitter:image" content={post.mainImage} />
        <meta name="twitter:image:alt" content={post.mainImageAlt} />
        <meta name="twitter:site" content="@agentVooc" />
        {structuredData && (
          <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
        )}
      </Helmet>
      
      <article className="max-w-7xl mx-auto py-12 px-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <main className="flex-1 max-w-none lg:max-w-4xl">
            {/* Mobile TOC */}
            {toc.length > 0 && (
              <MobileTocComponent
                tocItems={tocItemsWithActive}
                isOpen={isTocOpen}
                onToggle={() => setIsTocOpen(!isTocOpen)}
                onItemClick={handleTocClick}
              />
            )}

            {/* Hero/Main Image */}
            {post.heroImage && (
              <div className="rounded-lg mb-8">
                <BlogImage
                  src={post.heroImage}
                  alt={post.heroImageAlt || post.title}
                  onLoad={(e) => (e.currentTarget.parentElement!.style.background = 'none')}
                  onError={(e) => {
                    console.error('[BlogPostPage] Hero image failed to load:', post.heroImage);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {post.mainImage && (
              <div className="rounded-lg mb-8">
                <BlogImage
                  src={post.mainImage}
                  alt={post.mainImageAlt || post.title}
                  onLoad={(e) => (e.currentTarget.parentElement!.style.background = 'none')}
                  onError={(e) => {
                    console.error('[BlogPostPage] Main image failed to load:', post.mainImage);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* AdSense Header Ad */}
            {post.adSlotHeader && (
  <div className="mb-8 ad-container" style={{ minWidth: '300px', minHeight: '100px', display: 'block' }}>
    <AdSenseUnit adSlot={post.adSlotHeader} format="auto" className="mx-auto" />
  </div>
)}

            {/* Article Header */}
            <header className="mb-10">
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {post.title}
              </h1>
              
              {/* Meta Information */}
              <div className="flex flex-wrap items-center gap-6 text-sm opacity-75 mb-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Published {new Date(post.publishedAt).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</span>
                </div>
                {post.modifiedAt && post.modifiedAt !== post.publishedAt && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Updated {new Date(post.modifiedAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-8">
                  {post.tags.slice(0, 5).map((tag) => (
                    <span 
                      key={tag} 
                      className="px-3 py-1 text-xs font-medium rounded-full bg-white bg-opacity-10 border border-agentvooc-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </header>

            {/* Article Content */}
            <div className="prose prose-lg prose-invert max-w-none">
              {post.content ? (
                <PortableText value={post.content} components={portableTextComponents} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-lg opacity-75">No content available for this article.</p>
                </div>
              )}
            </div>

            {/* AdSense Content Ad */}
            {post.adSlotContent && (
  <div className="my-8 ad-container" style={{ minWidth: '300px', minHeight: '100px', display: 'block' }}>
    <AdSenseUnit adSlot={post.adSlotContent} format="auto" className="mx-auto" />
  </div>
)}

            {/* Gallery */}
            {post.galleryImages && post.galleryImages.length > 0 && (
              <section className="mt-16">
                <h2 className="text-3xl font-bold mb-8">Gallery</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {post.galleryImages
                    .filter((image) => image?.url)
                    .map((image, index) => (
                      <BlogImage
                        key={index}
                        src={image.url}
                        alt={image.alt || `${post.title} - Gallery image ${index + 1}`}
                        className="w-full h-auto rounded-xl"
                        onLoad={(e) => (e.currentTarget.parentElement!.style.background = 'none')}
                        onError={(e) => {
                          console.error('[BlogPostPage] Gallery image failed to load:', image.url);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ))}
                </div>
              </section>
            )}

            {/* Related Content */}
            {post.relatedContent && post.relatedContent.length > 0 && (
              <section className="mt-16">
                <h2 className="text-3xl font-bold mb-8">You might also like</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {post.relatedContent.slice(0, 3).map((item) => (
                    <Card>
                    <Link
                      key={`${item._type}-${item.slug}`}
                      to={`/company/${item._type === 'blogPost' ? 'blog' : item._type === 'pressPost' ? 'press' : 'products'}/${item.slug}`}
                      aria-label={`View ${item._type === 'blogPost' ? 'blog post' : item._type === 'pressPost' ? 'press release' : 'product'}: ${item.title}`}
                      onClick={() => window.scrollTo(0, 0)}
                    >
                      {item.mainImage && (
                        <div className="aspect-video overflow-hidden">
                          <BlogImage
                            src={item.mainImage}
                            alt={item.mainImageAlt || item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onLoad={(e) => (e.currentTarget.parentElement!.style.background = 'none')}
                            onError={(e) => {
                              console.error('[BlogPostPage] Related content image failed to load:', item.mainImage);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="p-6">
                        <div className="mb-3">
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded-full">
                            {item._type === 'blogPost' ? 'Blog Post' : item._type === 'pressPost' ? 'Press Release' : 'Product'}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2 group-hover:text-agentvooc-accent transition-colors">
                          {item.title}
                        </h3>
                        {item.excerpt && (
                          <p className="text-sm opacity-75 line-clamp-2">
                            {item.excerpt}
                          </p>
                        )}
                      </div>
                    </Link>
                    </Card>
                  ))}
                  
                </div>
              </section>
            )}
          </main>

          {/* Sidebar: TOC and Ad */}
          {toc.length > 0 && (
            <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <DesktopTocComponent
                tocItems={tocItemsWithActive}
                onItemClick={handleTocClick}
              />
              {post.adSlotRightSide && (
  <div className="mt-6 ad-container" style={{ minWidth: '160px', minHeight: '600px', display: 'block' }}>
    <AdSenseUnit adSlot={post.adSlotRightSide} format="vertical" className="mx-auto" />
  </div>
)}
            </aside>
          )}
        </div>
      </article>
    </div>
  );
}