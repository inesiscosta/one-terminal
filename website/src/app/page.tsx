import Hero from '@/components/sections/Hero';
import Features from '@/components/sections/Features';
import Commands from '@/components/sections/Commands';
import Cutomizable from '@/components/sections/CustomizableSection';
import License from '@/components/sections/OpenSource';
import QuickStart from '@/components/sections/QuickStart';
import Showcase from '@/components/sections/Showcase';
// release-please bumps this when a release is merged, so it always matches the latest published version
import pkg from '../../../package.json';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Hero version={pkg.version} />
      <Features />
      <Commands />
      <Cutomizable />
      <Showcase />
      <License />
      <QuickStart />

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">
            Built with ❤️ by{' '}
            <a
              href="https://github.com/inesiscosta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 transition-colors"
            >
              Inês Costa
            </a>
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            © {new Date().getFullYear()} Inês Costa. Licensed under MIT.
          </p>
        </div>
      </footer>
    </main>
  );
}
