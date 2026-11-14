// Pure shell-language helpers: tokenizing, option parsing, history expansion, completion context.

/** How a pipeline connects to the next one: `&&` (if it succeeded), `||` (if it failed) or `;` (always). */
export type ListOperator = '&&' | '||' | ';';

/** One or more commands joined by `|`. */
export type Pipeline = { stages: string[][]; then?: ListOperator };

export type ParsedLine = { pipelines: Pipeline[]; error?: string };

/**
 * Stands in for `$?` in parsed arguments. It's replaced with the exit status when each
 * pipeline runs, since an earlier command in the same line can change it.
 */
export const EXIT_STATUS = '\u0000?';

/**
 * Splits a command line into pipelines (joined by `&&`, `||` and `;`) of stages (joined by `|`)
 * of arguments, handling 'single quotes', "double quotes", backslash escapes and `$?`.
 */
export function parseCommandLine(line: string): ParsedLine {
  const pipelines: Pipeline[] = [];
  let stages: string[][] = [];
  let stage: string[] = [];
  let token = '';
  let inToken = false;
  let quote: "'" | '"' | null = null;

  const endToken = () => {
    if (inToken) stage.push(token);
    token = '';
    inToken = false;
  };
  /** Ends the current stage; false if it was empty. */
  const endStage = () => {
    endToken();
    if (!stage.length) return false;
    stages.push(stage);
    stage = [];
    return true;
  };
  const unexpected = (tok: string): ParsedLine => ({
    pipelines: [],
    error: `syntax error near unexpected token \`${tok}'`,
  });

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (quote === "'") {
      if (ch === "'") quote = null;
      else token += ch;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === '$' && next === '?') {
        token += EXIT_STATUS;
        i++;
      } else if (ch === '\\' && i + 1 < line.length && '"\\$`'.includes(next)) token += line[++i];
      else token += ch;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      inToken = true;
    } else if (ch === '\\') {
      inToken = true;
      // A trailing backslash has nothing to escape, so it stays literal (like `bash -c 'echo a\'`)
      token += i + 1 < line.length ? line[++i] : '\\';
    } else if (ch === '$' && next === '?') {
      token += EXIT_STATUS;
      inToken = true;
      i++;
    } else if (/\s/.test(ch)) {
      endToken();
    } else if (ch === ';' || (ch === '&' && next === '&') || (ch === '|' && next === '|')) {
      const op: ListOperator = ch === ';' ? ';' : ch === '&' ? '&&' : '||';
      if (op !== ';') i++;
      if (!endStage()) return unexpected(op);
      pipelines.push({ stages, then: op });
      stages = [];
    } else if (ch === '|') {
      if (!endStage()) return unexpected('|');
    } else {
      token += ch;
      inToken = true;
    }
  }

  if (quote) return { pipelines: [], error: `unexpected EOF while looking for matching \`${quote}'` };

  if (endStage()) pipelines.push({ stages });
  else if (stages.length) return unexpected('|');
  else if (pipelines.length && pipelines[pipelines.length - 1].then !== ';') {
    // `ls &&` needs another command, like bash -c
    return { pipelines: [], error: 'syntax error: unexpected end of file' };
  }

  // A trailing `;` is allowed and means nothing
  const last = pipelines[pipelines.length - 1];
  if (last?.then === ';') delete last.then;

  return { pipelines };
}

