import { Palette, Command, Layout, Zap, Settings, Puzzle } from 'lucide-react';

const features = [
  {
    icon: <Palette className="w-6 h-6" />,
    title: 'Fully Themeable',
    description: 'Customize colors, fonts, and styles to match your brand. Supports custom CSS variables.',
  },
  {
    icon: <Command className="w-6 h-6" />,
    title: 'Built-in Commands',
    description: 'Ships with essential commands like help, cd, ls, cat, pwd, echo, and clear out of the box.',
  },
  {
    icon: <Layout className="w-6 h-6" />,
    title: 'Window Chrome Options',
    description: 'Choose between macOS, Windows, Linux styles, or no chrome at all.',
  },
  {
    icon: <Settings className="w-6 h-6" />,
    title: 'Customizable Cursor',
    description: 'Block, underline, or beam cursor styles with optional blinking animation.',
  },
  {
    icon: <Puzzle className="w-6 h-6" />,
    title: 'Add Custom Commands',
    description: 'Easily extend with your own commands. Full TypeScript support included.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Lightweight & Fast',
    description: 'Zero dependencies, tree-shakeable, and optimized for performance.',
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative scroll-mt-18">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-16 opacity-0 animate-fade-up">
          <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 opacity-0 animate-fade-up">
            Everything You Need
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto opacity-0 animate-fade-up delay-100">
            A feature-rich terminal component that's easy to integrate and customize for any project.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className="group relative p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 opacity-0 animate-fade-up"
              style={{ animationDelay: `${150 + i * 50}ms` }}
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
