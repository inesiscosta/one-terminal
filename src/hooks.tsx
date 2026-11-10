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
  type ExecResult,
  type ShellEnv,
} from './builtins';
import { expandHistory, getCompletionContext, lastArgument, parseCommandLine, quoteArg } from './shell';

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

function toExecResult(value: React.ReactNode): ExecResult {
  if (value === null || value === undefined || typeof value === 'boolean') return { out: '', err: [] };
  if (typeof value === 'string' || typeof value === 'number') return { out: String(value), err: [] };
  return { out: '', node: value, err: [] };
}

export type TerminalEngineOptions = {
  fs: DirectoryNode;
  startPath?: string;
  extraCommands?: ExtraCommands;
  username?: string;
  hostname?: string;
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
  const busyTimerRef = useRef<number | null>(null);
  const clearedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  useEffect(
    () => () => {
      if (busyTimerRef.current !== null) clearTimeout(busyTimerRef.current);
    },
    [],
  );

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
    const builtins = BUILTIN_COMMANDS.filter((name) => !(name in extras)).map((name) => ({
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

  const resolvePath = useCallback(
    (p: string): string => {
      if (!p || p === '.') return path;
      // The root of the virtual file system doubles as the home directory
      if (p === '~' || p.startsWith('~/')) return normalizePath(p.slice(1));
      if (p.startsWith('/')) return normalizePath(p);
      return normalizePath(`${path}/${p}`);
    },
    [path],
  );

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

  /** Runs a full command line (with pipes) and returns what to print. */
  const run = useCallback(
    (line: string): React.ReactNode => {
      const parsed = parseCommandLine(line);
      if (parsed.error) return parsed.error;

      const env: ShellEnv = {
        fs,
        path,
        previousPath: cwdPathPrev,
        username,
        hostname,
        accentColor,
        neofetch,
        startedAt: startedAtRef.current,
        commands: commandInfos,
        history: previousCommandsRef.current,
        extraCommands,
        resolvePath,
        getNodeAt,
        changeDir: (abs) => {
          setCwdPathPrev(path);
          setPath(abs);
        },
        clearScreen,
        clearHistory: () => {
          previousCommandsRef.current = [];
        },
        startBusy: (ms) => {
          if (busyTimerRef.current !== null) clearTimeout(busyTimerRef.current);
          setBusy(true);
          busyTimerRef.current = window.setTimeout(() => {
            busyTimerRef.current = null;
            setBusy(false);
          }, ms);
        },
      };

      const errors: string[] = [];
      let stdin: string | undefined;
      let result: ExecResult = { out: '', err: [] };

      for (const [cmd, ...args] of parsed.stages) {
        const extraDef = extraCommands?.[cmd];
        if (extraDef) {
          try {
            result = toExecResult(
              extraDef.run(args, {
                getNodeAt: (p: string) => getNodeAt(resolvePath(p)) ?? null,
                resolvePath,
                cwd: cwdNode,
                path,
                commands: commandInfos,
                history: [...previousCommandsRef.current],
                stdin,
              }),
            );
          } catch (err) {
            console.error(`Terminal: error executing extra command "${cmd}"`, err);
            result = { out: '', err: [`error: executing ${cmd}`] };
          }
        } else {
          try {
            result = runBuiltin(cmd, args, stdin, env) ?? { out: '', err: [`command not found: ${cmd}`] };
          } catch (err) {
            console.error(`Terminal: error executing "${cmd}"`, err);
            result = { out: '', err: [`${cmd}: unexpected error`] };
          }
        }
        errors.push(...result.err);
        stdin = result.out;
      }

      const errorText = errors.join('\n');
      const output = result.node ?? result.out;
      if (!errorText) return output === '' ? undefined : output;
      if (output === '' || output == null) return errorText;
      return (
        <>
          {errorText}
          {'\n'}
          {output}
        </>
      );
    },
    [
      accentColor,
      clearScreen,
      commandInfos,
      cwdNode,
      cwdPathPrev,
      extraCommands,
      fs,
      getNodeAt,
      hostname,
      neofetch,
      path,
      resolvePath,
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
        setHistory((prev) => [...prev, { in: typed, out: expansion.error, prompt }]);
        resetLine();
        return;
      }

      const line = expansion.line;
      if (line) previousCommandsRef.current.push(line);

      clearedRef.current = false;
      let out = line ? run(line) : undefined;

      if (expansion.expanded) {
        // Like bash, echo the expanded command before its output
        out =
          out == null || out === '' ? (
            line
          ) : (
            <>
              {line}
              {'\n'}
              {out}
            </>
          );
      }

      if (!clearedRef.current) {
        setHistory((prev) => [...prev, { in: typed, out, prompt }]);
      }
      resetLine();
    },
    [input, run, resetLine],
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
      if (busy) {
        if (busyTimerRef.current !== null) clearTimeout(busyTimerRef.current);
        busyTimerRef.current = null;
        setBusy(false);
        setHistory((prev) => {
          if (!prev.length) return prev;
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, out: '^C' }];
        });
        return;
      }

      const line = search ? searchMatch : input;
      setHistory((prev) => [...prev, { in: `${line}^C`, out: undefined, prompt }]);
      resetLine();
    },
    [busy, input, resetLine, search, searchMatch],
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
