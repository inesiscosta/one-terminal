import { Terminal, FolderTree, Folder, FileText, MapPin, MessageSquare, Trash2, HelpCircle, ChevronRight } from 'lucide-react';

const commands = [
  { name: 'help', description: 'Display available commands', icon: HelpCircle, color: 'text-terminal-cyan' },
  { name: 'cd', description: 'Navigate between directories', icon: ChevronRight, color: 'text-terminal-green' },
  { name: 'ls', description: 'List directory contents', icon: Folder, color: 'text-terminal-yellow' },
  { name: 'tree', description: 'Display directory structure in a tree-like format', icon: FolderTree, color: 'text-terminal-green' },
  { name: 'cat', description: 'Display file contents', icon: FileText, color: 'text-terminal-purple' },
  { name: 'pwd', description: 'Print working directory', icon: MapPin, color: 'text-terminal-cyan' },
  { name: 'echo', description: 'Output text to terminal', icon: MessageSquare, color: 'text-terminal-green' },
  { name: 'clear', description: 'Clear terminal screen', icon: Trash2, color: 'text-terminal-red' },
];

export default function CommandsSection() {
  return (
    <section id="commands" className="py-24 scroll-mt-30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 opacity-0 animate-fade-up">
          <span className="text-sm font-medium text-primary uppercase tracking-wider mb-4 block">
            Out the box
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Built-in Commands
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto opacity-0 animate-fade-up delay-100">
            Everything you need for a realistic terminal experience, ready to use out of the box.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {commands.map((cmd, i) => (
            <div
              key={cmd.name}
              className="command-card group flex items-center gap-3 p-4 rounded-lg bg-secondary/50 border border-border hover:bg-secondary opacity-0 animate-slide-in-left"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`${cmd.color} group-hover:scale-110 transition-transform`}>
                <cmd.icon className="w-5 h-5" />
              </div>
              <div>
                <code className="font-mono text-sm text-primary font-medium">{cmd.name}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
