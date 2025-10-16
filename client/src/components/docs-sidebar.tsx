import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarInput,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { apiClient, type Docs } from "@/lib/api";
import { Menu, Search, FileText, ChevronRight, BookOpen } from "lucide-react";
import { ThemeToggle } from "./themeToggle";

interface TocItem {
  id: string;
  text: string;
  style: string;
  slug: string;
  documentTitle: string;
}

export default function DocsSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [docs, setDocs] = useState<Docs[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");

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

  // Fetch all documentation pages
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setIsLoading(true);
        const response = await apiClient.getDocs();
        console.log("[DocsSidebar] Fetched docs:", JSON.stringify(response.docs, null, 2));
        const docsArray = Array.isArray(response.docs) ? response.docs : [response.docs];
        // Sort docs before setting state
        setDocs(sortDocs(docsArray));

        // Auto-expand current document
        const activeSlug = location.pathname.split("/").pop() || "";
        if (activeSlug) {
          setExpandedDocs(new Set([activeSlug]));
        }
      } catch (err: unknown) {
        console.error("[DocsSidebar] Error fetching docs:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch documentation");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocs();
  }, [location.pathname]);

  // Update active heading based on hash changes
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    setActiveHeadingId(hash);
  }, [location.hash]);

  // Generate TOC for all docs
  const tocItems = useMemo(() => {
    const items: TocItem[] = [];
    docs.forEach((doc) => {
      if (doc.content && Array.isArray(doc.content)) {
        const docToc = doc.content
          .filter(
            (block): block is { _type: "block"; _key: string; style?: string; children?: { _key: string; _type: string; text?: string; marks?: string[] }[] } =>
              block._type === "block" && ["h1", "h2", "h3", "h4", "h5", "h6"].includes(block.style || "")
          )
          .map((block) => {
            const text = block.children
              ?.filter((child) => child._type === "span" && child.text)
              .map((child) => child.text)
              .join("")
              .trim();
            return {
              id: block._key,
              text: text || "Untitled Heading",
              style: block.style || "normal",
              slug: doc.slug,
              documentTitle: doc.title || "Untitled Document",
            };
          })
          .filter((item) => item.text && item.text !== "Untitled Heading" && item.id);
        items.push(...docToc);
      }
    });
    return items;
  }, [docs]);

  // Filter and sort docs based on search query
  const filteredDocs = useMemo(() => {
    let result = docs;
    if (searchQuery) {
      result = docs.filter((doc) =>
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content?.some(
          (block) =>
            block._type === "block" &&
            ["h1", "h2", "h3", "h4", "h5", "h6"].includes(block.style || "") &&
            block.children?.some((child) =>
              child.text?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        )
      );
    }
    // Sort filtered results to maintain sortOrder
    return sortDocs(result);
  }, [docs, searchQuery]);

  // Group TOC items by document slug
  const groupedTocItems = useMemo(() => {
    const grouped: { [key: string]: TocItem[] } = {};
    tocItems.forEach((item) => {
      if (!grouped[item.slug]) {
        grouped[item.slug] = [];
      }
      grouped[item.slug].push(item);
    });
    return grouped;
  }, [tocItems]);

  // Toggle document expansion
  const toggleDocExpansion = (slug: string) => {
    setExpandedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
  };

  // Smooth scroll to element with offset
  const smoothScrollToElement = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementTop - 96; // Match offset from [slug].tsx

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  // Handle navigation with smooth scrolling and offset
  const handleHeadingClick = (item: TocItem) => {
    const currentSlug = location.pathname.split("/").pop() || "";

    // Update active heading
    setActiveHeadingId(item.id);

    // If we're already on the same document, just scroll smoothly
    if (currentSlug === item.slug) {
      window.history.pushState(null, "", `${location.pathname}#${item.id}`);
      smoothScrollToElement(item.id);
    } else {
      // Navigate to different document, then scroll
      const targetUrl = `/company/docs/${item.slug}#${item.id}`;
      navigate(targetUrl);
      setTimeout(() => {
        smoothScrollToElement(item.id);
      }, 100);
    }
  };

  // Handle document navigation
  const handleDocClick = (slug: string) => {
    navigate(`/company/docs/${slug}`);
    setExpandedDocs(new Set([slug]));
    setActiveHeadingId(""); // Reset active heading when navigating to a new document
    window.scrollTo(0, 0); // Scroll to top for document navigation
  };

  // Get heading level styling
  const getHeadingLevel = (style: string): number => {
    return parseInt(style.replace("h", "")) || 1;
  };

  if (error) {
    return (
      <Sidebar>
        <SidebarContent className="flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-lg bg-destructive/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-destructive" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Error loading documentation</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="offcanvas"
      className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <SidebarHeader className="border-b border-border/40 bg-muted/30">
        <div className="flex items-center justify-between px-3 py-4">
          <div
            className="flex items-center gap-3 cursor-pointer group transition-all duration-200 hover:opacity-80"
            onClick={() => navigate("/company/docs")}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <BookOpen className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground leading-tight">Documentation</span>
              <span className="text-xs text-muted-foreground mt-1">Knowledge Base</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SidebarTrigger className="w-8 h-8 hover:bg-muted rounded-lg transition-colors">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle Docs Sidebar</span>
            </SidebarTrigger>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex flex-col h-full">
        <div className="p-4 bg-muted/20 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <SidebarInput
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              className="pl-10 h-9 bg-background border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 rounded-lg transition-all duration-200"
              aria-label="Search documentation"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto py-2">
          <SidebarMenu className="px-3 space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground font-medium">Loading documentation...</p>
                </div>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto rounded-lg bg-muted/50 flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {searchQuery ? "No matching documents found" : "No documents available"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? "Try adjusting your search terms" : "Documentation will appear here when available"}
                </p>
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isExpanded = expandedDocs.has(doc.slug);
                const hasHeadings = groupedTocItems[doc.slug]?.length > 0;
                const isActive = doc.slug === location.pathname.split("/").pop();

                return (
                  <SidebarMenuItem key={doc.slug} className="space-y-2">
                    <div className="flex items-center group gap-2">
                      <SidebarMenuButton
                        asChild
                        isActive={isActive && !activeHeadingId}
                        className={`flex-1 h-10 px-3 rounded-lg transition-all duration-200 font-medium ${
                          isActive && !activeHeadingId
                            ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                            : "hover:bg-muted/60 text-foreground border border-transparent hover:border-border/30"
                        }`}
                      >
                        <button
                          onClick={() => handleDocClick(doc.slug)}
                          className="flex items-center gap-3 w-full text-left"
                          aria-label={`View documentation: ${doc.title}`}
                        >
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                            isActive && !activeHeadingId 
                              ? "bg-primary/20 text-primary" 
                              : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20"
                          }`}>
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-sm font-medium leading-tight flex-1 pr-2">
                            {doc.title || "Untitled Document"}
                          </span>
                        </button>
                      </SidebarMenuButton>

                      {hasHeadings && (
                        <button
                          onClick={() => toggleDocExpansion(doc.slug)}
                          className={`p-2 rounded-lg hover:bg-muted/60 transition-all duration-200 flex-shrink-0 ${
                            isExpanded ? "text-primary bg-primary/10" : "text-muted-foreground"
                          }`}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} ${doc.title} sections`}
                        >
                          <ChevronRight
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {hasHeadings && isExpanded && (
                      <SidebarMenuSub className="ml-2 border-l-2 border-border/20 pl-0 py-2 space-y-0.5">
                        {groupedTocItems[doc.slug].map((item) => {
                          const level = getHeadingLevel(item.style);
                          const indent = Math.max(0, (level - 1) * 4);
                          const isHeadingActive = item.slug === location.pathname.split("/").pop() && item.id === activeHeadingId;

                          return (
                            <SidebarMenuItem key={`${item.slug}-${item.id}`}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={isHeadingActive}
                                className={`ml-1 h-8 rounded-md transition-all duration-200 ${
                                  isHeadingActive
                                    ? "bg-primary/10 font-bold shadow-sm"
                                    : "border-r-2 hover:text-agentvooc-accent border-transparent"
                                }`}
                                style={{ paddingLeft: `${indent + 8}px` }}
                              >
                                <button
                                  onClick={() => handleHeadingClick(item)}
                                  className="flex items-center w-full text-left py-2"
                                  aria-label={`Go to section: ${item.text}`}
                                >
                                  <span
                                    className={`text-xs leading-relaxed flex-1 break-words pr-2`}
                                  >
                                    {item.text}
                                  </span>
                                </button>
                              </SidebarMenuSubButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenuSub>
                    )}

                    {hasHeadings && !isExpanded && (
                      <div className="ml-6 mt-1">
                        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/30">
                          <p className="text-xs text-muted-foregroundetlen/70 font-medium">
                            {groupedTocItems[doc.slug].length} section{groupedTocItems[doc.slug].length !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    )}
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </div>

        <div className="p-4 border-t border-border/30 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium text-muted-foreground">
                {filteredDocs.length} document{filteredDocs.length !== 1 ? "s" : ""} loaded
              </span>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs text-primary hover:text-primary/80 transition-colors font-medium px-2 py-1 rounded-md hover:bg-primary/10"
              >
                Clear search
              </button>
            )}
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}