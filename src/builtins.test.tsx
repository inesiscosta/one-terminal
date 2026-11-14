import { describe, expect, it, vi } from 'vitest';
import { exitCode, humanSize, runBuiltin, type ExecResult, type ShellEnv } from './builtins';
import { parseCommandLine } from './shell';
import type { DirectoryNode } from './types';

const text = (content: string) => ({ kind: 'file', fileType: 'text', content }) as const;

const fs: DirectoryNode = {
  kind: 'directory',
  entries: {
    'skills.txt': text('Rust\nTypeScript\nrust-analyzer fan\nGo\n'),
    'my file.txt': text('hello world'),
    '.secret': text('shh'),
    projects: {
      kind: 'directory',
      entries: {
        'swate.md': text('# Swate\nA Rust tool'),
        gh: { kind: 'file', fileType: 'link', href: 'https://github.com' },
      },
    },
    empty: { kind: 'directory', entries: {} },
  },
};

function normalize(path: string) {
  const stack: string[] = [];
  for (const part of path.split('/').filter(Boolean)) {
    if (part === '..') stack.pop();
    else if (part !== '.') stack.push(part);
  }
  return '/' + stack.join('/');
}

function makeEnv(overrides: Partial<ShellEnv> = {}): ShellEnv {
  const env: ShellEnv = {
    fs,
    path: '/',
    previousPath: null,
    username: 'ines',
    hostname: 'box',
    shellName: 'zsh',
    startedAt: Date.now(),
    commands: [],
    history: [],
    resolvePath: (p) =>
      !p || p === '.'
        ? env.path
        : p === '~' || p.startsWith('~/')
          ? normalize(p.slice(1))
          : p.startsWith('/')
            ? normalize(p)
            : normalize(`${env.path}/${p}`),
    getNodeAt: (abs) => {
      let node: DirectoryNode | (typeof fs.entries)[string] = env.fs;
      for (const seg of abs.split('/').filter(Boolean)) {
        if (node.kind !== 'directory' || !(seg in node.entries)) return undefined;
        node = node.entries[seg];
      }
      return node;
    },
    changeDir: vi.fn(),
    clearScreen: vi.fn(),
    clearHistory: vi.fn(),
    signal: new AbortController().signal,
    ...overrides,
  };
  return env;
}

/** Runs a (possibly piped) command line and returns stdout + stderr text. */
function sh(line: string, env = makeEnv()) {
  const { pipelines, error } = parseCommandLine(line);
  const stages = pipelines[0]?.stages ?? [];
  if (error) return { out: '', err: [error] };
  let stdin: string | undefined;
  const err: string[] = [];
  let out = '';
  for (const [cmd, ...args] of stages) {
    const result = runBuiltin(cmd, args, stdin, env);
    if (!result) return { out: '', err: [`command not found: ${cmd}`] };
    if (result instanceof Promise) throw new Error(`${cmd} is async; await runBuiltin directly`);
    err.push(...result.err);
    out = result.out;
    stdin = out;
  }
  return { out, err };
}

describe('ls', () => {
  it('hides dotfiles unless -a/-A', () => {
    expect(sh('ls').out).toBe('empty  my file.txt  projects  skills.txt');
    expect(sh('ls -A').out).toContain('.secret');
    expect(sh('ls -a -1').out.split('\n').slice(0, 2)).toEqual(['.', '..']);
  });

  it('supports -l and -F', () => {
    expect(sh('ls -l projects').out).toBe(
      'lrwxrwxrwx 1 ines ines 18 gh -> https://github.com\n-rw-r--r-- 1 ines ines 19 swate.md',
    );
    expect(sh('ls -F').out).toContain('projects/');
  });

  it('shows human-readable sizes with -lh', () => {
    expect(sh('ls -lh').out).toContain('4.0K empty');
    expect(sh('ls -lh skills.txt').out).toContain(' 37 skills.txt');
    expect([1023, 1024, 1536, 10239, 12345, 5 * 1024 ** 2].map(humanSize)).toEqual([
      '1023',
      '1.0K',
      '1.5K',
      '10K',
      '13K',
      '5.0M',
    ]);
  });

  it('resolves ~, .. and quoted paths', () => {
    expect(sh('ls ~/projects').out).toBe('gh  swate.md');
    expect(sh('ls ..', makeEnv({ path: '/projects' })).out).toContain('skills.txt');
    expect(sh('ls "my file.txt"').out).toBe('my file.txt');
  });

  it('reports missing paths and bad flags', () => {
    expect(sh('ls nope').err).toEqual(["ls: cannot access 'nope': No such file or directory"]);
    expect(sh('ls -z').err).toEqual(["ls: invalid option -- 'z'"]);
  });

  it('prints nothing for an empty directory', () => {
    expect(sh('ls empty')).toEqual({ out: '', err: [] });
  });
});

describe('cd', () => {
  it('changes directory', () => {
    const env = makeEnv();
    sh('cd projects', env);
    expect(env.changeDir).toHaveBeenCalledWith('/projects');
  });

  it('goes home with no argument and errors on files', () => {
    const env = makeEnv({ path: '/projects' });
    sh('cd', env);
    expect(env.changeDir).toHaveBeenCalledWith('/');
    expect(sh('cd skills.txt').err).toEqual(['cd: not a directory: skills.txt']);
    expect(sh('cd a b').err).toEqual(['cd: too many arguments']);
  });
});

