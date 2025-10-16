import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ImageVariants {
  main: string;
  thumbnail: string;
  medium: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  image?: ImageVariants;
}

interface TestimonialsSectionProps {
  testimonialsSection: {
    heading: string;
    testimonials: Testimonial[];
    trustSignal: string;
    sectionImage?: ImageVariants;
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
          image: null,
        },
        {
          quote: "The automation features are a game-changer.",
          author: "Mark S.",
          role: "Entrepreneur",
          image: null,
        },
        {
          quote: "I love how easy it is to use.",
          author: "Sarah L.",
          role: "Developer",
          image: null,
        },
        {
          quote: "Incredible tool for productivity!",
          author: "Alex P.",
          role: "Product Manager",
          image: null,
        },
      ];
  const trustSignal =
    testimonialsSection.trustSignal ||
    "Join 10,000+ happy users automating their tasks.";
  const sectionImage = testimonialsSection.sectionImage;

  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoScrollTimerRef = useRef<number | null>(null);

  const totalItems = testimonials.length;

  useEffect(() => {
    if (activeIndex !== visibleIndex) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setVisibleIndex(activeIndex);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeIndex, visibleIndex]);

  const scrollToNext = () => {
    if (isTransitioning) return;
    const nextIndex = (activeIndex + 1) % totalItems;
    setActiveIndex(nextIndex);
  };

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

  const handleProfileClick = (index: number) => {
    if (isTransitioning || index === activeIndex) return;
    if (autoScrollTimerRef.current) {
      clearInterval(autoScrollTimerRef.current);
    }
    setActiveIndex(index);
    autoScrollTimerRef.current = window.setInterval(() => {
      scrollToNext();
    }, 5000);
  };

  return (
  <section className="py-16 px-4 animate-fade-in" aria-label="Testimonials">
    <div className="max-w-6xl mx-auto">
      <h2 className="text-4xl font-bold mb-12 text-center">{heading}</h2>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-1/2 min-h-[450px] rounded-lg flex items-center justify-center">
          {sectionImage && sectionImage.main ? (
            <img
              src={sectionImage.main}
              alt="Testimonials Section"
              className=""
              onError={(e) => {
                console.error("Failed to load testimonials section image:", sectionImage.main);
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-96 rounded-lg flex items-center justify-center bg-agentvooc-secondary-accent/20">
              <p className="text-lg">Image or Component Placeholder</p>
            </div>
          )}
        </div>
        <div className="w-full lg:w-1/2">
          <div className="flex justify-center gap-4 mb-10">
            {testimonials.map((testimonial, index) => (
              <Button
              variant="outline"
                key={index}
                onClick={() => handleProfileClick(index)}
                className="transition-all duration-300 h-full "
                aria-label={`View testimonial from ${testimonial.author}`}
              >
                <Avatar
                  className={`w-12 h-12 border-2 transition-all duration-300 ${
                    activeIndex === index
                      ? "border-agentvooc-accent scale-110 ring-2 ring-agentvooc-accent/30"
                      : "border-agentvooc-accent opacity-70 hover:opacity-90 hover:scale-105"
                  }`}
                >
                  <AvatarImage src={testimonial.image?.main} alt={testimonial.author} />
                  <AvatarFallback className="bg-agentvooc-secondary-bg text-agentvooc-accent">
                    {testimonial.author.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            ))}
          </div>
          <div className="relative overflow-hidden">
            <div
              className="transition-opacity duration-600 ease-in-out"
              style={{ opacity: isTransitioning ? 0 : 1 }}
            >
              <Card
                className="flex flex-col"
                aria-labelledby={`testimonial-${visibleIndex}-title`}
              >
                <CardHeader>
                  <CardTitle id={`testimonial-${visibleIndex}-title`}>
                    <h3>{testimonials[visibleIndex].author}</h3>
                  </CardTitle>
                  <p>{testimonials[visibleIndex].role}</p>
                </CardHeader>
                <CardContent className="flex-grow">
                  <span className="text-agentvooc-accent text-3xl mb-3">"</span>
                  <p>{testimonials[visibleIndex].quote}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Badge
          variant="default"
          className="mt-8 animate-glow-pulse"
          aria-label={trustSignal}
        >
          {trustSignal}
        </Badge>
      </div>
    </div>
  </section>
);
};

