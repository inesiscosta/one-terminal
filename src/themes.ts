import type { TerminalTheme, WindowChromeStyle, TerminalWindowChrome } from "./types";

export const PRESET_THEMES: Record<string, TerminalTheme> = {
  dracula: {
    backgroundColor: "#282a36",
    textColor: "#f8f8f2",
    promptColor: "#50fa7b",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, monospace',
    fontSize: "14px",
    lineHeight: "1.6",
    cursor: {
      shape: "block",
      solidBlock: true,
      color: "#ffffff",
      blink: true,
      blinkRate: 800,
    },
  },
  solarizedDark: {
    backgroundColor: "#002b36",
    textColor: "#93a1a1",
    promptColor: "#b58900",
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, monospace',
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
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, monospace',
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
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, monospace',
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
    fontFamily: '"JetBrainsMono Nerd Font", ui-monospace, monospace',
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

export const CHROME_STYLES: Record<Exclude<WindowChromeStyle, "none">, TerminalWindowChrome> = {
  mac: {
    style: "mac",
    cornerRadius: 14,
    titleBarText: "Terminal",
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    buttonColors: {
      close: "#ff5f56",
      min: "#ffbd2e",
      max: "#27c93f",
      iconColor: "#333",
    },
  },
  windows: {
    style: "windows",
    cornerRadius: 7,
    titleBarText: "Terminal",
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    buttonColors: {
      close: "#ff0000ea",
      min: "#d8d8d850",
      max: "#d8d8d850",
      iconColor: "#ffffff",
    },
  },
  linux: {
    style: "linux",
    cornerRadius: 8,
    titleBarText: "Terminal",
    titleBarTextColor: "rgba(212, 212, 212, 1)",
    buttonColors: {
      close: "#ececec52",
      min: "#ececec52",
      max: "#ececec52",
      iconColor: "#ffffff",
    },
  },
};
