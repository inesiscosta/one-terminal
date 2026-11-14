import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  FSNode,
  DirectoryNode,
  CompletionState,
  HistoryEntry,
  ExtraCommands,
  CommandInfo,
  HistorySearchState,
  NeofetchConfig,
  CommandOutput,
  CommandResult,
} from './types';
import {
  BUILTIN_COMMANDS,
  BUILTIN_HELP,
  getPathCompletionScope,
  isDirectory,
  isFile,
  isLinkFile,
  isTextFile,
  runBuiltin,
  exitCode,
  type ExecResult,
  type MaybePromise,
  type ShellEnv,
} from './builtins';
import { EXIT_STATUS, expandHistory, getCompletionContext, lastArgument, parseCommandLine, quoteArg } from './shell';

function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }

  return '/' + stack.join('/');
}

function longestCommonPrefix(strings: string[]): string {
  if (!strings.length) return '';
  let prefix = strings[0];

  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }

  return prefix;
}

function findHistoryMatch(
  commands: string[],
  query: string,
  from: number,
  direction: 'reverse' | 'forward',
): number | null {
  if (!query) return null;
  const step = direction === 'reverse' ? -1 : 1;
  for (let i = from; i >= 0 && i < commands.length; i += step) {
    if (commands[i].includes(query)) return i;
  }
  return null;
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

function isCommandResult(value: unknown): value is CommandResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !React.isValidElement(value) &&
    ('exitCode' in value || 'output' in value)
  );
}

function toExecResult(value: CommandOutput): ExecResult {
  if (isCommandResult(value)) return { ...toExecResult(value.output), code: value.exitCode ?? 0 };
  if (value === null || value === undefined || typeof value === 'boolean') return { out: '', err: [], code: 0 };
  if (typeof value === 'string' || typeof value === 'number') return { out: String(value), err: [], code: 0 };
  return { out: '', node: value as React.ReactNode, err: [], code: 0 };
}

/** Resolves `p` against the directory `base` (understands ~, ., .. and absolute paths). */
function resolveFrom(base: string, p: string): string {
  if (!p || p === '.') return base;
  // The root of the virtual file system doubles as the home directory
  if (p === '~' || p.startsWith('~/')) return normalizePath(p.slice(1));
  if (p.startsWith('/')) return normalizePath(p);
  return normalizePath(`${base}/${p}`);
}

/** Joins the output of several commands, one after another. */
function joinOutputs(outputs: React.ReactNode[]): React.ReactNode {
  const shown = outputs.filter((o) => o != null && o !== '');
  if (shown.length <= 1) return shown[0];
  return shown.map((o, i) => (
    <React.Fragment key={i}>
      {i > 0 && '\n'}
      {o}
    </React.Fragment>
  ));
}

export type TerminalEngineOptions = {
  fs: DirectoryNode;
  startPath?: string;
  extraCommands?: ExtraCommands;
  username?: string;
  hostname?: string;
  /** Prefix for shell errors, e.g. "zsh" gives "zsh: command not found: foo". */
  shellName?: string;
  neofetch?: NeofetchConfig;
  /** Color used for highlights such as neofetch labels. */
  accentColor?: string;
};

