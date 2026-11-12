'use client';

// Live versions of the examples in the docs. Each is defined once here so the objects stay stable.

import { useMemo, useState } from 'react';
import type { DirectoryNode, ExtraCommands, FSNode, TerminalDemoConfig } from 'one-terminal';
import { LiveTerminal } from './LiveTerminal';
import { sampleFiles } from './sampleFiles';

const extraCommands: ExtraCommands = {
  hello: {
    description: 'Say hello',
    usage: 'hello [name]',
    run: (args) => `Hello, ${args[0] ?? 'world'}!`,
  },
  upper: {
    description: 'Uppercase piped text',
    run: (args, ctx) => (ctx.stdin ?? args.join(' ')).toUpperCase(),
  },
  contact: {
    description: 'How to reach me',
    run: () => (
      <span>
        Email me at <a href="mailto:hi@example.com">hi@example.com</a> or{' '}
        <span style={{ color: '#ff79c6' }}>find me on GitHub</span>.
      </span>
    ),
  },
  sudo: {
    hidden: true,
    run: (args) => `${args.join(' ') || 'that'}? Nice try. This incident will be reported.`,
  },
};

export function ExtraCommandsDemo() {
  return (
    <LiveTerminal
      extraCommands={extraCommands}
      hint={
        <>
          Try <code>hello &quot;Jack Turner&quot;</code>, <code>cat about.md | upper</code>, <code>contact</code>,{' '}
          <code>help</code> and the hidden <code>sudo rm -rf /</code>.
        </>
      }
    />
  );
}

const typewriterDemo: TerminalDemoConfig = {
  mode: 'type-writer',
  behavior: 'loop',
  script: ['I build web apps.', 'I love open source.', 'I write Rust for fun.'],
  defaultAfterLineDelayMs: 1200,
};

const runDemo: TerminalDemoConfig = {
  script: ['ls', 'cat about.md', 'cd projects', 'tree'],
  behavior: 'interactive',
};

export function DemoModeDemo() {
  return <LiveTerminal demo={runDemo} hint="Runs the script once, then hands the terminal over to you." />;
}

export function TypewriterDemo() {
  return <LiveTerminal height={120} windowChrome="none" prompt="> " demo={typewriterDemo} />;
}

export function NeofetchDemo() {
  return (
    <LiveTerminal
      height={360}
      username="jack"
      hostname="portfolio"
      neofetch={{
        info: {
          Role: 'Software Engineer',
          Location: 'Lisbon, Portugal',
          Languages: 'TypeScript, Rust, Go',
          Contact: "run 'cat about.md'",
        },
      }}
      welcomeMessage="Type 'neofetch'."
    />
  );
}

// ---- Editable files (mkdir, touch, rm, mv) ----

function setNodeAt(root: DirectoryNode, path: string, node: FSNode | null): DirectoryNode {
  const [name, ...rest] = path.split('/').filter(Boolean);
  if (!name) return root;
  const entries = { ...root.entries };
  if (rest.length === 0) {
    if (node) entries[name] = node;
    else delete entries[name];
  } else {
    const child = entries[name];
    if (child?.kind !== 'directory') return root;
    entries[name] = setNodeAt(child, rest.join('/'), node);
  }
  return { ...root, entries };
}

const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/')) || '/';

