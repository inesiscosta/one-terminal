import type {
  TerminalTheme,
  WindowChromeStyle,
  TerminalWindowChrome,
} from "./types";

export const CHROME_STYLES: Record<Exclude<WindowChromeStyle, "none">, TerminalWindowChrome> = {
  mac: {
    style: "mac",
    buttonColors: {
      close: "#ff5f56",
      min: "#ffbd2e",
      max: "#27c93f",
    },
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    cornerRadius: 10,
    macButtonsInnerColor: "#333",
  },
  windows: {
    style: "windows",
    buttonColors: {
      close: "#f2f2f2",
      min: "#f2f2f2",
      max: "#f2f2f2",
    },
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    cornerRadius: 0,
  },
  linux: {
    style: "linux",
    buttonColors: {
      close: "#f2f2f2",
      min: "#f2f2f2",
      max: "#f2f2f2",
    },
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    cornerRadius: 8,
  },
};

export const PRESET_THEMES: Record<string, TerminalTheme> = {
  dracula: {
    backgroundColor: "#282a36",
    textColor: "#f8f8f2",
    promptColor: "#50fa7b",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "block",
      solidBlock: true,
      color: "#ffffff",
      blink: true,
      blinkRate: 600,
    },
  },
  solarizedDark: {
    backgroundColor: "#002b36",
    textColor: "#93a1a1",
    promptColor: "#b58900",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "block",
      solidBlock: true,
      color: "#93a1a1",
      blink: true,
      blinkRate: 600,
    },
  },
  solarizedLight: {
    backgroundColor: "#fdf6e3",
    textColor: "#657b83",
    promptColor: "#b58900",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "block",
      solidBlock: true,
      color: "#657b83",
      blink: true,
      blinkRate: 600,
    },
  },
  monokai: {
    backgroundColor: "#272822",
    textColor: "#f8f8f2",
    promptColor: "#a6e22e",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "line",
      color: "#f8f8f2",
      blink: true,
      blinkRate: 600,
    },
  },
  githubLight: {
    backgroundColor: "#f6f8fa",
    textColor: "#24292e",
    promptColor: "#0366d6",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "line",
      color: "#24292e",
      blink: true,
      blinkRate: 600,
    },
  },
};
