import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";

interface ImageVariants {
  main: string;
  thumbnail: string;
  medium: string;
  raw?: string;
}

interface HeroSection {
  title: string;
  subtitle: string;
  primaryCtaText: string;
  secondaryCtaText?: string;
  trustSignal?: string;
  backgroundImage?: ImageVariants;
  mascotModel?: { asset: { _id: string; url: string } };
}

interface HeroProps {
  heroSection: HeroSection;
}

interface StarPosition {
  top: string;
  left: string;
  width: string;
  height: string;
  animationDelay: string;
  animationDuration: string;
}

export const Hero = ({ heroSection }: HeroProps) => {
  const title = heroSection.title || "Welcome to the Future with agentVooc";
  const subtitle =
    heroSection.subtitle ||
    "Empower your decisions with intelligent AI agents and automation.";
  const primaryCtaText = heroSection.primaryCtaText || "Get Started";

  const [starPositions, setStarPositions] = useState<StarPosition[]>([]);

  useEffect(() => {
    const positions = [...Array(600)].map(() => {
      const angle = Math.random() * 2 * Math.PI;
      const a = window.innerWidth * 2.8 * 0.5;
      const b = window.innerHeight * 2.8 * 0.5;
      const radiusScale = Math.random() * 0.8 + 0.4;
      const x = a * Math.cos(angle) * radiusScale;
      const y = b * Math.sin(angle) * radiusScale;
      const galaxyCenterX = window.innerWidth * 2.8 * 0.5;
      const galaxyCenterY = window.innerHeight * 2.8 * 0.5;
      const containerWidth = window.innerWidth * 2.8;
      const containerHeight = window.innerHeight * 2.8;
      const left = ((galaxyCenterX + x) / containerWidth) * 100;
      const top = ((galaxyCenterY + y) / containerHeight) * 100;

      return {
        top: `${top}%`,
        left: `${left}%`,
        width: `${Math.random() * 4 + 2}px`,
        height: `${Math.random() * 4 + 2}px`,
        animationDelay: `${Math.random() * 4}s`,
        animationDuration: `${Math.random() * 5 + 3}s`,
      };
    });
    setStarPositions(positions);
  }, []);

  // Define the three images in the specified order
  const images = [
    "/sbmain.png",
    "/chatin.png",
    "/sbdoc.png",
  ];

  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-cover bg-center bg-no-repeat hero-container">
      {/* Background Gradient and Overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-agentvooc-secondary-bg via-agentvooc-primary-bg to-agentvooc-secondary-accent"
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Galaxy Container for Stars and Pulses */}
      <div className="galaxy-container">
        <div className="absolute top-25% left-25% pointer-events-none z-0">
          <div
            className="w-96 h-96 bg-agentvooc-accent rounded-full pulse"
            style={{ animationDelay: "0s" }}
          />
          <div
            className="w-80 h-80 bg-agentvooc-accent rounded-full pulse pulse-secondary"
            style={{ animationDelay: "-2s" }}
          />
        </div>
        <div className="absolute inset-0 pointer-events-none">
          {starPositions.map((position, index) => (
            <div
              key={index}
              className="star"
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
      </div>

      {/* Content */}
      <div className="relative z-10 w-[1600px] px-4 sm:px-6 lg:px-8 flex flex-col items-center lg:flex-row lg:items-center">
        <div className="lg:w-1/2 text-center lg:text-left lg:pr-8 mb-8 lg:mb-0">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 animate-fade-in"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--agentvooc-text-hero-title)), hsl(var(--agentvooc-accent)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animationDelay: "0.0s",
              lineHeight: "1.1",
              paddingBottom: "0.2em",
            }}
          >
            {title}<span>.</span>
          </h1>
          <h2
            className="sm:text-sm md:text-lg lg:text-2xl max-w-xl mx-auto lg:mx-0 mb-6 animate-fade-in"
            style={{
              background:
                "linear-gradient(to right, hsl(var(--agentvooc-text-hero-title)), hsl(var(--agentvooc-accent)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animationDelay: "0.0s",
              lineHeight: "1.1",
              paddingBottom: "0.2em",
            }}
          >
            {subtitle}
          </h2>
          <NavLink to="https://agentvooc.com/demo">
            <Button
              variant="default"
              size="lg"
              className="animate-glow-pulse"
              style={{ animationDelay: "0.4s" }}
            >
              {primaryCtaText}
            </Button>
          </NavLink>
          <div
            className="mt-8 flex flex-wrap justify-center lg:justify-start gap-6 sm:gap-8 animate-fade-in"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="text-agentvooc-accent text-sm sm:text-base">
              <span className="font-bold text-lg">agentVooc</span> | ElizaOS
            </div>
            <div className="text-agentvooc-accent text-sm sm:text-base">
              <span>Open-source</span> | <span className="font-bold text-lg">Framework</span>
            </div>
          </div>
        </div>

        {/* Right Side: Three Images in a Row */}
        <div className="lg:w-1/2 flex justify-center lg:justify-end">
  <div className="flex flex-row items-center gap-2 sm:gap-1">
    {images.map((src, index) => (
      <div
        key={index}
        className="relative rounded-lg overflow-hidden shadow-lg transition-transform transform hover:scale-105 hover:shadow-2xl hover:z-10"
      >
        <img
          src={src}
          alt={`Hero image ${index + 1}`}
          className="w-full h-auto object-contain"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/10 hover:bg-black/5" />
      </div>
    ))}
  </div>
</div>
      </div>
    </section>
  );
};