export function useTerminalEngine({
  fs,
  startPath = '/',
  extraCommands,
  username = 'guest',
  hostname = 'one-terminal',
  shellName = 'zsh',
  neofetch,
  accentColor,
}: TerminalEngineOptions) {
  const [path, setPath] = useState<string>(normalizePath(startPath));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [cwdPathPrev, setCwdPathPrev] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<HistorySearchState | null>(null);
  const [clearCount, setClearCount] = useState(0);

  const previousCommandsRef = useRef<string[]>([]);
  // Cancels whatever keeps the terminal busy (a sleep timer or an async command)
  const cancelBusyRef = useRef<(() => void) | null>(null);
  // History entry that gets "^C" when the busy command is interrupted
  const busyEntryRef = useRef<number | null>(null);
  // Exit status of the last command, for $?
  const statusRef = useRef(0);
  const entryIdRef = useRef(0);
  const clearedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(() => () => cancelBusyRef.current?.(), []);

  const finishBusy = useCallback(() => {
    cancelBusyRef.current = null;
    busyEntryRef.current = null;
    setBusy(false);
  }, []);

  const cwdNode = useMemo<DirectoryNode | null>(() => {
    const segments = normalizePath(path).split('/').filter(Boolean);
    let current: FSNode = fs;

    for (const segment of segments) {
      if (!isDirectory(current) || !(segment in current.entries)) return null;
      current = current.entries[segment];
    }

    return isDirectory(current) ? current : null;
  }, [fs, path]);

  const commandInfos = useMemo<CommandInfo[]>(() => {
    const extras = extraCommands ?? {};
    const builtins = BUILTIN_COMMANDS.filter((name) => !(name in extras) && !BUILTIN_HELP[name].hidden).map((name) => ({
      name,
      usage: BUILTIN_HELP[name].usage,
      description: BUILTIN_HELP[name].description,
      builtin: true,
    }));
    const custom = Object.entries(extras)
      .filter(([, def]) => !def.hidden)
      .map(([name, def]) => ({
        name,
        usage: def.usage ?? name,
        description: def.description ?? '',
        builtin: false,
      }));
    return [...builtins, ...custom];
  }, [extraCommands]);

  const allCommands = useMemo(() => commandInfos.map((c) => c.name), [commandInfos]);

  const resolvePath = useCallback((p: string): string => resolveFrom(path, p), [path]);

  const getNodeAt = useCallback(
    (p: string): FSNode | undefined => {
      const segments = normalizePath(p).split('/').filter(Boolean);
      let current: FSNode = fs;

      for (const segment of segments) {
        if (!isDirectory(current) || !(segment in current.entries)) return undefined;
        current = current.entries[segment];
      }

      return current;
    },
    [fs],
  );

  /** Clears the screen but keeps the line being edited (Ctrl+L / `clear`). */
  const clearScreen = useCallback(() => {
    clearedRef.current = true;
    setHistory([]);
    setClearCount((n) => n + 1);
  }, []);

  /**
   * Runs a full command line: pipelines joined by &&, || and ;. Stays synchronous unless a
   * command returns a Promise. Returns what to print and whether `clear` ran.
   */
  const run = useCallback(
    (line: string, signal: AbortSignal): MaybePromise<React.ReactNode> => {
      const parsed = parseCommandLine(line);
      if (parsed.error) {
        statusRef.current = 2;
        return `${shellName}: ${parsed.error}`;
      }

      // The directory changes as the line runs (`cd x && ls` lists x), so track it here
      let cwd = path;
      let previousCwd = cwdPathPrev;
      const getNode = (p: string) => getNodeAt(resolveFrom(cwd, p));

      // Output of each pipeline, in order. `clear` empties it, like it empties the screen.
      const outputs: React.ReactNode[] = [];

      const makeEnv = (inPipeline: boolean): ShellEnv => ({
        fs,
        path: cwd,
        previousPath: previousCwd,
        username,
        hostname,
        shellName,
        accentColor,
        neofetch,
        startedAt: startedAtRef.current,
        commands: commandInfos,
        history: previousCommandsRef.current,
        extraCommands,
        signal,
        resolvePath: (p) => resolveFrom(cwd, p),
        getNodeAt,
        // Like bash, each stage of a pipeline runs in a "subshell": cd, clear and history -c
        // only change the session when they run on their own
        changeDir: (abs) => {
          if (inPipeline) return;
          previousCwd = cwd;
          cwd = abs;
          setCwdPathPrev(previousCwd);
          setPath(abs);
        },
        clearScreen: () => {
          if (inPipeline) return;
          clearScreen();
          outputs.length = 0;
        },
        clearHistory: () => {
          if (!inPipeline) previousCommandsRef.current = [];
        },
      });

      const failed = (cmd: string, err: unknown, message: string): ExecResult => {
        console.error(`Terminal: error executing "${cmd}"`, err);
        return { out: '', err: [message], code: 1 };
      };

      const runStage = (
        cmd: string,
        args: string[],
        stdin: string | undefined,
        env: ShellEnv,
      ): MaybePromise<ExecResult> => {
        const extraDef = extraCommands?.[cmd];
        if (extraDef) {
          try {
            const cwdNode = getNode('.');
            const value = extraDef.run(args, {
              getNodeAt: (p: string) => getNode(p) ?? null,
              resolvePath: (p: string) => resolveFrom(cwd, p),
              cwd: isDirectory(cwdNode) ? cwdNode : null,
              path: cwd,
              commands: commandInfos,
              history: [...previousCommandsRef.current],
              stdin,
              signal,
            });
            if (isPromise<CommandOutput>(value)) {
              return value.then(toExecResult, (err) => failed(cmd, err, `error: executing ${cmd}`));
            }
            return toExecResult(value);
          } catch (err) {
            return failed(cmd, err, `error: executing ${cmd}`);
          }
        }
        try {
          return (
            runBuiltin(cmd, args, stdin, env) ?? {
              out: '',
              err: [`${shellName}: command not found: ${cmd}`],
              code: 127,
            }
          );
        } catch (err) {
          return failed(cmd, err, `${cmd}: unexpected error`);
        }
      };

      // Runs one pipeline: each stage's text feeds the next. Its status is the last stage's.
      const runPipeline = (stages: string[][]): MaybePromise<{ output: React.ReactNode; code: number }> => {
        const env = makeEnv(stages.length > 1);
        const errors: string[] = [];
        const status = String(statusRef.current);

        const runFrom = (index: number, stdin: string | undefined, last: ExecResult): MaybePromise<ExecResult> => {
          if (index >= stages.length) return last;
          const [cmd, ...args] = stages[index].map((word) => word.split(EXIT_STATUS).join(status));
          const next = (result: ExecResult) => {
            errors.push(...result.err);
            return runFrom(index + 1, result.out, result);
          };
          const result = runStage(cmd, args, stdin, env);
          return isPromise<ExecResult>(result) ? result.then(next) : next(result);
        };

        const finish = (result: ExecResult) => {
          const errorText = errors.join('\n');
          const out = result.node ?? result.out;
          const output =
            !errorText || out === '' || out == null ? (
              errorText || out
            ) : (
              <>
                {errorText}
                {'\n'}
                {out}
              </>
            );
          return { output, code: exitCode(result) };
        };

        const final = runFrom(0, undefined, { out: '', err: [], code: 0 });
        return isPromise<ExecResult>(final) ? final.then(finish) : finish(final);
      };

      // Runs the pipelines in order, skipping per && and || like bash
      const runList = (index: number): MaybePromise<React.ReactNode> => {
        if (index >= parsed.pipelines.length || signal.aborted) return joinOutputs(outputs);
        const previous = parsed.pipelines[index - 1]?.then;
        const failed = statusRef.current !== 0;
        if ((previous === '&&' && failed) || (previous === '||' && !failed)) return runList(index + 1);

        const done = ({ output, code }: { output: React.ReactNode; code: number }) => {
          // Interrupted: Ctrl+C already set the status and ended the line
          if (signal.aborted) return joinOutputs(outputs);
          statusRef.current = code;
          outputs.push(output);
          return runList(index + 1);
        };
        const result = runPipeline(parsed.pipelines[index].stages);
        return isPromise<{ output: React.ReactNode; code: number }>(result) ? result.then(done) : done(result);
      };

      return runList(0);
    },
    [
      accentColor,
      clearScreen,
      commandInfos,
      cwdPathPrev,
      extraCommands,
      fs,
      getNodeAt,
      hostname,
      neofetch,
      path,
      shellName,
      username,
    ],
  );

  const resetLine = useCallback(() => {
    setInput('');
    setHistoryIndex(null);
    setCompletion(null);
    setSearch(null);
  }, []);

  /** Runs a line. `lineOverride` runs that text instead of the current input. */
  const submit = useCallback(
    (prompt?: string, lineOverride?: string) => {
      const typed = (lineOverride ?? input).trim();
      const expansion = expandHistory(typed, previousCommandsRef.current);

      if (expansion.error) {
        statusRef.current = 1;
        setHistory((prev) => [...prev, { in: typed, out: `${shellName}: ${expansion.error}`, prompt }]);
        resetLine();
        return;
      }

      const line = expansion.line;
      if (line) previousCommandsRef.current.push(line);

      const id = ++entryIdRef.current;
      busyEntryRef.current = id;
      clearedRef.current = false;
      const controller = new AbortController();
      const result = line ? run(line, controller.signal) : undefined;

      // Like bash, echo the expanded command before its output
      const withEcho = (out: React.ReactNode): React.ReactNode =>
        !expansion.expanded ? (
          out
        ) : out == null || out === '' ? (
          line
        ) : (
          <>
            {line}
            {'\n'}
            {out}
          </>
        );

      // After `clear` (e.g. `clear; ls`), only what ran after it is shown
      const entryFor = (out: React.ReactNode): HistoryEntry =>
        clearedRef.current
          ? { id, in: typed, out, prompt, hideInput: true }
          : { id, in: typed, out: withEcho(out), prompt };

      if (isPromise<React.ReactNode>(result)) {
        // Async command: show the line now, the output when it arrives. Ctrl+C aborts it.
        setHistory((prev) => [...prev, entryFor(undefined)]);
        cancelBusyRef.current?.();
        setBusy(true);
        cancelBusyRef.current = () => controller.abort();
        result.then((out) => {
          if (controller.signal.aborted) return;
          finishBusy();
          setHistory((prev) =>
            prev.some((entry) => entry.id === id)
              ? prev.map((entry) =>
                  entry.id === id ? { ...entry, out: entry.hideInput ? out : withEcho(out) } : entry,
                )
              : // `clear` ran while waiting and removed the line
                [...prev, { id, in: typed, out, prompt, hideInput: true }],
          );
        });
      } else if (!clearedRef.current || (result != null && result !== '')) {
        setHistory((prev) => [...prev, entryFor(result)]);
      }
      resetLine();
    },
    [finishBusy, input, run, resetLine, shellName],
  );

  const navigateHistory = useCallback(
    (direction: 'up' | 'down') => {
      const commands = previousCommandsRef.current;
      if (!commands.length) return;

      if (historyIndex === null) {
        if (direction === 'up') {
          const idx = commands.length - 1;
          setHistoryIndex(idx);
          setInput(commands[idx]);
        }
        return;
      }

      if (direction === 'up') {
        const nextIdx = Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInput(commands[nextIdx]);
      } else {
        const lastIdx = commands.length - 1;
        if (historyIndex >= lastIdx) {
          setHistoryIndex(null);
          setInput('');
        } else {
          const nextIdx = historyIndex + 1;
          setHistoryIndex(nextIdx);
          setInput(commands[nextIdx]);
        }
      }
    },
    [historyIndex],
  );

  // ---------- History search (Ctrl+R / Ctrl+S) ----------
  const searchMatch =
    search && search.index !== null ? previousCommandsRef.current[search.index] : (search?.original ?? '');

  const startSearch = useCallback(
    (direction: 'reverse' | 'forward') => {
      const commands = previousCommandsRef.current;
      if (!search) {
        setCompletion(null);
        setSearch({ direction, query: '', index: null, failed: false, original: input });
        return;
      }
      const from =
        search.index !== null
          ? search.index + (direction === 'reverse' ? -1 : 1)
          : direction === 'reverse'
            ? commands.length - 1
            : commands.length;
      const found = findHistoryMatch(commands, search.query, from, direction);
      setSearch({
        ...search,
        direction,
        index: found ?? search.index,
        failed: !!search.query && found === null,
      });
    },
    [input, search],
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      if (!search) return;
      const commands = previousCommandsRef.current;
      const narrowing = query.startsWith(search.query) && search.index !== null;
      const from = narrowing ? search.index! : search.direction === 'reverse' ? commands.length - 1 : 0;
      const found = findHistoryMatch(commands, query, from, search.direction);
      setSearch({
        ...search,
        query,
        index: query ? (found ?? search.index) : null,
        failed: !!query && found === null,
      });
    },
    [search],
  );

  /** Leaves search mode keeping the match on the line for editing. */
  const acceptSearch = useCallback(() => {
    if (!search) return;
    setInput(searchMatch);
    setHistoryIndex(search.index);
    setSearch(null);
  }, [search, searchMatch]);

  /** Leaves search mode restoring the original line (Ctrl+G). */
  const cancelSearch = useCallback(() => {
    if (!search) return;
    setInput(search.original);
    setSearch(null);
  }, [search]);

  /**
   * Runs the current line (or search match) and loads the next history entry
   * into the prompt (Ctrl+O, bash's operate-and-get-next).
   */
  const operateAndGetNext = useCallback(
    (prompt?: string) => {
      const commands = previousCommandsRef.current;
      const sourceIndex = search ? search.index : historyIndex;
      const nextLine = sourceIndex !== null && sourceIndex + 1 < commands.length ? commands[sourceIndex + 1] : null;

      submit(prompt, search ? searchMatch : input);

      if (nextLine !== null) {
        setInput(nextLine);
        setHistoryIndex(sourceIndex! + 1);
      }
    },
    [historyIndex, input, search, searchMatch, submit],
  );

  /** Last argument of the previous command (Alt+.). */
  const getLastArgument = useCallback(
    () => lastArgument(previousCommandsRef.current[previousCommandsRef.current.length - 1]),
    [],
  );

  // ---------- Tab completion ----------
  const complete = useCallback(() => {
    const raw = input;
    if (!raw.trim()) return;

    // Repeated Tab cycles through the options
    if (completion && completion.seedInput === raw && completion.options.length > 1) {
      const nextIndex = (completion.index + 1) % completion.options.length;
      const newInput = completion.linePrefix + quoteArg(completion.basePart + completion.options[nextIndex]);
      setInput(newInput);
      setCompletion({ ...completion, index: nextIndex, seedInput: newInput });
      return;
    }
    setCompletion(null);

    const ctx = getCompletionContext(raw);
    let kind: CompletionState['kind'];
    let options: string[];
    let typed: string;
    let basePart = '';
    let isDirOption = (_name: string) => false;

    if (ctx.isCommand) {
      kind = 'command';
      typed = ctx.word;
      options = allCommands.filter((c) => c.startsWith(typed));
    } else {
      const scope = getPathCompletionScope(ctx.command, extraCommands);
      if (scope === 'none') return;

      kind = 'path';
      const slash = ctx.word.lastIndexOf('/');
      basePart = slash >= 0 ? ctx.word.slice(0, slash + 1) : '';
      typed = ctx.word.slice(slash + 1);

      const baseNode = getNodeAt(resolvePath(basePart || '.'));
      if (!isDirectory(baseNode)) return;

      const wantsHidden = typed.startsWith('.');
      options = Object.entries(baseNode.entries)
        .filter(([name, node]) => {
          if (!name.startsWith(typed)) return false;
          if (name.startsWith('.') && !wantsHidden) return false;
          if (isDirectory(node)) return true; // always offer folders to navigate into
          switch (scope) {
            case 'directories':
              return false;
            case 'files':
              return isFile(node);
            case 'textFiles':
              return isTextFile(node);
            case 'linkFiles':
              return isLinkFile(node);
            default:
              return true;
          }
        })
        .map(([name]) => name)
        .sort((a, b) => a.localeCompare(b));
      isDirOption = (name) => isDirectory(baseNode.entries[name]);
    }

    if (!options.length) return;

    // Single match: complete it, adding "/" for folders or a space otherwise
    if (options.length === 1) {
      const name = options[0];
      const dir = isDirOption(name);
      setInput(ctx.linePrefix + quoteArg(basePart + name + (dir ? '/' : '')) + (dir ? '' : ' '));
      return;
    }

    // Multiple matches: extend to the longest common prefix and remember the options
    const prefix = longestCommonPrefix(options);
    const newInput = prefix.length > typed.length ? ctx.linePrefix + quoteArg(basePart + prefix) : raw;
    setInput(newInput);
    setCompletion({ kind, options, index: -1, seedInput: newInput, linePrefix: ctx.linePrefix, basePart });
  }, [allCommands, completion, extraCommands, getNodeAt, input, resolvePath]);

  /** Ctrl+C: stops a running command, or abandons the current line. */
  const interrupt = useCallback(
    (prompt?: string) => {
      statusRef.current = 130;
      if (busy) {
        const id = busyEntryRef.current;
        cancelBusyRef.current?.();
        finishBusy();
        setHistory((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? {
                  ...entry,
                  out:
                    entry.out == null || entry.out === '' ? (
                      '^C'
                    ) : (
                      <>
                        {entry.out}
                        {'\n'}^C
                      </>
                    ),
                }
              : entry,
          ),
        );
        return;
      }

      const line = search ? searchMatch : input;
      setHistory((prev) => [...prev, { in: `${line}^C`, out: undefined, prompt }]);
      resetLine();
    },
    [busy, finishBusy, input, resetLine, search, searchMatch],
  );

  return {
    state: { path, cwdNode, history, input, completion, busy, search, searchMatch, clearCount },
    setInput,
    setPath,
    setHistory,
    submit,
    complete,
    navigateHistory,
    interrupt,
    clearScreen,
    startSearch,
    setSearchQuery,
    acceptSearch,
    cancelSearch,
    operateAndGetNext,
    getLastArgument,
  };
}
