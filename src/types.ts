import type React from "react";

export type BuiltInTheme = "dracula" | "solarizedDark" | "solarizedLight" | "monokai" | "light";

export type WindowChromeStyle = "mac" | "windows" | "linux" | "none";

export type CursorShape = "beam" | "block" | "underline";

export type DemoEndBehavior = "freeze" | "interactive" | "loop";

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
  titleBarText: string;
  titleBarTextColor: string;
  buttonColors: {
    close: string;
    min: string;
    max: string;
    iconColor: string;
  };
};

export type DemoScriptStep = string | {
  line: string;
  charDelayMs?: number;
  afterLineDelayMs?: number;
};

export type TerminalDemoConfig = {
  script: DemoScriptStep[];
  defaultCharDelayMs?: number;
  defaultAfterLineDelayMs?: number;
  behavior?: DemoEndBehavior;
  mode?: "run" | "type-writer";
  loopDelayMs?: number;
};

export type TextFileNode = {
  kind: "file";
  fileType: "text";
  content: string;
};

export type LinkFileNode = {
  kind: "file";
  fileType: "link";
  href: string;
  label?: string;
  target?: "_blank" | "_self";
};

export type FileNode = TextFileNode | LinkFileNode;

export type DirectoryNode = {
  kind: "directory";
  entries: Record<string, FSNode>;
};

export type FSNode = FileNode | DirectoryNode;

export type ExtraCommandFileScope =
  | "none"
  | "any"
  | "directories"
  | "files"
  | "textFiles"
  | "linkFiles";

export type ExtraCommandCompletionConfig = {
  mode?: "paths" | "none";
  fileScope?: Exclude<ExtraCommandFileScope, "none">;
};

export type ExtraCommandContext = {
  getNodeAt: (path: string) => FSNode | null;
  resolvePath: (path: string) => string;
  cwd: DirectoryNode | null;
  path: string;
};

export type ExtraCommandDefinition = {
  run: (args: string[], ctx: ExtraCommandContext) => React.ReactNode;
  completion?: ExtraCommandCompletionConfig;
};

export type ExtraCommands = Record<string, ExtraCommandDefinition>;

export type CompletionState =
  | {
    kind: "command";
    options: string[];
    index: number;
    seedInput: string;
  }
  | {
    kind: "path";
    options: string[];
    index: number;
    seedInput: string;
    basePart: string;
  };

export type HistoryEntry = {
  in: string;
  out?: React.ReactNode;
  prompt?: string;
};

export type TerminalProps = {
  fileStructure: DirectoryNode;
  startPath: string;
  welcomeMessage: string;
  prompt: string;
  windowChrome:
  | WindowChromeStyle
  | Partial<TerminalWindowChrome>
  | [WindowChromeStyle, Partial<TerminalWindowChrome>];
  theme:
  | BuiltInTheme
  | Partial<TerminalTheme>
  | [BuiltInTheme, Partial<TerminalTheme>];
  extraCommands?: ExtraCommands;
  className?: string;
  demo?: TerminalDemoConfig;
  style?: React.CSSProperties;
};
