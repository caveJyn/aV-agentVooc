import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  image?: string;
}

interface TestimonialsSectionProps {
  testimonialsSection: {
    heading: string;
    testimonials: Testimonial[];
    trustSignal: string;
  };
}

export const TestimonialsSection = ({
  testimonialsSection,
}: TestimonialsSectionProps) => {
  const heading = testimonialsSection.heading || "What Our Users Say";
  const testimonials = testimonialsSection.testimonials.length > 0
    ? testimonialsSection.testimonials
    : [
        {
          quote: "agentVooc saved us 20 hours a week!",
          author: "Jane D.",
          role: "Tech Lead",
          image: "https://via.placeholder.com/150",
        },
        {
          quote: "The automation features are a game-changer.",
          author: "Mark S.",
          role: "Entrepreneur",
          image: "https://via.placeholder.com/150",
        },
        {
          quote: "I love how easy it is to use.",
          author: "Sarah L.",
          role: "Developer",
          image: "https://via.placeholder.com/150",
        },
        {
          quote: "Incredible tool for productivity!",
          author: "Alex P.",
          role: "Product Manager",
          image: "https://via.placeholder.com/150",
        },
      ];

  const trustSignal =
    testimonialsSection.trustSignal ||
    "Join 10,000+ happy users automating their tasks.";

  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoScrollTimerRef = useRef<number | null>(null);

  // Total number of testimonials
  const totalItems = testimonials.length;
  
  // Handle transition sequence between testimonials
  useEffect(() => {
    if (activeIndex !== visibleIndex) {
      // Start the transition - fade out current testimonial
      setIsTransitioning(true);
      
      // After fade out completes, update the visible testimonial
      const timer = setTimeout(() => {
        setVisibleIndex(activeIndex);
        
        // Short delay before fade in to ensure smooth transition
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 300); // Half of the total transition time
      
      return () => clearTimeout(timer);
    }
  }, [activeIndex, visibleIndex]);
  
  // Handle auto-scrolling
  const scrollToNext = () => {
    if (isTransitioning) return;
    const nextIndex = (activeIndex + 1) % totalItems;
    setActiveIndex(nextIndex);
  };
  
  // Set up auto-scrolling timer
  useEffect(() => {
    autoScrollTimerRef.current = window.setInterval(() => {
      scrollToNext();
    }, 5000);
    
    return () => {
      if (autoScrollTimerRef.current) {
        clearInterval(autoScrollTimerRef.current);
      }
    };
  }, [activeIndex, isTransitioning]);
  
  // Handle clicking on a profile picture
  const handleProfileClick = (index: number) => {
    if (isTransitioning || index === activeIndex) return;
    
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
    
    setActiveIndex(index);
    
    // Resume auto-scrolling after selection
    autoScrollTimerRef.current = window.setInterval(() => {
      scrollToNext();
    }, 5000);
  };

  return (
    <section className="py-16 px-4 bg-agentvooc-primary-bg-dark">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold mb-12 text-agentvooc-primary text-center">
          {heading}
        </h2>

        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* Left Half - Placeholder for Image/Component */}
          <div className="w-full lg:w-1/2 min-h-[400px] bg-agentvooc-secondary-accent/20 rounded-lg flex items-center justify-center">
            <div className="text-agentvooc-primary/40 text-lg">
              Image or Component Placeholder
            </div>
          </div>

          {/* Right Half - Testimonials */}
          <div className="w-full lg:w-1/2">
            {/* Profile Pictures */}
            <div className="flex justify-center gap-4 mb-8">
              {testimonials.map((testimonial, index) => (
                <button
                  key={index}
                  onClick={() => handleProfileClick(index)}
                  className="focus:outline-none transition-all duration-300"
                >
                  <Avatar className={`w-12 h-12 border-2 transition-all duration-300 ${
                    activeIndex === index
                      ? "border-agentvooc-accent scale-110 ring-2 ring-agentvooc-accent/30"
                      : "border-agentvooc-secondary-accent opacity-70 hover:opacity-90"
                  }`}>
                    <AvatarImage src={testimonial.image} alt={testimonial.author} />
                    <AvatarFallback className="bg-agentvooc-secondary-accent text-agentvooc-primary">
                      {testimonial.author.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>

            {/* Testimonials Content */}
            <div className="relative overflow-hidden min-h-[280px]">
              <div 
                className="transition-opacity duration-600 ease-in-out"
                style={{ opacity: isTransitioning ? 0 : 1 }}
              >
                <Card className="bg-agentvooc-secondary-accent shadow-agentvooc-glow">
                  <CardContent className="p-6">
                    <div className="flex flex-col">
                      <div className="text-agentvooc-accent text-4xl mb-3">"</div>
                      <p className="text-agentvooc-secondary text-lg mb-6">
                        {testimonials[visibleIndex].quote}
                      </p>
                      <div className="mt-auto">
                        <p className="text-agentvooc-primary font-semibold">
                          {testimonials[visibleIndex].author}
                        </p>
                        <p className="text-agentvooc-primary/70 text-sm">
                          {testimonials[visibleIndex].role}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Centered Trust Signal */}
        <div className="mt-8 flex justify-center">
          <Badge className="px-4 py-1 text-sm bg-agentvooc-accent/10 text-agentvooc-accent hover:bg-agentvooc-accent/20 border-none shadow-agentvooc-glow inline-block">
            {trustSignal}
          </Badge>
        </div>
      </div>
    </section>
  );
};