export function EditableFilesDemo() {
  const [files, setFiles] = useState(sampleFiles);

  const commands = useMemo<ExtraCommands>(
    () => ({
      mkdir: {
        usage: 'mkdir <dir>',
        description: 'Create a directory',
        run: (args, ctx) => {
          if (!args[0]) return 'mkdir: missing operand';
          if (ctx.getNodeAt(args[0])) return `mkdir: ${args[0]}: File exists`;
          const path = ctx.resolvePath(args[0]);
          if (ctx.getNodeAt(parentOf(path))?.kind !== 'directory')
            return `mkdir: ${args[0]}: No such file or directory`;
          setFiles((root) => setNodeAt(root, path, { kind: 'directory', entries: {} }));
        },
      },
      touch: {
        usage: 'touch <file>',
        description: 'Create an empty file',
        run: (args, ctx) => {
          if (!args[0]) return 'touch: missing file operand';
          if (ctx.getNodeAt(args[0])) return;
          const path = ctx.resolvePath(args[0]);
          if (ctx.getNodeAt(parentOf(path))?.kind !== 'directory')
            return `touch: ${args[0]}: No such file or directory`;
          setFiles((root) => setNodeAt(root, path, { kind: 'file', fileType: 'text', content: '' }));
        },
      },
      rm: {
        usage: 'rm [-rf] <path>',
        description: 'Remove a file or directory',
        completion: { mode: 'paths' },
        run: (args, ctx) => {
          const flags = args.filter((a) => a.startsWith('-')).join('');
          const target = args.find((a) => !a.startsWith('-'));
          if (!target) return 'rm: missing operand';
          const node = ctx.getNodeAt(target);
          if (!node) return flags.includes('f') ? undefined : `rm: ${target}: No such file or directory`;
          if (node.kind === 'directory' && !flags.includes('r')) return `rm: ${target}: is a directory`;
          const path = ctx.resolvePath(target);
          setFiles((root) => (path === '/' ? { ...root, entries: {} } : setNodeAt(root, path, null)));
        },
      },
      mv: {
        usage: 'mv <source> <destination>',
        description: 'Move or rename',
        completion: { mode: 'paths' },
        run: ([from, to], ctx) => {
          if (!from || !to) return 'mv: missing operand';
          const node = ctx.getNodeAt(from);
          if (!node) return `mv: ${from}: No such file or directory`;
          const destPath =
            ctx.getNodeAt(to)?.kind === 'directory'
              ? `${ctx.resolvePath(to)}/${ctx.resolvePath(from).split('/').pop()}`
              : ctx.resolvePath(to);
          setFiles((root) => setNodeAt(setNodeAt(root, ctx.resolvePath(from), null), destPath, node));
        },
      },
    }),
    [],
  );

  return (
    <LiveTerminal
      fileStructure={files}
      extraCommands={commands}
      hint={
        <>
          Try <code>mkdir notes</code>, <code>touch notes/todo.txt</code>, <code>mv about.md notes</code>,{' '}
          <code>tree</code>, then <code>rm -rf /</code>. Reload the page to get everything back.
        </>
      }
    />
  );
}

// ---- Theme playground ----

const THEMES = ['dracula', 'monokai', 'solarizedDark', 'solarizedLight', 'light'] as const;
const CHROMES = ['mac', 'windows', 'linux', 'none'] as const;
const CURSORS = ['block', 'beam', 'underline'] as const;

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-16 text-gray-500 dark:text-gray-400">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
            value === option
              ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-black'
              : 'border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-900'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function ThemePlayground() {
  const [theme, setTheme] = useState<(typeof THEMES)[number]>('dracula');
  const [chrome, setChrome] = useState<(typeof CHROMES)[number]>('mac');
  const [cursor, setCursor] = useState<(typeof CURSORS)[number]>('block');

  return (
    <div className="my-6 space-y-2">
      <Choice label="theme" options={THEMES} value={theme} onChange={setTheme} />
      <Choice label="window" options={CHROMES} value={chrome} onChange={setChrome} />
      <Choice label="cursor" options={CURSORS} value={cursor} onChange={setCursor} />
      <LiveTerminal
        height={260}
        theme={[theme, { cursor: { shape: cursor } }]}
        windowChrome={chrome}
        hint={
          <code>{`<Terminal theme={['${theme}', { cursor: { shape: '${cursor}' } }]} windowChrome="${chrome}" />`}</code>
        }
      />
    </div>
  );
}

// ---- Quick start (same files as the code on the Getting Started page) ----

const quickStartFiles: DirectoryNode = {
  kind: 'directory',
  entries: {
    'about.txt': { kind: 'file', fileType: 'text', content: "Hi! I'm a developer who loves terminals." },
    projects: {
      kind: 'directory',
      entries: {
        'one-terminal.md': { kind: 'file', fileType: 'text', content: '# One Terminal\nA React terminal.' },
      },
    },
    'github.lnk': { kind: 'file', fileType: 'link', href: 'https://github.com', label: 'My GitHub' },
  },
};

export function QuickStartDemo() {
  return <LiveTerminal fileStructure={quickStartFiles} welcomeMessage="Type 'help' to get started." />;
}
