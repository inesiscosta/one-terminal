"use client";

import { useTheme } from 'next-themes';
import { Sun, Moon, Book, Github } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (pathname?.startsWith('/docs')) {
    return null;
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left Side */}
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">one-terminal</span>
        </div>

        {/* Center Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('features')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection('commands')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Commands
          </button>
          <button
            onClick={() => scrollToSection('quickstart')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Quick Start
          </button>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          <a
            href="/docs"
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground rounded-sm border-transparent hover:border-border hover:bg-secondary/50 transition-all duration-200"
          >
            <Book className="w-4 h-4" />
            <span className="hidden sm:inline">Docs</span>
          </a>
          <a
            href="https://github.com/inesiscosta/one-terminal"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm text-foreground rounded-sm border border-transparent hover:border-green-500 hover:bg-secondary/50 transition-all duration-200"
          >
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 text-foreground hover:text-primary transition-colors relative overflow-hidden"
              aria-label="Toggle theme"
            >
              <div className="relative w-4 h-4">
                <Sun className={`w-4 h-4 absolute inset-0 transition-all duration-500 ${theme === 'dark'
                  ? 'rotate-0 opacity-100'
                  : 'rotate-90 opacity-0'
                  }`} />
                <Moon className={`w-4 h-4 absolute inset-0 transition-all duration-500 ${theme === 'dark'
                  ? '-rotate-90 opacity-0'
                  : 'rotate-0 opacity-100'
                  }`} />
              </div>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