describe('cat, grep and pipes', () => {
  it('cat reads quoted files and numbers lines', () => {
    expect(sh('cat "my file.txt"').out).toBe('hello world');
    expect(sh('cat -n projects/swate.md').out).toBe('     1\t# Swate\n     2\tA Rust tool');
    expect(sh('cat projects').err).toEqual(['cat: projects: Is a directory']);
  });

  it('grep with flags', () => {
    expect(sh('grep -i "rust" skills.txt').out).toBe('Rust\nrust-analyzer fan');
    expect(sh('grep -n Go skills.txt').out).toBe('4:Go');
    expect(sh('grep -vi rust skills.txt').out).toBe('TypeScript\nGo');
    expect(sh('grep -ci rust skills.txt projects/swate.md').out).toBe('skills.txt:2\nprojects/swate.md:1');
    expect(sh('grep -ri rust').out).toBe(
      'projects/swate.md:A Rust tool\nskills.txt:Rust\nskills.txt:rust-analyzer fan',
    );
    expect(sh('grep -w Ru skills.txt').out).toBe('');
  });

  it('pipes text between commands', () => {
    expect(sh('cat skills.txt | grep -i rust | wc -l').out.trim()).toBe('2');
    expect(sh('echo a b c | wc -w').out.trim()).toBe('3');
    expect(sh('cat skills.txt | head -2').out).toBe('Rust\nTypeScript');
    expect(sh('cat skills.txt | tail -n 1').out).toBe('Go');
    expect(sh('cat skills.txt | nl | head -1').out).toBe('     1\tRust');
  });

  it('sort and uniq', () => {
    expect(sh('sort skills.txt').out).toBe('Go\nRust\nrust-analyzer fan\nTypeScript');
    expect(sh('sort -r skills.txt | head -1').out).toBe('TypeScript');
    expect(sh('echo 10 | cat - | sort -n').out).toBe('10');
    expect(sh('history | sort -n', makeEnv({ history: ['b', 'a', 'b'] })).out).toBe('  1  b\n  2  a\n  3  b');
    const words = makeEnv({
      fs: {
        kind: 'directory',
        entries: { 'w.txt': text('b\na\nb\nB\na\na') },
      },
    });
    expect(sh('sort w.txt | uniq -c', words).out).toBe('      3 a\n      2 b\n      1 B');
    expect(sh('sort -f w.txt | uniq -ci', words).out).toBe('      3 a\n      3 b');
    expect(sh('sort w.txt | uniq -d', words).out).toBe('a\nb');
    expect(sh('sort w.txt | uniq -u', words).out).toBe('B');
    expect(sh('sort -u w.txt', words).out).toBe('a\nb\nB');
    expect(sh('uniq a b').err).toEqual(['uniq: only one input file is supported']);
  });

  it('echo prints arguments with quotes removed', () => {
    expect(sh('echo "cat"').out).toBe('cat');
    expect(sh('echo -n hi').out).toBe('hi');
  });
});

describe('other commands', () => {
  it('tree', () => {
    expect(sh('tree -L 1').out).toBe(
      '.\n├── empty\n├── my file.txt\n├── projects\n└── skills.txt\n\n2 directories, 2 files',
    );
    expect(sh('tree -d').out).toBe('.\n├── empty\n└── projects\n\n2 directories');
    expect(sh('tree -L 0').err[0]).toMatch(/Invalid level/);
  });

  it('history numbering and limits', () => {
    const env = makeEnv({ history: ['ls', 'pwd', 'history 2'] });
    expect(sh('history 2', env).out).toBe('  2  pwd\n  3  history 2');
  });

  it('sleep waits, and stops with status 130 when aborted', async () => {
    vi.useFakeTimers();
    try {
      const done = runBuiltin('sleep', ['1.5'], undefined, makeEnv()) as Promise<unknown>;
      let finished = false;
      done.then(() => (finished = true));
      await vi.advanceTimersByTimeAsync(1499);
      expect(finished).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await done).toMatchObject({ err: [] });

      const controller = new AbortController();
      const long = runBuiltin('sleep', ['2m'], undefined, makeEnv({ signal: controller.signal }));
      controller.abort();
      expect(await long).toMatchObject({ code: 130 });
    } finally {
      vi.useRealTimers();
    }
    expect(sh('sleep x').err).toEqual(["sleep: invalid time interval 'x'"]);
  });

  it('true, false and grep set exit codes', () => {
    const status = (cmd: string, ...args: string[]) =>
      exitCode(runBuiltin(cmd, args, undefined, makeEnv()) as ExecResult);
    expect(status('true')).toBe(0);
    expect(status('false')).toBe(1);
    expect(status('grep', 'Go', 'skills.txt')).toBe(0);
    expect(status('grep', 'nothing', 'skills.txt')).toBe(1);
    expect(status('grep', 'x', 'nope.txt')).toBe(2);
    expect(status('ls', 'nope')).toBe(1);
  });

  it('whoami, pwd and unknown commands', () => {
    expect(sh('whoami').out).toBe('ines');
    expect(sh('pwd', makeEnv({ path: '/projects' })).out).toBe('/projects');
    expect(sh('nope').err).toEqual(['command not found: nope']);
  });

  it('neofetch text output uses custom info', () => {
    const out = sh('neofetch', makeEnv({ neofetch: { info: { Role: 'Engineer' } } })).out;
    expect(out).toBe('ines@box\n--------\nRole: Engineer');
  });
});
