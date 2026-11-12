import React, { useState } from 'react';
import type { TerminalWindowChrome } from './types';
import {
  LinuxCloseIcon,
  LinuxMaxIcon,
  LinuxMinIcon,
  MacCloseIcon,
  MacMaxIcon,
  MacMinIcon,
  WinCloseIcon,
  WinMaxIcon,
  WinMinIcon,
} from './assets';

function makeTitlebarStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
  };

  if (chrome.style === 'mac') return { ...base, padding: '12px' };
  if (chrome.style === 'windows') {
    return {
      ...base,
      height: 32,
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.181)',
    };
  }
  return { ...base, justifyContent: 'flex-end' };
}

function makeTitleStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 13,
    color: chrome.titleBarTextColor,
    pointerEvents: 'none',
    userSelect: 'none',
  };

  if (chrome.style === 'mac' || chrome.style === 'linux') {
    return {
      ...base,
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  return { ...base, marginLeft: 10 };
}

function makeWindowControlsContainerStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: chrome.buttonColors.iconColor,
    height: '100%',
  };

  if (chrome.style === 'mac') return { ...base, gap: 8 };
  return base;
}

type ControlKind = 'close' | 'min' | 'max';
type HoverState = ControlKind | 'mac-container' | null;

function makeMacControlStyle(chrome: TerminalWindowChrome, kind: ControlKind): React.CSSProperties {
  const background =
    kind === 'close' ? chrome.buttonColors.close : kind === 'min' ? chrome.buttonColors.min : chrome.buttonColors.max;

  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 11,
    height: 11,
    borderRadius: '50%',
    padding: 0,
    background: background,
  };
}

function makeWindowsControlStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  let background = 'transparent';
  if (hovered) {
    if (kind === 'close') background = chrome.buttonColors.close!;
    else if (kind === 'min') background = chrome.buttonColors.min!;
    else background = chrome.buttonColors.max!;
  }

  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: '100%',
    background,
    transition: 'background 0.1s',
  };
}

function makeLinuxControlOuterStyle(): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
  };
}

function makeLinuxControlInnerCircleStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: '50%',
    zIndex: 1,
    background: 'transparent',
  };

  if (!hovered) return base;

  const background =
    kind === 'close' ? chrome.buttonColors.close : kind === 'min' ? chrome.buttonColors.min : chrome.buttonColors.max;

  return { ...base, background };
}

export const WindowChrome: React.FC<{ chrome: TerminalWindowChrome; title: string }> = ({ chrome, title }) => {
  const [hoveredControl, setHoveredControl] = useState<HoverState>(null);

  const handleMouseEnter = (kind: HoverState) => setHoveredControl(kind);
  const handleMouseLeave = () => setHoveredControl(null);

  const controls = (['close', 'min', 'max'] as ControlKind[]).map((kind) => {
    const Icon =
      chrome.style === 'mac' ? (
        kind === 'close' ? (
          <MacCloseIcon />
        ) : kind === 'min' ? (
          <MacMinIcon />
        ) : (
          <MacMaxIcon />
        )
      ) : chrome.style === 'windows' ? (
        kind === 'min' ? (
          <WinMinIcon />
        ) : kind === 'max' ? (
          <WinMaxIcon />
        ) : (
          <WinCloseIcon />
        )
      ) : kind === 'min' ? (
        <LinuxMinIcon />
      ) : kind === 'max' ? (
        <LinuxMaxIcon />
      ) : (
        <LinuxCloseIcon />
      );

    // Windows Logic
    if (chrome.style === 'windows') {
      const isHovered = hoveredControl === kind;
      return (
        <span
          key={kind}
          style={makeWindowsControlStyle(chrome, kind, isHovered)}
          title={kind}
          onMouseEnter={() => handleMouseEnter(kind)}
          onMouseLeave={handleMouseLeave}
        >
          {Icon}
        </span>
      );
    }

    // Linux Logic
    if (chrome.style === 'linux') {
      const isHovered = hoveredControl === kind;
      return (
        <span
          key={kind}
          style={makeLinuxControlOuterStyle()}
          title={kind}
          onMouseEnter={() => handleMouseEnter(kind)}
          onMouseLeave={handleMouseLeave}
        >
          <span style={makeLinuxControlInnerCircleStyle(chrome, kind, isHovered)} />
          {Icon}
        </span>
      );
    }

    return (
      <span key={kind} style={makeMacControlStyle(chrome, kind)} title={kind}>
        <span
          style={{
            opacity: hoveredControl === 'mac-container' ? 1 : 0,
            transition: 'opacity 120ms ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          {Icon}
        </span>
      </span>
    );
  });

  return (
    <div style={makeTitlebarStyle(chrome)} aria-hidden="true">
      {chrome.style === 'mac' && (
        <>
          <div
            style={makeWindowControlsContainerStyle(chrome)}
            onMouseEnter={() => handleMouseEnter('mac-container')}
            onMouseLeave={handleMouseLeave}
          >
            {controls}
          </div>
          <div style={makeTitleStyle(chrome)}>{title}</div>
        </>
      )}

      {chrome.style === 'windows' && (
        <>
          <div style={makeTitleStyle(chrome)}>{title}</div>
          <div style={makeWindowControlsContainerStyle(chrome)}>
            {controls[1]}
            {controls[2]}
            {controls[0]}
          </div>
        </>
      )}

      {chrome.style === 'linux' && (
        <>
          <div style={makeTitleStyle(chrome)}>{title}</div>
          <div style={makeWindowControlsContainerStyle(chrome)}>
            {controls[1]} {controls[2]} {controls[0]}
          </div>
        </>
      )}
    </div>
  );
};
