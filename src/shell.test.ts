import { describe, expect, it } from 'vitest';
import {
  EXIT_STATUS,
  expandHistory,
  getCompletionContext,
  lastArgument,
  parseCommandLine,
  parseOptions,
  quoteArg,
} from './shell';

describe('parseCommandLine', () => {
  const words = (line: string) => parseCommandLine(line).pipelines.flatMap((p) => p.stages);

  it('splits on whitespace', () => {
    expect(words('ls   -la  projects')).toEqual([['ls', '-la', 'projects']]);
  });

  it('removes quotes', () => {
    expect(words('echo "cat"')).toEqual([['echo', 'cat']]);
    expect(words('cat "my file.txt"')).toEqual([['cat', 'my file.txt']]);
    expect(words("echo 'single $x'")).toEqual([['echo', 'single $x']]);
    expect(words('echo ""')).toEqual([['echo', '']]);
  });

  it('handles escapes', () => {
    expect(words('cat my\\ file.txt')).toEqual([['cat', 'my file.txt']]);
    expect(words('echo "say \\"hi\\""')).toEqual([['echo', 'say "hi"']]);
    expect(words("echo 'no \\escape'")).toEqual([['echo', 'no \\escape']]);
    expect(words('echo foo\\')).toEqual([['echo', 'foo\\']]);
  });

  it('joins adjacent quoted parts into one word', () => {
    expect(words('echo a"b c"d')).toEqual([['echo', 'ab cd']]);
  });

  it('splits pipelines but not quoted pipes', () => {
    expect(words('history | tail -5')).toEqual([['history'], ['tail', '-5']]);
    expect(words("echo 'a|b'")).toEqual([['echo', 'a|b']]);
  });

  it('reports syntax errors', () => {
    expect(parseCommandLine('echo "oops').error).toMatch(/matching `"'/);
    expect(parseCommandLine('ls |').error).toMatch(/unexpected token/);
    expect(parseCommandLine('| ls').error).toMatch(/unexpected token/);
  });

  it('splits command lists on &&, || and ;', () => {
    expect(parseCommandLine('cd x && ls | wc -l || echo no; pwd').pipelines).toEqual([
      { stages: [['cd', 'x']], then: '&&' },
      { stages: [['ls'], ['wc', '-l']], then: '||' },
      { stages: [['echo', 'no']], then: ';' },
      { stages: [['pwd']] },
    ]);
    expect(parseCommandLine('ls;').pipelines).toEqual([{ stages: [['ls']] }]);
    expect(parseCommandLine("echo 'a && b' \\; c").pipelines).toEqual([{ stages: [['echo', 'a && b', ';', 'c']] }]);
    expect(parseCommandLine('echo a&b').pipelines).toEqual([{ stages: [['echo', 'a&b']] }]);
  });

  it('reports list syntax errors', () => {
    expect(parseCommandLine('&& ls').error).toBe("syntax error near unexpected token `&&'");
    expect(parseCommandLine('ls && || pwd').error).toBe("syntax error near unexpected token `||'");
    expect(parseCommandLine(';').error).toBe("syntax error near unexpected token `;'");
    expect(parseCommandLine('ls &&').error).toBe('syntax error: unexpected end of file');
  });

  it('marks $? outside single quotes', () => {
    expect(words('echo $? "$?" \'$?\'')).toEqual([['echo', EXIT_STATUS, EXIT_STATUS, '$?']]);
    expect(lastArgument('echo $?')).toBe('$?');
  });
});

describe('parseOptions', () => {
  it('parses combined flags', () => {
    const o = parseOptions('ls', ['-la', 'dir'], { flags: 'al' });
    expect([...o.flags].sort()).toEqual(['a', 'l']);
    expect(o.operands).toEqual(['dir']);
  });

  it('parses attached and separate values', () => {
    expect(parseOptions('tree', ['-L', '2'], { valued: 'L' }).values.L).toBe('2');
    expect(parseOptions('tree', ['-L2'], { valued: 'L' }).values.L).toBe('2');
  });

  it('supports numeric shorthand and --', () => {
    expect(parseOptions('head', ['-5'], { valued: 'n', numericShorthand: 'n' }).values.n).toBe('5');
    expect(parseOptions('grep', ['--', '-v'], { flags: 'v' }).operands).toEqual(['-v']);
  });

  it('reports bad options', () => {
    expect(parseOptions('ls', ['-z'], { flags: 'a' }).error).toBe("ls: invalid option -- 'z'");
    expect(parseOptions('tree', ['-L'], { valued: 'L' }).error).toMatch(/requires an argument/);
    expect(parseOptions('ls', ['--all']).error).toMatch(/unrecognized option/);
  });
});

describe('expandHistory', () => {
  const history = ['ls projects', 'cat a.txt b.txt', 'echo hello'];

  it('expands !! !n !-n', () => {
    expect(expandHistory('sudo !!', history).line).toBe('sudo echo hello');
    expect(expandHistory('!1', history).line).toBe('ls projects');
    expect(expandHistory('!-2', history).line).toBe('cat a.txt b.txt');
  });

  it('expands !$ !^ and !prefix', () => {
    expect(expandHistory('echo !$', ['cat a.txt b.txt']).line).toBe('echo b.txt');
    expect(expandHistory('echo !^', ['cat a.txt b.txt']).line).toBe('echo a.txt');
    expect(expandHistory('!ca', history).line).toBe('cat a.txt b.txt');
  });

  it('does quick substitution', () => {
    expect(expandHistory('^hello^bye', history).line).toBe('echo bye');
    expect(expandHistory('^nope^x', history).error).toMatch(/substitution failed/);
  });

  it('leaves single quotes and lone ! alone', () => {
    expect(expandHistory("echo '!!'", history)).toEqual({ line: "echo '!!'", expanded: false });
    expect(expandHistory('echo hi!', history).line).toBe('echo hi!');
  });

  it('reports missing events', () => {
    expect(expandHistory('!99', history).error).toBe('!99: event not found');
    expect(expandHistory('!!', []).error).toBe('!!: event not found');
  });
});

describe('helpers', () => {
  it('quoteArg only quotes when needed', () => {
    expect(quoteArg('projects/a.md')).toBe('projects/a.md');
    expect(quoteArg('my file.txt')).toBe('"my file.txt"');
    expect(quoteArg('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('lastArgument', () => {
    expect(lastArgument('cat "my file.txt"')).toBe('my file.txt');
    expect(lastArgument(undefined)).toBe('');
  });

  it('getCompletionContext finds the word under completion', () => {
    expect(getCompletionContext('ca')).toMatchObject({ word: 'ca', isCommand: true, linePrefix: '' });
    expect(getCompletionContext('cat ')).toMatchObject({ word: '', isCommand: false, command: 'cat' });
    expect(getCompletionContext('cat "my f')).toMatchObject({ word: 'my f', command: 'cat', linePrefix: 'cat ' });
    expect(getCompletionContext('cat x | gr')).toMatchObject({ word: 'gr', isCommand: true, linePrefix: 'cat x | ' });
  });
});
