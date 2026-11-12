import React from 'react';
import type {
  FSNode,
  DirectoryNode,
  FileNode,
  CommandInfo,
  ExtraCommands,
  ExtraCommandFileScope,
  NeofetchConfig,
} from './types';
import { parseOptions } from './shell';

// ---------- Node helpers ----------

export function isDirectory(node: FSNode | undefined | null): node is DirectoryNode {
  return !!node && typeof node === 'object' && node.kind === 'directory';
}

export function isFile(node: FSNode | undefined | null): node is FileNode {
  return !!node && typeof node === 'object' && node.kind === 'file';
}

export function isTextFile(node: FSNode | undefined | null): node is FileNode & { fileType: 'text' } {
  return isFile(node) && node.fileType === 'text';
}

export function isLinkFile(node: FSNode | undefined | null): node is FileNode & { fileType: 'link' } {
  return isFile(node) && node.fileType === 'link';
}

const isHidden = (name: string) => name.startsWith('.');

// ---------- Command metadata ----------

type BuiltinHelp = { usage: string; description: string; details?: string; scope?: ExtraCommandFileScope };

// Order = order in `help`
export const BUILTIN_HELP: Record<string, BuiltinHelp> = {
  help: { usage: 'help [command]', description: 'Show commands, or help for one' },
  ls: {
    usage: 'ls [-al] [path...]',
    description: 'List directory contents',
    details:
      '  -a   Include hidden entries (and . ..)\n  -A   Include hidden entries\n  -l   Long listing\n  -h   With -l, human-readable sizes (4.0K)\n  -1   One entry per line\n  -F   Mark directories with /',
    scope: 'any',
  },
  cd: {
    usage: 'cd [dir]',
    description: 'Change the current directory',
    details: "With no argument, goes home (~). 'cd -' goes back to the previous directory.",
    scope: 'directories',
  },
  pwd: { usage: 'pwd', description: 'Print the current directory' },
  tree: {
    usage: 'tree [-ad] [-L n] [path]',
    description: 'Show the directory structure',
    details:
      '  -a     Include hidden entries\n  -d     List directories only\n  -L n   Descend at most n directories deep',
    scope: 'directories',
  },
  cat: {
    usage: 'cat [-n] [file...]',
    description: 'Print the contents of files',
    details: '  -n   Number all lines',
    scope: 'files',
  },
  grep: {
    usage: 'grep [-inv] pattern [file]',
    description: 'Find lines matching a pattern',
    details:
      "  -i   Ignore case\n  -n   Show line numbers\n  -v   Show lines that don't match\n  -c   Count matching lines\n  -l   Only list matching files\n  -w   Match whole words\n  -r   Search directories recursively\n  -F   Treat the pattern as plain text",
    scope: 'any',
  },
  head: { usage: 'head [-n N] [file]', description: 'Show the first lines', scope: 'files' },
  tail: { usage: 'tail [-n N] [file]', description: 'Show the last lines', scope: 'files' },
  wc: {
    usage: 'wc [-lwc] [file...]',
    description: 'Count lines, words and characters',
    details: '  -l   Lines\n  -w   Words\n  -c   Characters',
    scope: 'files',
  },
  nl: { usage: 'nl [file...]', description: 'Number lines', scope: 'files' },
  echo: { usage: 'echo [text...]', description: 'Print text to the terminal' },
  whoami: { usage: 'whoami', description: 'Print the current user' },
  neofetch: { usage: 'neofetch', description: 'Show system info' },
  history: {
    usage: 'history [-c] [n]',
    description: 'Show previously run commands',
    details:
      '  -c   Clear the history\n  n    Show only the last n commands\n\nRe-run commands with !! (last), !n (number n), !-n (n back), !abc (last starting\nwith abc), !$ (last argument) or ^old^new (last command with old replaced).',
  },
  sleep: {
    usage: 'sleep <seconds>',
    description: 'Wait for a while (Ctrl+C stops)',
    details: "Accepts decimals and the suffixes s, m and h, e.g. 'sleep 1.5' or 'sleep 2m'.",
  },
  clear: { usage: 'clear', description: 'Clear the terminal screen' },
};

