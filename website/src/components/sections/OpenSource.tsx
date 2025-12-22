"use client";
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Github } from 'lucide-react';
import { Terminal } from 'one-terminal';
import { Button } from '@/components/Button';

export default function FreeSection() {
  const { resolvedTheme } = useTheme();
  const [baseTheme, setBaseTheme] = useState<string>('dracula');

  useEffect(() => {
    setBaseTheme(resolvedTheme === 'light' ? 'light' : 'dracula');
  }, [resolvedTheme]);

  const themeConfig: any = [
    baseTheme,
    { cursor: { shape: "underline" } }
  ];

  const vfs = {
    kind: "directory" as const,
    entries: {
      "LICENSE.md": {
        kind: "file" as const,
        fileType: "text" as const,
        content: "MIT License\n\nCopyright (c) 2024 one-terminal\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction...",
      },
    },
  };

  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Text content */}
          <div className="opacity-0 animate-fade-up">
            <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">
              Free Component
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Open Source MIT Component
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              one-terminal is licensed under an MIT License and it can be used everywhere for free.
              Contribution and feedback are always welcome in the one-terminal repository.
              Go leave me a star there!
            </p>
            <Button variant="hero" asChild>
              <a href="https://github.com/inesiscosta/one-terminal" target="_blank" rel="noopener noreferrer" className="gap-2 inline-flex items-center">
                <Github className="w-5 h-5" />
                Open GitHub
              </a>
            </Button>
          </div>

          {/* Right side*/}
          <div className="opacity-0 animate-fade-up delay-200 h-[275px]">
            <Terminal
              fileStructure={vfs}
              windowChrome={["linux", { titleBarText: "one-terminal" }]}
              theme={themeConfig}
              demo={{
                script: [
                  "cat LICENSE.md",
                ],
                behavior: "loop",
                mode: "run",
                defaultCharDelayMs: 100,
                defaultAfterLineDelayMs: 3000,
              }} />
          </div>
        </div>
      </div>
    </section>
  );
}
