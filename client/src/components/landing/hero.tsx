import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom"; // For navigation to subscription page

interface HeroSection {
  title: string;
  subtitle: string;
  primaryCtaText: string;
  secondaryCtaText?: string;
  trustSignal?: string;
  backgroundImage?: string;
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
    const positions = [...Array(20)].map(() => ({
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 4 + 2}px`,
      height: `${Math.random() * 4 + 2}px`,
      animationDelay: `${Math.random() * 5}s`,
      animationDuration: `${Math.random() * 3 + 2}s`,
    }));
    setStarPositions(positions);
  }, []);

  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-agentvooc-primary-bg via-agentvooc-primary-bg-dark to-agentvooc-secondary-accent">
        <div className="absolute inset-0 bg-black/60" />
      </div>
  {/* ✅ Moved this here: Pulse top-right */}
  <div className="absolute -top-40 -right-32 opacity-5 pointer-events-none z-0">
    <div className="w-96 h-96 bg-agentvooc-accent rounded-full blur-3xl animate-pulse" />
  </div>
      {/* Particle Effect (Stars) */}
      <div className="absolute inset-0 pointer-events-none">
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

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl px-4 flex flex-col md:flex-row items-center">
        {/* Left Half: Text, CTAs, Trust Signals, Pricing Teaser */}
        <div className="md:w-1/2 text-center md:text-left">
          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-4 animate-fade-in"
            style={{
              background:
                "linear-gradient(to right, #ffffff, hsl(var(--agentvooc-accent)))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animationDelay: "0.0s",
              lineHeight: "1.1",
              paddingBottom: "0.2em",
            }}
          >
            {title}
          </h1>
          <p
            className="text-lg md:text-xl lg:text-2xl max-w-2xl text-agentvooc-secondary mb-8 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            {subtitle}
          </p>

          {/* Primary CTA */}
          <NavLink to="/subscriptions">
            <Button
              className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg animate-glow-pulse text-xl px-8 py-4 rounded-full transition-all transform hover:scale-105 animate-fade-in"
              style={{ animationDelay: "0.4s" }}
            >
              {primaryCtaText}
            </Button>
          </NavLink>

          {/* Trust Signals and Metrics */}
          <div
            className="mt-12 flex flex-wrap justify-center md:justify-start gap-8 animate-fade-in"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-agentvooc-accent text-sm md:text-base">
                50K+ Users
              </span>
              <div className="flex -space-x-2">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 bg-agentvooc-secondary-accent rounded-full border-2 border-agentvooc-primary-bg"
                  />
                ))}
              </div>
            </div>
            <div className="text-agentvooc-accent text-sm md:text-base">
              <span className="font-bold text-lg">3x</span> Faster Processing
            </div>
            <div className="text-agentvooc-accent text-sm md:text-base">
              <span className="font-bold text-lg">99.9%</span> Uptime
            </div>
          </div>

          {/* Pricing Teaser (Inspired by Subscriptions Component) */}
          
        </div>

        {/* Right Half: Placeholder for Image or 3D GLB File */}
        <div className="md:w-1/2 flex items-center justify-center">
          <div className="w-full h-96 bg-agentvooc-secondary-accent/20 rounded-lg flex items-center justify-center">
            <p className="text-agentvooc-secondary text-lg">
              [Placeholder for Image or 3D GLB File]
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};