export const BUILTIN_COMMANDS = Object.keys(BUILTIN_HELP);

export const SHORTCUTS: [string, string][] = [
  ['Tab', 'Complete commands and paths'],
  ['Up/Down, Ctrl+P/N', 'Browse history'],
  ['Ctrl+R / Ctrl+S', 'Search history (Ctrl+G cancels)'],
  ['Ctrl+C', 'Cancel line or running command'],
  ['Ctrl+L', 'Clear the screen'],
  ['Ctrl+A / Ctrl+E', 'Jump to start / end of line'],
  ['Ctrl+U / Ctrl+W', 'Delete line / previous word'],
  ['!! / !n', 'Re-run last command / command n'],
];

export function getPathCompletionScope(cmd: string, extraCommands?: ExtraCommands): ExtraCommandFileScope {
  const def = extraCommands?.[cmd];
  if (def) {
    if ((def.completion?.mode ?? 'none') === 'none') return 'none';
    return def.completion?.fileScope ?? 'any';
  }
  return BUILTIN_HELP[cmd]?.scope ?? 'none';
}

// ---------- Execution ----------

export type ExecResult = {
  /** Plain-text output; this is what gets piped to the next command. */
  out: string;
  /** Rich output shown instead of `out` when this is the last command. */
  node?: React.ReactNode;
  /** Error messages (shown even mid-pipeline). */
  err: string[];
};

export type ShellEnv = {
  fs: DirectoryNode;
  path: string;
  previousPath: string | null;
  username: string;
  hostname: string;
  shellName: string;
  accentColor?: string;
  neofetch?: NeofetchConfig;
  startedAt: number;
  commands: CommandInfo[];
  history: string[];
  extraCommands?: ExtraCommands;
  resolvePath: (p: string) => string;
  getNodeAt: (absPath: string) => FSNode | undefined;
  changeDir: (absPath: string) => void;
  clearScreen: () => void;
  clearHistory: () => void;
  startBusy: (ms: number) => void;
};