/** Quotes an argument if it contains characters the parser would treat specially. */
export function quoteArg(arg: string): string {
  if (/^[\w./~+=:@%,-]*$/.test(arg)) return arg;
  return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`;
}

export type ParsedOptions = {
  flags: Set<string>;
  values: Record<string, string>;
  operands: string[];
  error?: string;
};

/**
 * getopt-style parsing: combined short flags (`-la`), options with values
 * (`-L 2` or `-L2`), `--` to end options, and optional `-5` shorthand for `-n 5`.
 */
export function parseOptions(
  cmd: string,
  args: string[],
  spec: { flags?: string; valued?: string; numericShorthand?: string } = {},
): ParsedOptions {
  const { flags = '', valued = '', numericShorthand } = spec;
  const result: ParsedOptions = { flags: new Set(), values: {}, operands: [] };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--') {
      result.operands.push(...args.slice(i + 1));
      break;
    }
    if (!arg.startsWith('-') || arg === '-') {
      result.operands.push(arg);
      continue;
    }
    if (numericShorthand && /^-\d+$/.test(arg)) {
      result.values[numericShorthand] = arg.slice(1);
      continue;
    }
    if (arg.startsWith('--')) {
      return { ...result, error: `${cmd}: unrecognized option '${arg}'` };
    }

    for (let j = 1; j < arg.length; j++) {
      const c = arg[j];
      if (valued.includes(c)) {
        const value = arg.slice(j + 1) || args[++i];
        if (value === undefined) return { ...result, error: `${cmd}: option requires an argument -- '${c}'` };
        result.values[c] = value;
        break;
      }
      if (!flags.includes(c)) return { ...result, error: `${cmd}: invalid option -- '${c}'` };
      result.flags.add(c);
    }
  }

  return result;
}

function wordsOf(line: string): string[] {
  return parseCommandLine(line)
    .pipelines.flatMap((p) => p.stages.flat())
    .map((word) => word.split(EXIT_STATUS).join('$?'));
}

/** Last argument of a command line (what `!$` and Alt+. use). */
export function lastArgument(line: string | undefined): string {
  if (!line) return '';
  const words = wordsOf(line);
  return words[words.length - 1] ?? '';
}

/**
 * Bash-style history expansion: `!!`, `!n`, `!-n`, `!$`, `!^`, `!prefix`
 * and `^old^new` quick substitution. Nothing inside single quotes is expanded.
 */
export function expandHistory(line: string, commands: string[]): { line: string; expanded: boolean; error?: string } {
  const last = commands[commands.length - 1];

  if (line.startsWith('^')) {
    const [from = '', to = '', ...rest] = line.slice(1).split('^');
    if (!last || !from || !last.includes(from)) {
      return { line, expanded: false, error: `^${from}^${to}: substitution failed` };
    }
    return { line: last.replace(from, to) + rest.join('^'), expanded: true };
  }

  let out = '';
  let expanded = false;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '\\' && !inSingle) {
      out += ch + (line[i + 1] ?? '');
      i++;
      continue;
    }
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle) inDouble = !inDouble;

    if (ch !== '!' || inSingle) {
      out += ch;
      continue;
    }

    const rest = line.slice(i + 1);
    let replacement: string | undefined;

    const ref = /^(!|\$|\^|-?\d+|[A-Za-z_./][^\s!"'|]*)/.exec(rest);
    if (!ref) {
      out += ch;
      continue;
    }

    const token = `!${ref[1]}`;
    const consumed = ref[1].length;

    if (ref[1] === '!') replacement = last;
    else if (ref[1] === '$') replacement = last === undefined ? undefined : lastArgument(last);
    else if (ref[1] === '^') replacement = last === undefined ? undefined : wordsOf(last)[1];
    else if (/^-?\d+$/.test(ref[1])) {
      const n = Number(ref[1]);
      replacement = n === 0 ? undefined : commands[n < 0 ? commands.length + n : n - 1];
    } else {
      for (let k = commands.length - 1; k >= 0; k--) {
        if (commands[k].startsWith(ref[1])) {
          replacement = commands[k];
          break;
        }
      }
    }

    if (replacement === undefined) return { line, expanded: false, error: `${token}: event not found` };

    out += replacement;
    expanded = true;
    i += consumed;
  }

  return { line: out, expanded };
}

export type CompletionContext = {
  /** Text before the word being completed (kept as typed). */
  linePrefix: string;
  /** The word being completed, with quotes removed. */
  word: string;
  /** Whether the word is a command name (first word of a pipeline stage). */
  isCommand: boolean;
  /** Command of the stage being completed (empty when completing the command itself). */
  command: string;
};

/** Finds the word under completion at the end of `raw`, quote-aware. */
export function getCompletionContext(raw: string): CompletionContext {
  let stageWords: string[] = [];
  let token = '';
  let tokenStart = raw.length;
  let inToken = false;
  let quote: "'" | '"' | null = null;

  const endToken = () => {
    if (inToken) stageWords.push(token);
    token = '';
    inToken = false;
  };
  const startToken = (i: number) => {
    if (!inToken) tokenStart = i;
    inToken = true;
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (quote === '"' && ch === '\\' && i + 1 < raw.length) token += raw[++i];
      else token += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      startToken(i);
      quote = ch;
    } else if (ch === '\\') {
      startToken(i);
      if (i + 1 < raw.length) token += raw[++i];
    } else if (/\s/.test(ch)) {
      endToken();
    } else if (ch === '|' || ch === ';' || (ch === '&' && raw[i + 1] === '&')) {
      // A new command starts after |, ||, && and ;
      endToken();
      stageWords = [];
      if (ch === '&') i++;
    } else {
      startToken(i);
      token += ch;
    }
  }

  const start = inToken ? tokenStart : raw.length;
  return {
    linePrefix: raw.slice(0, start),
    word: inToken ? token : '',
    isCommand: stageWords.length === 0,
    command: stageWords[0] ?? '',
  };
}
