import React from "react";

export const MacOsWindowButtons = {
  Close: () => (
    <svg viewBox="0 0 100 100" aria-hidden>
      <path d="M 25 25 L 75 75 M 75 25 L 25 75" stroke="currentColor" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
    </svg>
  ),
  Min: () => (
    <svg viewBox="0 0 100 100" aria-hidden>
      <path d="M 22 43 L 78 43 C 82 43 85 45 85 48 L 85 52 C 85 55 82 57 78 57 L 22 57 C 18 57 15 55 15 52 L 15 48 C 15 45 18 43 22 43 Z" strokeWidth="14" fill="currentColor" />
    </svg>
  ),
  Max: () => (
    <svg viewBox="0 0 100 100" aria-hidden>
      <path d="M 57 23 C 61 23 61 25 57 29 L 29 59 C 25 63 23 63 23 59 L 23 29 C 23 25 25 23 29 23 L 57 23 Z M 40 76 C 36 76 36 74 40 70 L 68 41 C 72 37 75 37 75 41 L 75 70 C 75 74 72 76 68 76 L 40 76 Z" fill="currentColor"/>
    </svg>
  ),
};

export const MacOsTrafficLight: React.FC = () => {
  const { Close, Min, Max } = MacOsWindowButtons;
  return (
    <div className="rt-traffic mac-traffic" aria-hidden="true">
      <span className="rt-traffic-dot close" role="presentation" title="Close">
        <span className="mac-icon"><Close /></span>
      </span>

      <span className="rt-traffic-dot min" role="presentation" title="Minimize">
        <span className="mac-icon"><Min /></span>
      </span>

      <span className="rt-traffic-dot max" role="presentation" title="Zoom">
        <span className="mac-icon"><Max /></span>
      </span>
    </div>
  );
};

export default MacOsTrafficLight;
