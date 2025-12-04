// useTerminalEngine.ts
import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FSNode,
  DirectoryNode,
  FileNode,
  CompletionState,
  HistoryEntry,
  ExtraCommands,
  ExtraCommandDefinition,
  ExtraCommandFileScope,
} from "./types";

// Built-in commands
const BUILTIN_COMMANDS = ["help", "ls", "cd", "cat", "echo", "pwd", "clear"];

function isDirectory(node: FSNode | undefined | null): node is DirectoryNode {
  return !!node && typeof node === "object" && node.kind === "directory";
}

function isFile(node: FSNode | undefined | null): node is FileNode {
  return !!node && typeof node === "object" && node.kind === "file";
}

function isTextFile(
  node: FSNode | undefined | null
): node is FileNode & { fileType: "text" } {
  return isFile(node) && node.fileType === "text";
}

function isLinkFile(
  node: FSNode | undefined | null
): node is FileNode & { fileType: "link" } {
  return isFile(node) && node.fileType === "link";
}

function normalizePath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  const stack: string[] = [];

  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }

  return "/" + stack.join("/");
}

function longestCommonPrefix(strings: string[]): string {
  if (!strings.length) return "";
  let prefix = strings[0];

  for (const s of strings.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
    prefix = prefix.slice(0, i);
    if (!prefix) break;
  }

  return prefix;
}

function getPathCompletionScopeForCommand(
  cmd: string,
  extraCommands?: ExtraCommands
): ExtraCommandFileScope {
  // Built-in commands
  if (cmd === "cd") return "directories";
  if (cmd === "cat") return "files";

  const def: ExtraCommandDefinition | undefined =
    extraCommands && extraCommands[cmd];

  if (!def) {
    return "none";
  }

  const { completion } = def;
  const mode = completion?.mode ?? "none";
  if (mode === "none") return "none";

  // mode === "paths"
  return completion.fileScope ?? "any";
}

