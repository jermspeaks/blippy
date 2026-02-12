"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // next-themes: avoid hydration mismatch (no theme on SSR)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled>
          Light
        </Button>
        <Button variant="outline" size="sm" disabled>
          Dark
        </Button>
        <Button variant="outline" size="sm" disabled>
          System
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Theme selection">
      <Button
        variant={theme === "light" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("light")}
        className="inline-flex items-center gap-2"
        aria-pressed={theme === "light"}
      >
        <Sun className="size-4" />
        Light
      </Button>
      <Button
        variant={theme === "dark" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("dark")}
        className="inline-flex items-center gap-2"
        aria-pressed={theme === "dark"}
      >
        <Moon className="size-4" />
        Dark
      </Button>
      <Button
        variant={theme === "system" ? "secondary" : "outline"}
        size="sm"
        onClick={() => setTheme("system")}
        className="inline-flex items-center gap-2"
        aria-pressed={theme === "system"}
      >
        <Monitor className="size-4" />
        System
      </Button>
    </div>
  );
}
