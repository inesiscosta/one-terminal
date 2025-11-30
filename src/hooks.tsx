import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FSNode, DirectoryNode, FileNode, CompletionState, HistoryEntry, ExtraCommands } from "./types";

const COMMANDS = ["help", "ls", "cd", "cat", "echo", "pwd", "clear"];

/* ---------- Type guards ---------- */

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

/* ---------- Path helpers ---------- */

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

/* ---------- Hook ---------- */

export function useTerminalEngine(
  fs: DirectoryNode,
  startPath = "/",
  extraCommands?: ExtraCommands
) {
   const [path, setPath] = useState<string>(normalizePath(startPath));
   const [history, setHistory] = useState<HistoryEntry[]>([]);
   const [input, setInput] = useState("");
   const [completion, setCompletion] = useState<CompletionState | null>(null);
   const previousCommandsRef = useRef<string[]>([]);
   const [historyIndex, setHistoryIndex] = useState<number | null>(null);
   const previousDirRef = useRef<string | null>(null);
   const cwdNode = useMemo<DirectoryNode | null>(() => {
     const segments = normalizePath(path).split("/").filter(Boolean);
     let current: FSNode = fs;
     for (const segment of segments) {
       if (!isDirectory(current) || !(segment in current.entries)) return null;
       current = current.entries[segment];
     }
     return isDirectory(current) ? current : null;
   }, [fs, path]);

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

      if (extraCommands && typeof extraCommands[cmd] === "function") {
        try {
          const out = extraCommands[cmd](args, (p: string) => getNodeAt(resolvePath(p)) ?? null);
          return makeEntry(out);
        } catch (err) {
          return makeEntry(`error: executing ${cmd}`);
        }
      }

       /* ---- Built-in commands ---- */

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

        // If it's a file: just print its name
        if (isFile(node)) {
          return makeEntry(target);
        }

        // If it's a directory: list entries
        if (isDirectory(node)) {
          const entries = Object.keys(node.entries).sort();
          return makeEntry(entries.join("  ") || "(empty)");
        }

        return makeEntry("(unknown node type)");
      }

      if (cmd === "cd") {
        const rawTarget = args[0];

        if (rawTarget === "-") {
          const prev = previousDirRef.current;
          if (!prev) return makeEntry(`cd: OLDPWD not set`);
          const node = getNodeAt(prev);
          if (!node || !isDirectory(node)) return makeEntry(`cd: ${prev}: No such file or directory`);
          const old = path;
          previousDirRef.current = old;
          setPath(prev);
          return makeEntry(prev);
        }

        const targetPath = resolvePath(rawTarget ?? "/");
        const node = getNodeAt(targetPath);

        if (!node) {
          return makeEntry(`cd: ${rawTarget ?? "/"}: No such file or directory`);
        }

        if (!isDirectory(node)) {
          return makeEntry(`cd: not a directory: ${rawTarget}`);
        }

        // record previous directory for `cd -`
        previousDirRef.current = path;
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

        // Fallback for future file types
        return makeEntry("");
      }

      if (cmd === "echo") {
        return makeEntry(args.join(" "));
      }

      if (cmd === "help") {
        return makeEntry(`Commands: ${COMMANDS.join(", ")}`);
      }

      return makeEntry(`command not found: ${cmd}`);
    },
    [getNodeAt, path, resolvePath]
  );

  const submit = useCallback(() => {
    const trimmed = input.trim();
    const entry = run(input);
    const cmd = trimmed.split(/\s+/)[0];

    // For `clear` don't record history 
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

    const tokens = raw.split(/\s+/);
    if (!tokens.length) return;

    const isFirstToken = tokens.length === 1;
    const lastToken = tokens[tokens.length - 1];
    if (!lastToken) return;

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

        const nextTokens = [...tokens];
        nextTokens[nextTokens.length - 1] = replacement;
        newInput = nextTokens.join(" ");
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

    if (isFirstToken) {
      const matches = COMMANDS.filter((c) => c.startsWith(lastToken));
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

    const cmd = tokens[0];
    const hasSlash = lastToken.includes("/");

    const basePart = hasSlash
      ? lastToken.slice(0, lastToken.lastIndexOf("/"))
      : ".";

    const prefixPart = hasSlash
      ? lastToken.slice(lastToken.lastIndexOf("/") + 1)
      : lastToken;

    const basePath = resolvePath(basePart);
    const baseNode = getNodeAt(basePath);
    if (!isDirectory(baseNode)) return;

    const entries = Object.entries(baseNode.entries);
    const matches = entries
      .filter(([name, node]) => {
        if (!name.startsWith(prefixPart)) return false;

        if (cmd === "cd") {
          return isDirectory(node);
        }
        if (cmd === "cat") {
          return isFile(node);
        }

        return true;
      })
      .map(([name]) => name);

    if (!matches.length) return;

    const buildReplacement = (name: string) =>
      basePart === "." ? name : `${basePart}/${name}`;

    if (matches.length === 1) {
      // single match? just complete it
      replaceLastToken(buildReplacement(matches[0]));
      setCompletion(null);
      return;
    }
    
    const prefix = longestCommonPrefix(matches);
    let newInput = raw;

    if (prefix.length > prefixPart.length) {
      const nextTokens = [...tokens];
      const newName = buildReplacement(prefix);
      nextTokens[nextTokens.length - 1] = newName;
      newInput = nextTokens.join(" ");
      setInput(newInput);
    }

    setCompletion({
      kind: "path",
      options: matches,
      index: -1,
      seedInput: newInput,
      basePart,
    });
  }, [completion, getNodeAt, input, resolvePath]);

  return {
    state: { path, cwdNode, history, input, completion },
    setInput,
    setPath,
    setHistory,
    submit,
    complete,
    navigateHistory,
  };
}
