import { ArrowRight } from 'lucide-react';
import { Button } from '../Button';
import { CodeBlock } from '../CodeBlock';

const basicUsageCode = `import { Terminal } from "one-terminal";

// Define your virtual file system
const vfs = {
  kind: "directory",
  entries: {
    "readme.txt": {
      kind: "file",
      fileType: "text",
      content: "Welcome to One Terminal 👋",
    },
  },
} as const;

export default function App() {
  return <Terminal fileStructure={vfs} />;
}`;

export default function QuickStartSection() {
  return (
    <section id="quickstart" className="py-24 relative scroll-mt-18">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />

      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left Side*/}
          <div className="space-y-8">
            {/* Install */}
            <div className="opacity-0 animate-fade-up">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">1</span>
                Install
              </h3>
              <CodeBlock code={`npm install one-terminal`} language="bash" />
            </div>

            {/* Basic Usage */}
            <div className="opacity-0 animate-fade-up delay-200">
              <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">2</span>
                Usage
              </h3>
              <CodeBlock code={basicUsageCode} language="tsx" showLineNumbers />
            </div>
          </div>

          {/* Right Side*/}
          <div className="lg:pl-8 opacity-0 animate-fade-up delay-300 mt-0 lg:mt-35 order-first lg:order-none">
            <div>
              <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">
                Installation
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Quick Start
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Get up and running in minutes. The only required prop is{' '}
                <code className="px-2 py-1 rounded bg-secondary text-primary font-mono text-sm">fileStructure</code>{' '}
                which defines your virtual file system.
              </p>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Learn more usage cases and explore advanced configurations in the full documentation.
              </p>
              <Button variant="hero" asChild>
                <a href="/docs" className="gap-2 inline-flex items-center">
                  View Documentation
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