const ok = (out: string, node?: React.ReactNode): ExecResult => ({ out, node, err: [] });
const fail = (...err: string[]): ExecResult => ({ out: '', err });

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function splitLines(text: string): string[] {
  if (text === '') return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function fileText(node: FileNode): string {
  return isTextFile(node) ? node.content : node.href;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Sizes like GNU `ls -h`: 37, 4.0K, 13K, 2.1M (always rounded up). */
export function humanSize(bytes: number): string {
  const units = ['K', 'M', 'G', 'T'];
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  if (unit < 0) return String(bytes);
  if (value < 10) {
    const rounded = Math.ceil(value * 10) / 10;
    // 9.95K rounds up to 10K, which is shown without a decimal
    return rounded < 10 ? `${rounded.toFixed(1)}${units[unit]}` : `10${units[unit]}`;
  }
  return `${Math.ceil(value)}${units[unit]}`;
}

type Source = { name: string; text: string };

/** Reads file operands, or stdin when there are none. */
function readSources(
  cmd: string,
  operands: string[],
  stdin: string | undefined,
  env: ShellEnv,
): { sources: Source[]; err: string[] } | null {
  if (!operands.length) return stdin === undefined ? null : { sources: [{ name: '', text: stdin }], err: [] };

  const sources: Source[] = [];
  const err: string[] = [];
  for (const name of operands) {
    const node = env.getNodeAt(env.resolvePath(name));
    if (!node) err.push(`${cmd}: ${name}: No such file or directory`);
    else if (isDirectory(node)) err.push(`${cmd}: ${name}: Is a directory`);
    else sources.push({ name, text: fileText(node) });
  }
  return { sources, err };
}

function parseDuration(raw: string): number | null {
  const match = /^(\d+(?:\.\d*)?|\.\d+)([smh]?)$/.exec(raw);
  if (!match) return null;
  const factor = match[2] === 'm' ? 60 : match[2] === 'h' ? 3600 : 1;
  return Number(match[1]) * factor * 1000;
}

const COLORS = {
  match: '#ff5555',
  file: '#bd93f9',
  lineNumber: '#50fa7b',
  separator: '#8be9fd',
};

const joinLines = (nodes: React.ReactNode[]) =>
  nodes.map((n, i) => (
    <React.Fragment key={i}>
      {i > 0 && '\n'}
      {n}
    </React.Fragment>
  ));

// ---------- Commands ----------

function help(args: string[], env: ShellEnv): ExecResult {
  const topic = args[0];
  if (topic) {
    const extra = env.extraCommands?.[topic];
    const builtin = BUILTIN_HELP[topic];
    const entry =
      extra && !extra.hidden
        ? { usage: extra.usage ?? topic, description: extra.description, details: extra.details }
        : !extra && builtin
          ? builtin
          : null;
    if (!entry) return fail(`help: no help topics match '${topic}'. Try 'help' to list commands.`);
    return ok(
      [`${topic}: ${entry.usage}`, entry.description && `    ${entry.description}`, entry.details]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const width = Math.max(...env.commands.map((c) => c.usage.length), ...SHORTCUTS.map(([k]) => k.length)) + 3;
  const row = (left: string, right: string) => `  ${left.padEnd(width)}${right}`.trimEnd();
  const section = (title: string, items: CommandInfo[]) =>
    items.length ? [title, ...items.map((c) => row(c.usage, c.description))] : [];
  const custom = env.commands.filter((c) => !c.builtin);

  return ok(
    [
      ...section(
        'Commands:',
        env.commands.filter((c) => c.builtin),
      ),
      ...(custom.length ? ['', ...section('More commands:', custom)] : []),
      '',
      'Shortcuts:',
      ...SHORTCUTS.map(([keys, what]) => row(keys, what)),
      '',
      "Pipe commands together with |, e.g. 'history | tail -5'.",
      "Type 'help <command>' for more about a command.",
    ].join('\n'),
  );
}

function ls(args: string[], env: ShellEnv): ExecResult {
  const opts = parseOptions('ls', args, { flags: 'aAl1hF' });
  if (opts.error) return fail(opts.error);

  const { flags } = opts;
  const showAll = flags.has('a');
  const showHidden = showAll || flags.has('A');
  const targets = opts.operands.length ? opts.operands : ['.'];
  const err: string[] = [];
  const files: [string, FSNode][] = [];
  const dirs: [string, DirectoryNode][] = [];

  for (const target of targets) {
    const node = env.getNodeAt(env.resolvePath(target));
    if (!node) err.push(`ls: cannot access '${target}': No such file or directory`);
    else if (isDirectory(node)) dirs.push([target, node]);
    else files.push([target, node]);
  }

  const decorate = (name: string, node: FSNode) =>
    flags.has('F') ? name + (isDirectory(node) ? '/' : isLinkFile(node) ? '@' : '') : name;

  const format = (items: [string, FSNode][]) => {
    if (flags.has('l')) {
      const sizes = items.map(([, node]) => {
        const bytes = isDirectory(node)
          ? 4096
          : isTextFile(node)
            ? byteLength(node.content)
            : (node as FileNode & { href: string }).href.length;
        return flags.has('h') ? humanSize(bytes) : String(bytes);
      });
      const width = Math.max(0, ...sizes.map((s) => s.length));
      return items
        .map(([name, node], i) => {
          const mode = isDirectory(node) ? 'drwxr-xr-x' : isLinkFile(node) ? 'lrwxrwxrwx' : '-rw-r--r--';
          const label = decorate(name, node) + (isLinkFile(node) ? ` -> ${node.href}` : '');
          return `${mode} 1 ${env.username} ${env.username} ${sizes[i].padStart(width)} ${label}`;
        })
        .join('\n');
    }
    const names = items.map(([name, node]) => decorate(name, node));
    return names.join(flags.has('1') ? '\n' : '  ');
  };

  const blocks: string[] = [];
  if (files.length) blocks.push(format(files));
  for (const [name, dir] of dirs) {
    const entries: [string, FSNode][] = Object.entries(dir.entries)
      .filter(([entry]) => showHidden || !isHidden(entry))
      .sort(([a], [b]) => a.localeCompare(b));
    if (showAll) entries.unshift(['.', dir], ['..', dir]);
    const listing = format(entries);
    blocks.push(targets.length > 1 ? `${name}:${listing ? `\n${listing}` : ''}` : listing);
  }

  return { out: blocks.filter((b) => b !== '').join('\n\n'), err };
}

function cd(args: string[], env: ShellEnv): ExecResult {
  if (args.length > 1) return fail('cd: too many arguments');
  const target = args[0] ?? '~';

  if (target === '-') {
    if (!env.previousPath) return fail('cd: OLDPWD not set');
    if (!isDirectory(env.getNodeAt(env.previousPath)))
      return fail(`cd: ${env.previousPath}: No such file or directory`);
    const prev = env.previousPath;
    env.changeDir(prev);
    return ok(prev);
  }

  const abs = env.resolvePath(target);
  const node = env.getNodeAt(abs);
  if (!node) return fail(`cd: ${target}: No such file or directory`);
  if (!isDirectory(node)) return fail(`cd: not a directory: ${target}`);
  env.changeDir(abs);
  return ok('');
}

function cat(args: string[], stdin: string | undefined, env: ShellEnv): ExecResult {
  const opts = parseOptions('cat', args, { flags: 'n' });
  if (opts.error) return fail(opts.error);
  if (!opts.operands.length && stdin === undefined) return fail('cat: missing file operand');

  const err: string[] = [];
  const texts: string[] = [];
  const nodes: React.ReactNode[] = [];
  let hasLink = false;

  if (!opts.operands.length) {
    texts.push(stdin!);
    nodes.push(stdin!);
  }

  for (const name of opts.operands) {
    const node = env.getNodeAt(env.resolvePath(name));
    if (!node) err.push(`cat: ${name}: No such file or directory`);
    else if (isDirectory(node)) err.push(`cat: ${name}: Is a directory`);
    else if (isLinkFile(node)) {
      hasLink = true;
      texts.push(node.href);
      nodes.push(
        <a href={node.href} target={node.target ?? '_blank'} rel="noreferrer">
          {node.label ?? node.href}
        </a>,
      );
    } else if (isTextFile(node)) {
      texts.push(node.content);
      nodes.push(node.content);
    }
  }

  if (opts.flags.has('n')) {
    const lines = splitLines(texts.join('\n'));
    return { out: lines.map((l, i) => `${String(i + 1).padStart(6)}\t${l}`).join('\n'), err };
  }

  return { out: texts.join('\n'), node: hasLink ? joinLines(nodes) : undefined, err };
}

function grep(args: string[], stdin: string | undefined, env: ShellEnv): ExecResult {
  const opts = parseOptions('grep', args, { flags: 'invclwrEF' });
  if (opts.error) return fail(opts.error);

  const { flags } = opts;
  const [pattern, ...files] = opts.operands;
  if (pattern === undefined) return fail('usage: grep [-icnvlwrF] pattern [file ...]');

  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let source = flags.has('F') ? escaped : pattern;
  if (flags.has('w')) source = `\\b(?:${source})\\b`;
  let test: RegExp;
  let global: RegExp;
  try {
    test = new RegExp(source, flags.has('i') ? 'i' : '');
    global = new RegExp(source, flags.has('i') ? 'gi' : 'g');
  } catch {
    test = new RegExp(escaped, flags.has('i') ? 'i' : '');
    global = new RegExp(escaped, flags.has('i') ? 'gi' : 'g');
  }

  const err: string[] = [];
  let sources: Source[] = [];

  const walk = (name: string, dir: DirectoryNode) => {
    for (const [entry, node] of Object.entries(dir.entries).sort(([a], [b]) => a.localeCompare(b))) {
      const full = name === '.' ? entry : `${name.replace(/\/$/, '')}/${entry}`;
      if (isDirectory(node)) walk(full, node);
      else sources.push({ name: full, text: fileText(node) });
    }
  };

  if (!files.length && (flags.has('r') || stdin === undefined)) {
    if (!flags.has('r')) return fail('usage: grep [-icnvlwrF] pattern [file ...]');
    walk('.', env.getNodeAt(env.path) as DirectoryNode);
  } else if (!files.length) {
    sources = [{ name: '', text: stdin! }];
  }

  for (const name of files) {
    const node = env.getNodeAt(env.resolvePath(name));
    if (!node) err.push(`grep: ${name}: No such file or directory`);
    else if (isDirectory(node)) {
      if (flags.has('r')) walk(name, node);
      else err.push(`grep: ${name}: Is a directory`);
    } else sources.push({ name, text: fileText(node) });
  }

  const showNames = sources.length > 1 || flags.has('r');
  const texts: string[] = [];
  const nodes: React.ReactNode[] = [];
  const sep = <span style={{ color: COLORS.separator }}>:</span>;

  const highlight = (line: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let last = 0;
    for (const m of line.matchAll(global)) {
      if (!m[0]) continue;
      parts.push(line.slice(last, m.index));
      parts.push(
        <span key={m.index} style={{ color: COLORS.match, fontWeight: 'bold' }}>
          {m[0]}
        </span>,
      );
      last = m.index! + m[0].length;
    }
    parts.push(line.slice(last));
    return parts;
  };

  for (const { name, text } of sources) {
    const lines = splitLines(text);
    const matches = lines
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => test.test(line) !== flags.has('v'));
    const nameNode =
      showNames && name ? (
        <>
          <span style={{ color: COLORS.file }}>{name}</span>
          {sep}
        </>
      ) : null;
    const namePrefix = showNames && name ? `${name}:` : '';

    if (flags.has('l')) {
      if (matches.length) {
        texts.push(name || '(standard input)');
        nodes.push(<span style={{ color: COLORS.file }}>{name || '(standard input)'}</span>);
      }
      continue;
    }
    if (flags.has('c')) {
      texts.push(`${namePrefix}${matches.length}`);
      nodes.push(
        <>
          {nameNode}
          {matches.length}
        </>,
      );
      continue;
    }
    for (const { line, n } of matches) {
      const numPrefix = flags.has('n') ? `${n}:` : '';
      texts.push(`${namePrefix}${numPrefix}${line}`);
      nodes.push(
        <>
          {nameNode}
          {flags.has('n') && (
            <>
              <span style={{ color: COLORS.lineNumber }}>{n}</span>
              {sep}
            </>
          )}
          {flags.has('v') ? line : highlight(line)}
        </>,
      );
    }
  }

  return { out: texts.join('\n'), node: nodes.length ? joinLines(nodes) : undefined, err };
}

function headTail(cmd: 'head' | 'tail', args: string[], stdin: string | undefined, env: ShellEnv): ExecResult {
  const opts = parseOptions(cmd, args, { valued: 'n', numericShorthand: 'n' });
  if (opts.error) return fail(opts.error);
  const count = opts.values.n === undefined ? 10 : Number(opts.values.n);
  if (!Number.isInteger(count) || count < 0) return fail(`${cmd}: invalid number of lines: '${opts.values.n}'`);

  const read = readSources(cmd, opts.operands, stdin, env);
  if (!read) return fail(`${cmd}: missing file operand`);

  const blocks = read.sources.map(({ name, text }) => {
    const lines = splitLines(text);
    const picked = cmd === 'head' ? lines.slice(0, count) : count === 0 ? [] : lines.slice(-count);
    const body = picked.join('\n');
    return read.sources.length > 1 ? `==> ${name} <==\n${body}` : body;
  });
  return { out: blocks.join('\n\n'), err: read.err };
}

function wc(args: string[], stdin: string | undefined, env: ShellEnv): ExecResult {
  const opts = parseOptions('wc', args, { flags: 'lwc' });
  if (opts.error) return fail(opts.error);
  const read = readSources('wc', opts.operands, stdin, env);
  if (!read) return fail('wc: missing file operand');

  const { flags } = opts;
  const all = !flags.size;
  const counts = read.sources.map(({ name, text }) => ({
    name,
    l: splitLines(text).length,
    w: text.split(/\s+/).filter(Boolean).length,
    c: byteLength(text),
  }));
  if (counts.length > 1) {
    counts.push(
      counts.reduce((t, c) => ({ name: 'total', l: t.l + c.l, w: t.w + c.w, c: t.c + c.c }), {
        name: 'total',
        l: 0,
        w: 0,
        c: 0,
      }),
    );
  }

  const out = counts
    .map((c) => {
      const cols = (['l', 'w', 'c'] as const).filter((k) => all || flags.has(k)).map((k) => String(c[k]).padStart(7));
      return `${cols.join(' ')}${c.name ? ` ${c.name}` : ''}`;
    })
    .join('\n');
  return { out, err: read.err };
}

function nl(args: string[], stdin: string | undefined, env: ShellEnv): ExecResult {
  const opts = parseOptions('nl', args);
  if (opts.error) return fail(opts.error);
  const read = readSources('nl', opts.operands, stdin, env);
  if (!read) return fail('nl: missing file operand');

  let n = 0;
  const lines = splitLines(read.sources.map((s) => s.text).join('\n')).map((line) =>
    line.trim() ? `${String(++n).padStart(6)}\t${line}` : '',
  );
  return { out: lines.join('\n'), err: read.err };
}

function tree(args: string[], env: ShellEnv): ExecResult {
  const opts = parseOptions('tree', args, { flags: 'ad', valued: 'L' });
  if (opts.error) return fail(opts.error);

  const maxDepth = opts.values.L === undefined ? Infinity : Number(opts.values.L);
  if (!Number.isInteger(maxDepth) && maxDepth !== Infinity) return fail('tree: Invalid level, must be greater than 0.');
  if (maxDepth < 1) return fail('tree: Invalid level, must be greater than 0.');

  const dirsOnly = opts.flags.has('d');
  const showHidden = opts.flags.has('a');
  const counts = { dirs: 0, files: 0 };
  const lines: string[] = [];

  const render = (dir: DirectoryNode, prefix: string, depth: number) => {
    if (depth > maxDepth) return;
    const entries = Object.entries(dir.entries)
      .filter(([name, node]) => (showHidden || !isHidden(name)) && (!dirsOnly || isDirectory(node)))
      .sort(([a], [b]) => a.localeCompare(b));

    entries.forEach(([name, node], index) => {
      const isLast = index === entries.length - 1;
      lines.push(`${prefix}${isLast ? '└── ' : '├── '}${isLinkFile(node) ? `${name} -> ${node.href}` : name}`);
      if (isDirectory(node)) {
        counts.dirs++;
        render(node, prefix + (isLast ? '    ' : '│   '), depth + 1);
      } else {
        counts.files++;
      }
    });
  };

  const targets = opts.operands.length ? opts.operands : ['.'];
  targets.forEach((target, index) => {
    if (index > 0) lines.push('');
    const node = env.getNodeAt(env.resolvePath(target));
    lines.push(isDirectory(node) ? target : `${target}  [error opening dir]`);
    if (isDirectory(node)) render(node, '', 1);
    else if (node) counts.files++;
  });

  lines.push('');
  lines.push(
    dirsOnly
      ? plural(counts.dirs, 'directory', 'directories')
      : `${plural(counts.dirs, 'directory', 'directories')}, ${plural(counts.files, 'file', 'files')}`,
  );
  return ok(lines.join('\n'));
}

function history(args: string[], env: ShellEnv): ExecResult {
  const opts = parseOptions('history', args, { flags: 'c' });
  if (opts.error) return fail(opts.error);
  if (opts.flags.has('c')) {
    env.clearHistory();
    return ok('');
  }

  let start = 0;
  if (opts.operands[0] !== undefined) {
    const n = Number(opts.operands[0]);
    if (!Number.isInteger(n) || n < 0) return fail(`history: ${opts.operands[0]}: numeric argument required`);
    start = Math.max(0, env.history.length - n);
  }

  const width = String(env.history.length).length;
  return ok(
    env.history
      .map((c, i) => `  ${String(i + 1).padStart(width)}  ${c}`)
      .slice(start)
      .join('\n'),
  );
}

function sleep(args: string[], env: ShellEnv): ExecResult {
  if (!args.length) return fail('sleep: missing operand');
  let total = 0;
  for (const arg of args) {
    const ms = parseDuration(arg);
    if (ms === null) return fail(`sleep: invalid time interval '${arg}'`);
    total += ms;
  }
  env.startBusy(total);
  return ok('');
}

export const DEFAULT_NEOFETCH_LOGO = [
  ' .-----------------.',
  ' | .-------------. |',
  ' | | >_          | |',
  ' | |             | |',
  ' | |             | |',
  " | '-------------' |",
  " '-------. .-------'",
  "     .---' '---.",
  "     '---------'",
].join('\n');

const PALETTE = ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2'];

function formatUptime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return plural(secs, 'sec', 'secs');
  const mins = Math.floor(secs / 60);
  if (mins < 60) return plural(mins, 'min', 'mins');
  return `${plural(Math.floor(mins / 60), 'hour', 'hours')}, ${plural(mins % 60, 'min', 'mins')}`;
}

function countFiles(dir: DirectoryNode): number {
  return Object.values(dir.entries).reduce((n, node) => n + (isDirectory(node) ? countFiles(node) : 1), 0);
}

function neofetch(env: ShellEnv): ExecResult {
  const config = env.neofetch ?? {};
  const logo = config.logo ?? DEFAULT_NEOFETCH_LOGO;
  const info: [string, string][] = config.info
    ? Object.entries(config.info)
    : [
        ['OS', 'one-terminal'],
        ['Host', env.hostname],
        ['Shell', env.shellName],
        ['Uptime', formatUptime(Date.now() - env.startedAt)],
        ...(typeof window !== 'undefined' && window.screen
          ? [['Resolution', `${window.screen.width}x${window.screen.height}`] as [string, string]]
          : []),
        ['Commands', String(env.commands.length)],
        ['Files', String(countFiles(env.fs))],
      ];

  const title = `${env.username}@${env.hostname}`;
  const accent = { color: env.accentColor, fontWeight: 'bold' } as const;
  const text = [title, '-'.repeat(title.length), ...info.map(([k, v]) => `${k}: ${v}`)].join('\n');

  const node = (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '3ch', whiteSpace: 'pre', wordBreak: 'normal' }}>
      <div style={{ color: env.accentColor }}>{logo}</div>
      <div>
        <div>
          <span style={accent}>{env.username}</span>@<span style={accent}>{env.hostname}</span>
        </div>
        <div>{'-'.repeat(title.length)}</div>
        {info.map(([key, value]) => (
          <div key={key} style={{ whiteSpace: 'pre-wrap' }}>
            <span style={accent}>{key}</span>: {value}
          </div>
        ))}
        {config.colors !== false && (
          <div style={{ display: 'flex', marginTop: '0.6em' }}>
            {PALETTE.map((color) => (
              <span key={color} style={{ background: color, width: '3ch', height: '1.2em', display: 'inline-block' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return ok(text, node);
}

/** Runs a built-in command, or returns null if `cmd` isn't one. */
export function runBuiltin(cmd: string, args: string[], stdin: string | undefined, env: ShellEnv): ExecResult | null {
  switch (cmd) {
    case 'help':
      return help(args, env);
    case 'ls':
      return ls(args, env);
    case 'cd':
      return cd(args, env);
    case 'pwd':
      return ok(env.path);
    case 'tree':
      return tree(args, env);
    case 'cat':
      return cat(args, stdin, env);
    case 'grep':
      return grep(args, stdin, env);
    case 'head':
    case 'tail':
      return headTail(cmd, args, stdin, env);
    case 'wc':
      return wc(args, stdin, env);
    case 'nl':
      return nl(args, stdin, env);
    case 'echo': {
      let i = 0;
      while (i < args.length && /^-[neE]+$/.test(args[i])) i++;
      return ok(args.slice(i).join(' '));
    }
    case 'whoami':
      return ok(env.username);
    case 'neofetch':
      return neofetch(env);
    case 'history':
      return history(args, env);
    case 'sleep':
      return sleep(args, env);
    case 'clear':
      env.clearScreen();
      return ok('');
    default:
      return null;
  }
}
