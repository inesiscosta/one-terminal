"use client";
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Terminal, TerminalTheme, DirectoryNode } from 'one-terminal'
import { ArrowRight, Sparkles, Package } from 'lucide-react';
import { Button } from '@/components/Button';

export default function HeroSection({ version = "1.0.0" }: { version?: string }) {
  const { resolvedTheme } = useTheme();
  const [terminalTheme, setTerminalTheme] = useState<'dracula' | 'light'>('dracula');

  useEffect(() => {
    setTerminalTheme(resolvedTheme === 'light' ? 'light' : 'dracula');
  }, [resolvedTheme]);

  const vfs: DirectoryNode = {
    kind: "directory",
    entries: {
      home: {
        kind: "directory",
        entries: {
          demo: {
            kind: "directory",
            entries: {
              Documents: {
                kind: "directory",
                entries: {
                  "notes.txt": {
                    kind: "file",
                    fileType: "text",
                    content: [
                      "# Personal notes",
                      "",
                      "- This is a demo file system for one-terminal.",
                      "- Try running commands like:",
                      "  - ls",
                      "  - cd Documents",
                      "  - cat notes.txt",
                    ].join("\n"),
                  },
                  "todo.txt": {
                    kind: "file",
                    fileType: "text",
                    content: [
                      "# TODO",
                      "",
                      "- Polish terminal demo",
                      "- Add more commands",
                      "- Ship v1.0.0 🚀",
                    ].join("\n"),
                  },
                },
              },
              Downloads: {
                kind: "directory",
                entries: {
                  "one-terminal-demo.zip": {
                    kind: "file",
                    fileType: "text",
                    content:
                      "Binary content omitted. Imagine this is a downloaded archive.",
                  },
                },
              },
              Projects: {
                kind: "directory",
                entries: {
                  "one-terminal": {
                    kind: "directory",
                    entries: {
                      "README.md": {
                        kind: "file",
                        fileType: "text",
                        content: [
                          "# one-terminal",
                          "",
                          "A highly customizable fake terminal component for the web.",
                          "",
                          "## Quick start",
                          "",
                          "npm install one-terminal",
                          "",
                          "Then import it into your React app and pass this VFS as the fileStructure.",
                        ].join("\n"),
                      },
                      "demo.tsx": {
                        kind: "file",
                        fileType: "text",
                        content: [
                          "// Demo entrypoint for one-terminal",
                          "import { Terminal } from \"one-terminal\";",
                          "",
                          "// This is just a placeholder file in the virtual FS.",
                        ].join("\n"),
                      },
                    },
                  },
                },
              },
              ".bashrc": {
                kind: "file",
                fileType: "text",
                content: [
                  "# ~/.bashrc (virtual)",
                  "export EDITOR=nano",
                  "alias ll='ls -alF'",
                  "alias gs='git status'",
                ].join("\n"),
              },
              ".profile": {
                kind: "file",
                fileType: "text",
                content: [
                  "# ~/.profile (virtual)",
                  "PATH=\"$HOME/.local/bin:$PATH\"",
                ].join("\n"),
              },
              "README.txt": {
                kind: "file",
                fileType: "text",
                content: [
                  "Welcome to the one-terminal demo!",
                  "",
                  "Try exploring:",
                  "- /home/demo/Documents",
                  "- /home/demo/Projects",
                  "- /etc",
                  "- /var/log",
                ].join("\n"),
              },
            },
          },
        },
      },

      etc: {
        kind: "directory",
        entries: {
          "motd": {
            kind: "file",
            fileType: "text",
            content: [
              "Welcome to one-terminal!",
              "This is a virtual Linux-like environment for demos.",
            ].join("\n"),
          },
          "hosts": {
            kind: "file",
            fileType: "text",
            content: [
              "127.0.0.1   localhost",
              "127.0.1.1   one-terminal-dev",
            ].join("\n"),
          },
          "one-terminal.conf": {
            kind: "file",
            fileType: "text",
            content: [
              "# one-terminal configuration (virtual)",
              "theme = dracula",
              "prompt = demo@one-terminal:~$",
            ].join("\n"),
          },
        },
      },

      opt: {
        kind: "directory",
        entries: {
          "one-terminal": {
            kind: "directory",
            entries: {
              "config.json": {
                kind: "file",
                fileType: "text",
                content: JSON.stringify(
                  {
                    theme: "dracula",
                    demoMode: true,
                    version: "0.1.0",
                  },
                  null,
                  2,
                ),
              },
            },
          },
        },
      },

      usr: {
        kind: "directory",
        entries: {
          bin: {
            kind: "directory",
            entries: {
              "one-terminal-demo": {
                kind: "file",
                fileType: "text",
                content:
                  "#!/usr/bin/env node\n// Imagine this runs the one-terminal CLI demo.",
              },
            },
          },
          share: {
            kind: "directory",
            entries: {
              "one-terminal": {
                kind: "directory",
                entries: {
                  "LICENSE.txt": {
                    kind: "file",
                    fileType: "text",
                    content: "MIT License (virtual placeholder).",
                  },
                },
              },
            },
          },
        },
      },

      var: {
        kind: "directory",
        entries: {
          log: {
            kind: "directory",
            entries: {
              "syslog": {
                kind: "file",
                fileType: "text",
                content: [
                  "Dec 10 12:00:00 one-terminal demo[1234]: boot complete",
                  "Dec 10 12:00:01 one-terminal demo[1234]: user 'demo' logged in",
                ].join("\n"),
              },
              "one-terminal.log": {
                kind: "file",
                fileType: "text",
                content: [
                  "[info] Initialized virtual filesystem",
                  "[info] Ready for commands",
                ].join("\n"),
              },
            },
          },
        },
      },

      tmp: {
        kind: "directory",
        entries: {
          ".keep": {
            kind: "file",
            fileType: "text",
            content: "Temporary files live here.",
          },
        },
      },

      "README-root.txt": {
        kind: "file",
        fileType: "text",
        content: [
          "You are at the root of the virtual file system.",
          "",
          "Common places to explore:",
          "- /home/demo",
          "- /etc",
          "- /usr",
          "- /var/log",
        ].join("\n"),
      },

      "one-terminal-github.link": {
        kind: "file",
        fileType: "link",
        href: "https://github.com/inesiscosta/one-terminal",
        label: "one-terminal on GitHub",
        target: "_blank",
      },
    },
  };


  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-6 opacity-0 animate-fade-up">
              <Sparkles className="w-4 h-4" />
              <span>v{version} Now Available</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 opacity-0 animate-fade-up delay-100">
              A Fun{' '}
              <span className="text-gradient glow-text">Terminal</span>
              <br />
              For Your Website
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-8 opacity-0 animate-fade-up delay-200">
              Add an interactive terminal easter egg to your portfolio or website.
              Fully customizable themes, commands, and behaviors.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start opacity-0 animate-fade-up delay-300">
              <Button variant="hero" size="lg" asChild>
                <a href="#quickstart" className="flex items-center gap-2">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </a>
              </Button>
              <Button variant="hero-outline" size="lg" asChild>
                <a href="/docs" className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  View Docs
                </a>
              </Button>
            </div>

            {/* Install Command */}
            <div className="mt-8 opacity-0 animate-fade-up delay-400">
              <div className="group relative inline-flex items-center gap-3 px-4 py-2.5 rounded-lg bg-secondary border border-border">
                <span className="text-muted-foreground font-mono text-sm">$</span>
                <code className="font-mono text-sm text-foreground">npm install one-terminal</code>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText('npm install one-terminal');
                    const btn = document.getElementById('hero-copy-btn');
                    if (btn) {
                      btn.classList.add('copied');
                      setTimeout(() => btn.classList.remove('copied'), 2000);
                    }
                  }}
                  id="hero-copy-btn"
                  className="copy-button absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-background/80 backdrop-blur-sm border border-border hover:border-primary/50"
                  aria-label="Copy install command"
                >
                  <svg className="copy-icon w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <svg className="check-icon w-4 h-4 text-terminal-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right Content - Terminal */}
          <div className="relative opacity-0 animate-fade-up delay-200">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-2xl opacity-50" />
            <div className="relative w-full h-96">
              <Terminal
                fileStructure={vfs}
                startPath="/home/demo"
                theme={terminalTheme as Partial<TerminalTheme>} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
