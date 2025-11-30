import { PRESET_THEMES } from "./themes";

export type WindowChromeStyle = "mac" | "windows" | "linux" | "none";

export type CursorShape = "block" | "line" | "underscore";

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

export type TerminalCursorOptions = {
  shape?: CursorShape;
  color?: string;
  blink?: boolean;
  blinkRate?: number;
};

export type TerminalTheme = Partial<{
  backgroundColor: string;
  textColor: string;
  promptColor: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  cursor?: TerminalCursorOptions;
}>;

export type TerminalWindowChrome = {
  style: Exclude<WindowChromeStyle, "none">;
  titleBarText?: string;
  titleBarTextColor?: string;
  buttonColors?: {
    close?: string;
    min?: string;
    max?: string;
  };
  cornerRadius?: number;
};

export type TerminalProps = {
  fileStructure: DirectoryNode;
  startPath?: string;
  welcomeMessage?: string;
  prompt?: string;
  windowChrome?: WindowChromeStyle | TerminalWindowChrome;
  theme?: TerminalTheme | keyof typeof PRESET_THEMES;
  extraCommands?: Record<string, (args: string[], getNodeAt: (path: string) => FSNode | null) => React.ReactNode>;
  className?: string;
};

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
};
