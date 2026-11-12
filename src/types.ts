import type React from 'react';

export type BuiltInTheme = 'dracula' | 'solarizedDark' | 'solarizedLight' | 'monokai' | 'light';

export type WindowChromeStyle = 'mac' | 'windows' | 'linux' | 'none';

export type CursorShape = 'beam' | 'block' | 'underline';

export type DemoEndBehavior = 'freeze' | 'interactive' | 'loop';

/**
 * How the current directory is shown in the window title bar.
 * - "basename": only the last folder (e.g. `projects`), `~` at the root
 * - "full": the full path (e.g. `~/work/projects`)
 * - "none": don't show the directory
 */
export type TitleBarCwdMode = 'basename' | 'full' | 'none';

export type CursorOptions = {
  shape: CursorShape;
  solidBlock?: boolean;
  color: string;
  blink: boolean;
  blinkRate: number;
};

export type TerminalTheme = Partial<{
  backgroundColor: string;
  textColor: string;
  promptColor: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  cursor: Partial<CursorOptions>;
}>;

export type TerminalWindowChrome = {
  style: WindowChromeStyle;
  cornerRadius: number;
  /**
   * Title bar text. Supports the placeholders `{cwd}` (last folder),
   * `{path}` (full path) and `{user}`. When no placeholder is used, the
   * current directory is appended according to `titleBarCwd`.
   */
  titleBarText: string;
  /** How the current directory is appended to the title. Defaults to "basename". */
  titleBarCwd: TitleBarCwdMode;
  /** Separator between `titleBarText` and the appended directory. Defaults to " — ". */
  titleBarSeparator: string;
  titleBarTextColor: string;
  buttonColors: {
    close: string;
    min: string;
    max: string;
    iconColor: string;
  };
};

export type DemoScriptStep =
  | string
  | {
      line: string;
      charDelayMs?: number;
      afterLineDelayMs?: number;
    };

export type TerminalDemoConfig = {
  script: DemoScriptStep[];
  defaultCharDelayMs?: number;
  defaultAfterLineDelayMs?: number;
  behavior?: DemoEndBehavior;
  mode?: 'run' | 'type-writer';
  loopDelayMs?: number;
};

export type TextFileNode = {
  kind: 'file';
  fileType: 'text';
  content: string;
};

export type LinkFileNode = {
  kind: 'file';
  fileType: 'link';
  href: string;
  label?: string;
  target?: '_blank' | '_self';
};

export type FileNode = TextFileNode | LinkFileNode;

export type DirectoryNode = {
  kind: 'directory';
  entries: Record<string, FSNode>;
};

export type FSNode = FileNode | DirectoryNode;

export type ExtraCommandFileScope = 'none' | 'any' | 'directories' | 'files' | 'textFiles' | 'linkFiles';

export type ExtraCommandCompletionConfig = {
  mode?: 'paths' | 'none';
  fileScope?: Exclude<ExtraCommandFileScope, 'none'>;
};

export type CommandInfo = {
  name: string;
  /** Usage line, e.g. `cat <file>`. */
  usage: string;
  description: string;
  builtin: boolean;
};

export type ExtraCommandContext = {
  getNodeAt: (path: string) => FSNode | null;
  resolvePath: (path: string) => string;
  cwd: DirectoryNode | null;
  path: string;
  /** Every available command (built-in and extra), handy for writing a custom `help`. */
  commands: CommandInfo[];
  /** Previously executed commands, oldest first. */
  history: string[];
  /** Text piped into the command (e.g. `cat file | mycommand`), if any. */
  stdin?: string;
};

export type ExtraCommandDefinition = {
  run: (args: string[], ctx: ExtraCommandContext) => React.ReactNode;
  completion?: ExtraCommandCompletionConfig;
  /** One-line description shown by `help`. */
  description?: string;
  /** Usage shown by `help`, e.g. `projects [name]`. Defaults to the command name. */
  usage?: string;
  /** Longer text shown by `help <command>`. */
  details?: string;
  /** Hide this command from `help` and tab completion. */
  hidden?: boolean;
};

export type ExtraCommands = Record<string, ExtraCommandDefinition>;

export type CompletionState = {
  kind: 'command' | 'path';
  options: string[];
  index: number;
  seedInput: string;
  /** Text before the word being completed. */
  linePrefix: string;
  /** Directory part of the path being completed ("" for none). */
  basePart: string;
};

export type HistorySearchState = {
  direction: 'reverse' | 'forward';
  query: string;
  /** Index of the current match in the command history, or null if none yet. */
  index: number | null;
  failed: boolean;
  /** The line that was being edited when the search started. */
  original: string;
};

export type HistoryEntry = {
  in: string;
  out?: React.ReactNode;
  prompt?: string;
};

export type NeofetchConfig = {
  /** ASCII art shown on the left. */
  logo?: string;
  /**
   * Lines shown next to the logo, as label → value (e.g. `{ Role: "Engineer", Skills: "..." }`).
   * Replaces the default system info when given.
   */
  info?: Record<string, string>;
  /** Show the row of color blocks. Defaults to true. */
  colors?: boolean;
};

export type TerminalProps = {
  fileStructure: DirectoryNode;
  startPath: string;
  welcomeMessage: string;
  /** Prompt template. Supports `{cwd}` (last folder), `{path}` (full path), `{user}` and `{host}`. */
  prompt: string;
  /** Username shown by `whoami` and the `{user}` placeholder. Defaults to "guest". */
  username: string;
  /** Hostname used by `neofetch` and the `{host}` placeholder. Defaults to "one-terminal". */
  hostname: string;
  /**
   * Name of the shell, used to prefix shell errors (e.g. `zsh: command not found: foo`)
   * and shown by `neofetch`. Defaults to "zsh".
   */
  shellName: string;
  /** Customize what `neofetch` shows — great for a mini CV. */
  neofetch?: NeofetchConfig;
  windowChrome: WindowChromeStyle | Partial<TerminalWindowChrome> | [WindowChromeStyle, Partial<TerminalWindowChrome>];
  theme: BuiltInTheme | Partial<TerminalTheme> | [BuiltInTheme, Partial<TerminalTheme>];
  extraCommands?: ExtraCommands;
  className?: string;
  demo?: TerminalDemoConfig;
  style?: React.CSSProperties;
};