// main hook
export function useTerminalEngine(
  fs: DirectoryNode,
  startPath = "/",
  extraCommands?: ExtraCommands
) {
  const [path, setPath] = useState<string>(normalizePath(startPath));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [input, setInput] = useState("");
  const [completion, setCompletion] = useState<CompletionState | null>(null);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [cwdPathPrev, setCwdPathPrev] = useState<string | null>(null);

  const previousCommandsRef = useRef<string[]>([]);

  const cwdNode = useMemo<DirectoryNode | null>(() => {
    const segments = normalizePath(path).split("/").filter(Boolean);
    let current: FSNode = fs;

    for (const segment of segments) {
      if (!isDirectory(current) || !(segment in current.entries)) return null;
      current = current.entries[segment];
    }

    return isDirectory(current) ? current : null;
  }, [fs, path]);

  const allCommands = useMemo(
    () => [...BUILTIN_COMMANDS, ...Object.keys(extraCommands ?? {})],
    [extraCommands]
  );

  const resolvePath = useCallback(
    (p: string): string => {
      if (!p || p === ".") return path;
      if (p.startsWith("/")) return normalizePath(p);
      return normalizePath(`${path}/${p}`);
    },
    [path]
  );

  const getNodeAt = useCallback(
    (p: string): FSNode | undefined => {
      const segments = normalizePath(p).split("/").filter(Boolean);
      let current: FSNode = fs;

      for (const segment of segments) {
        if (!isDirectory(current) || !(segment in current.entries)) return undefined;
        current = current.entries[segment];
      }

      return current;
    },
    [fs]
  );

  const run = useCallback(
    (line: string): HistoryEntry => {
      const trimmed = line.trim();

      const makeEntry = (out?: React.ReactNode): HistoryEntry => ({
        in: trimmed,
        out,
      });

      if (!trimmed) return makeEntry();

      const [cmd, ...args] = trimmed.split(/\s+/);

      // ---------- Extra commands ----------
      const extraDef = extraCommands?.[cmd];
      if (extraDef) {
        try {
          const out = extraDef.run(args, {
            getNodeAt: (p: string) => getNodeAt(resolvePath(p)) ?? null,
            resolvePath,
            cwd: cwdNode,
            path,
          });
          return makeEntry(out);
        } catch (err) {
          console.error(`Terminal: error executing extra command "${cmd}"`, err);
          return makeEntry(`error: executing ${cmd}`);
        }
      }

      if (cmd === "pwd") {
        return makeEntry(path);
      }

      if (cmd === "clear") {
        setHistory([]);
        return makeEntry();
      }

      if (cmd === "ls") {
        const target = args[0] ?? ".";
        const targetPath = resolvePath(target);
        const node = getNodeAt(targetPath);

        if (!node) {
          return makeEntry(`ls: cannot access '${target}': No such file or directory`);
        }

        if (isFile(node)) {
          return makeEntry(target);
        }

        if (isDirectory(node)) {
          const entries = Object.keys(node.entries).sort();
          return makeEntry(entries.join("  ") || "(empty)");
        }

        return makeEntry("(unknown node type)");
      }

      if (cmd === "cd") {
        const rawTarget = args[0];

        if (rawTarget === "-") {
          if (!cwdPathPrev) {
            return makeEntry("cd: OLDPWD not set");
          }

          const prevNode = getNodeAt(cwdPathPrev);
          if (!prevNode || !isDirectory(prevNode)) {
            return makeEntry(`cd: ${cwdPathPrev}: No such file or directory`);
          }

          const old = path;
          setCwdPathPrev(old);
          setPath(cwdPathPrev);
          return makeEntry(cwdPathPrev);
        }

        const targetPath = resolvePath(rawTarget ?? "/");
        const node = getNodeAt(targetPath);

        if (!node) {
          return makeEntry(`cd: ${rawTarget ?? "/"}: No such file or directory`);
        }

        if (!isDirectory(node)) {
          return makeEntry(`cd: not a directory: ${rawTarget}`);
        }

        setCwdPathPrev(path);
        setPath(targetPath);
        return makeEntry();
      }

      if (cmd === "cat") {
        const target = args[0];
        if (!target) return makeEntry("cat: missing file operand");

        const node = getNodeAt(resolvePath(target));
        if (!node) return makeEntry(`cat: ${target}: No such file`);
        if (isDirectory(node)) return makeEntry(`cat: ${target}: Is a directory`);

        if (isTextFile(node)) {
          return makeEntry(node.content);
        }

        if (isLinkFile(node)) {
          return makeEntry(
            <a href={node.href} target={node.target ?? "_blank"} rel="noreferrer">
              {node.label ?? node.href}
            </a>
          );
        }

        return makeEntry("");
      }

      if (cmd === "echo") {
        return makeEntry(args.join(" "));
      }

      if (cmd === "help") {
        return makeEntry(`Commands: ${allCommands.join(", ")}`);
      }

      return makeEntry(`command not found: ${cmd}`);
    },
    [allCommands, cwdNode, extraCommands, getNodeAt, path, resolvePath, setHistory, cwdPathPrev]
  );

  const submit = useCallback(() => {
    const trimmed = input.trim();
    const entry = run(input);
    const cmd = trimmed.split(/\s+/)[0];

    if (cmd === "clear") {
      setInput("");
      setHistoryIndex(null);
      setCompletion(null);
      return;
    }

    if (trimmed) {
      previousCommandsRef.current.push(trimmed);
    }

    setHistory((prev) => [...prev, entry]);
    setInput("");
    setHistoryIndex(null);
    setCompletion(null);
  }, [input, run]);

  const navigateHistory = useCallback(
    (direction: "up" | "down") => {
      const commands = previousCommandsRef.current;
      if (!commands.length) return;

      if (historyIndex === null) {
        if (direction === "up") {
          const idx = commands.length - 1;
          setHistoryIndex(idx);
          setInput(commands[idx]);
        }
        return;
      }

      if (direction === "up") {
        const nextIdx = Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInput(commands[nextIdx]);
      } else {
        const lastIdx = commands.length - 1;
        if (historyIndex >= lastIdx) {
          setHistoryIndex(null);
          setInput("");
        } else {
          const nextIdx = historyIndex + 1;
          setHistoryIndex(nextIdx);
          setInput(commands[nextIdx]);
        }
      }
    },
    [historyIndex]
  );

  const complete = useCallback(() => {
    const raw = input;
    if (!raw.trim()) return;

    const endsWithSpace = /\s$/.test(raw);
    const tokens = raw.trim().split(/\s+/);
    if (!tokens.length) return;

    const lastToken = tokens[tokens.length - 1];
    const cmd = tokens[0];
    const isKnownCommand = allCommands.includes(cmd);

    const replaceLastToken = (replacement: string) => {
      const nextTokens = [...tokens];
      nextTokens[nextTokens.length - 1] = replacement;
      setInput(nextTokens.join(" "));
    };

    if (completion && completion.seedInput === raw && completion.options.length > 1) {
      const nextIndex = (completion.index + 1) % completion.options.length;
      const choice = completion.options[nextIndex];
      let newInput = raw;

      if (completion.kind === "command") {
        const nextTokens = [...tokens];
        nextTokens[0] = choice;
        newInput = nextTokens.join(" ");
      } else {
        const { basePart } = completion;
        const replacement = basePart === "." ? choice : `${basePart}/${choice}`;

        if (tokens.length === 1 && endsWithSpace) {
          newInput = `${cmd} ${replacement}`;
        } else {
          const nextTokens = [...tokens];
          nextTokens[nextTokens.length - 1] = replacement;
          newInput = nextTokens.join(" ");
        }
      }

      setInput(newInput);
      setCompletion({
        ...completion,
        index: nextIndex,
        seedInput: newInput,
      });
      return;
    } else {
      setCompletion(null);
    }

    // ----- 1) Command-name completion -----
    const isCommandOnly = tokens.length === 1 && !endsWithSpace;

    if (isCommandOnly) {
      const matches = allCommands.filter((c) => c.startsWith(lastToken));
      if (!matches.length) return;

      if (matches.length === 1) {
        replaceLastToken(matches[0]);
        setCompletion(null);
        return;
      }

      const prefix = longestCommonPrefix(matches);
      let newInput = raw;

      if (prefix.length > lastToken.length) {
        const nextTokens = [...tokens];
        nextTokens[0] = prefix;
        newInput = nextTokens.join(" ");
        setInput(newInput);
      }

      setCompletion({
        kind: "command",
        options: matches,
        index: -1,
        seedInput: newInput,
      });

      return;
    }

    // ----- 2) If the command itself is unknown, DO NOT complete paths -----
    if (!isKnownCommand) {
      return;
    }

    // Determine how this command wants its arguments autocompleted
    const scope = getPathCompletionScopeForCommand(cmd, extraCommands);

    // "none" means: do not autocomplete arguments at all, even if there is a space.
    if (scope === "none") {
      return;
    }

    // ----- 3) Path / arg completion -----
    const argToken =
      tokens.length === 1 && endsWithSpace ? "" : tokens[tokens.length - 1];

    const hasSlash = argToken.includes("/");

    const basePart = hasSlash
      ? argToken.slice(0, argToken.lastIndexOf("/"))
      : ".";

    const prefixPart = hasSlash
      ? argToken.slice(argToken.lastIndexOf("/") + 1)
      : argToken;

    const basePath = resolvePath(basePart);
    const baseNode = getNodeAt(basePath);
    if (!isDirectory(baseNode)) return;

    const entries = Object.entries(baseNode.entries);

    const matches = entries
      .filter(([name, node]) => {
        if (prefixPart && !name.startsWith(prefixPart)) return false;

        switch (scope) {
          case "directories":
            return isDirectory(node);
          case "files":
            return isFile(node);
          case "textFiles":
            return isTextFile(node);
          case "linkFiles":
            return isLinkFile(node);
          case "any":
            return true;
          default:
            return true;
        }
      })
      .map(([name]) => name);

    if (!matches.length) return;

    const buildReplacement = (name: string) =>
      basePart === "." ? name : `${basePart}/${name}`;

    // Single match -> inline completion
    if (matches.length === 1) {
      const replacement = buildReplacement(matches[0]);

      if (tokens.length === 1 && endsWithSpace) {
        setInput(`${cmd} ${replacement}`);
      } else {
        const nextTokens = [...tokens];
        nextTokens[nextTokens.length - 1] = replacement;
        setInput(nextTokens.join(" "));
      }

      setCompletion(null);
      return;
    }

    // Multiple matches -> longest common prefix + completion state
    const prefix = longestCommonPrefix(matches);
    let newInput = raw;

    if (prefix.length > prefixPart.length) {
      const newName = buildReplacement(prefix);

      if (tokens.length === 1 && endsWithSpace) {
        newInput = `${cmd} ${newName}`;
      } else {
        const nextTokens = [...tokens];
        nextTokens[nextTokens.length - 1] = newName;
        newInput = nextTokens.join(" ");
      }

      setInput(newInput);
    }

    setCompletion({
      kind: "path",
      options: matches,
      index: -1,
      seedInput: newInput,
      basePart,
    });
  }, [allCommands, completion, extraCommands, getNodeAt, input, resolvePath, setInput]);

  const interrupt = useCallback(() => {
    const entry: HistoryEntry = {
      in: input,
      out: undefined,
    };

    setHistory((prev) => [...prev, entry]);
    setInput("");
    setHistoryIndex(null);
    setCompletion(null);
  }, [input]);

  return {
    state: { path, cwdNode, history, input, completion },
    setInput,
    setPath,
    setHistory,
    submit,
    complete,
    navigateHistory,
    interrupt,
  };
}
