"use client";

import { useState, useEffect } from 'react';
import { Terminal, WindowChromeStyle, CursorShape } from 'one-terminal';
import { Palette, Monitor, Type } from 'lucide-react';

import { useTheme } from 'next-themes';

const themes = [
  { name: 'Dracula', value: 'dracula' as const },
  { name: 'Solarized', value: 'solarizedDark' as const },
  { name: 'Light', value: 'light' as const },
  { name: 'Monokai', value: 'monokai' as const },
];

const cursorStyles: { id: CursorShape; name: string; symbol: string }[] = [
  { id: 'block', name: 'Block', symbol: '▋' },
  { id: 'beam', name: 'Beam', symbol: '|' },
  { id: 'underline', name: 'Underline', symbol: '_' },
];

export default function CustomizableSection() {
  const { resolvedTheme } = useTheme();
  const [chromeStyle, setChromeStyle] = useState<WindowChromeStyle>('windows');
  const [cursorShape, setCursorShape] = useState<CursorShape>('beam');
  const [selectedTheme, setSelectedTheme] = useState(0);

  // Sync with site theme on mount/change
  useEffect(() => {
    if (resolvedTheme === 'light') {
      // Find index of Light
      const lightIndex = themes.findIndex(t => t.value === 'light');
      if (lightIndex !== -1) setSelectedTheme(lightIndex);
    } else {
      // Default to Dracula (index 0) for dark mode
      setSelectedTheme(0);
    }
  }, [resolvedTheme]);

  const vfs = {
    kind: "directory" as const,
    entries: {
      "welcome.md": {
        kind: "file" as const,
        fileType: "text" as const,
        content: "🎨 Customize me!\nTry changing the chrome style, theme, cursor, or prompt.\nFor more customization options, check out our docs!",
      },
    },
  };

  const currentThemeName = themes[selectedTheme].value;
  const themeOverrides: any = {
    cursor: {
      shape: cursorShape,
      blink: true,
    }
  };



  return (
    <section id="customizable" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/20 to-background" />

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16 opacity-0 animate-fade-up">
          <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">
            Make it your own
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Highly Customizable
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto opacity-0 animate-fade-up delay-100">
            Personalize every aspect of the terminal to match your design. Try it below!
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Interactive Terminal Preview */}
          <div className="opacity-0 animate-fade-up delay-200 mb-8">
            <Terminal
              key={`${selectedTheme}-${chromeStyle}-${cursorShape}`}
              fileStructure={vfs}
              windowChrome={chromeStyle}
              theme={currentThemeName ? [currentThemeName, themeOverrides] : themeOverrides}
              style={{ height: "auto", minHeight: "200px", maxHeight: "400px" }}
              demo={{
                script: [
                  "cat welcome.md",
                ],
                behavior: "interactive",
                mode: "run",
                defaultCharDelayMs: 100,
                defaultAfterLineDelayMs: 3000,
              }}
            />
          </div>

          {/* Options */}
          <div className="grid md:grid-cols-3 gap-6 opacity-0 animate-fade-up delay-300">
            {/* Theme */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
                <Palette className="w-4 h-4 text-primary" />
                Theme
              </div>
              <div className="grid grid-cols-2 gap-2">
                {themes.map((theme, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedTheme(index)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${selectedTheme === index
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Window Chrome */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
                <Monitor className="w-4 h-4 text-primary" />
                Window Chrome
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['mac', 'windows', 'linux', 'none'] as WindowChromeStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setChromeStyle(style)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${chromeStyle === style
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Cursor Style */}
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-4 text-foreground font-medium">
                <Type className="w-4 h-4 text-primary" />
                Cursor Style
              </div>
              <div className="grid grid-cols-3 gap-2">
                {cursorStyles.map((cs) => (
                  <button
                    key={cs.id}
                    onClick={() => setCursorShape(cs.id)}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all flex flex-col items-center gap-1 ${cursorShape === cs.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                  >
                    <span className="font-mono text-lg">{cs.symbol}</span>
                    <span className="text-xs">{cs.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
