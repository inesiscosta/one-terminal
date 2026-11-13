import { ShowcaseList } from '@/components/ShowcaseList';

export default function ShowcaseSection() {
  return (
    <section id="showcase" className="py-24 relative scroll-mt-18">
      <div className="container mx-auto px-4 relative max-w-4xl">
        <div className="text-center mb-12">
          <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">In the wild</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built with One Terminal</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Some of the sites using One Terminal. Using it too?{' '}
            <a href="/docs/showcase" className="text-primary underline-offset-4 hover:underline">
              Add yours
            </a>
            .
          </p>
        </div>
        <ShowcaseList />
      </div>
    </section>
  );
}
