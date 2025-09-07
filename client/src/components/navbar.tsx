import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  return (
    <nav className="bg-agentvooc-primary-bg border-b border-agentvooc-secondary-accent py-4 px-8 flex justify-between items-center sticky top-0 z-50">
      <div className="text-3xl font-semibold text-agentvooc-primary">
        agentVooc <span className="text-agentvooc-accent">.</span>
      </div>
      <div className="flex gap-5">
        {["Home", "Features", "Pricing", "About"].map((link) => (
          <a
            key={link}
            href={`/${link.toLowerCase()}`}
            className="text-agentvooc-primary hover:text-agentvooc-accent transition-colors"
          >
            {link}
          </a>
        ))}
      </div>
      <Button
variant="outline"
className="text-agentvooc-accent border-agentvooc-accent/30 hover:bg-agentvooc-accent hover:text-agentvooc-primary-bg shadow-agentvooc-glow"

        onClick={() => navigate("/auth")}
      >
        Sign Up
      </Button>
    </nav>
  );
}