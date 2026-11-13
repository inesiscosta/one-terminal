import { ArrowUpRight } from 'lucide-react';
import { showcase } from '@/data/showcase';

/** Cards linking to sites built with One Terminal. Used on the landing page and in the docs. */
export function ShowcaseList() {
  return (
    <ul className="not-prose grid gap-4 sm:grid-cols-2">
      {showcase.map((site) => (
        <li key={site.url}>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <span className="flex items-center justify-between gap-2 font-semibold text-foreground">
              {site.name}
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">{site.description}</span>
            <span className="mt-auto font-mono text-xs text-muted-foreground">{new URL(site.url).host}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
