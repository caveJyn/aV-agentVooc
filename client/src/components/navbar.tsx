import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./themeToggle";
import { CardHeader } from "./ui/card";
import { Avatar, AvatarImage } from "./ui/avatar";

export default function Navbar() {
  const navigate = useNavigate();

  return (
  <CardHeader className="flex flex-row py-4 px-4 sm:px-8 justify-between items-center sticky top-0 z-50 shadow-agentvooc-glow w-full max-w-full overflow-x-hidden">
    <div
      className="flex items-center justify-center text-2xl sm:text-3xl font-semibold cursor-pointer hover:text-agentvooc-accent transition-all whitespace-nowrap"
      onClick={() => navigate("/")}
    >
      <Avatar className="size-8 p-1 border rounded-full select-none">
                      <AvatarImage src="/aV-logo.png" />
                    </Avatar>

      agentVooc <span className="text-agentvooc-accent">.</span>
    </div>
    <ul className="flex gap-3 sm:gap-5 ">
      {["Landing", "Blog", "Docs", "Home"].map((link) => (
        <li key={link} className="text-agentvooc-navbar-footer footer-link">
          <a
            href={link === "Home" ? "/home" : link === "Landing" ? "/" : `/company/${link.toLowerCase()}`}
            className=""
          >
            {link}
          </a>
        </li>
      ))}
    </ul>
    <div className="flex items-center gap-2"><ThemeToggle />
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate("/auth")}
      aria-label="Sign Up for agentVooc"
    >
      Sign Up
    </Button>
    </div>
  </CardHeader>
);
}
