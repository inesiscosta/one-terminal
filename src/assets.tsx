import React from "react";

// TODO: Add windows and linux icons
// FIX: use "real" macOS icons
export const MacCloseIcon: React.FC = () => (
  <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
    <path
      d="M1.3 1.3 L5.7 5.7 M5.7 1.3 L1.3 5.7"
      stroke="rgba(0,0,0,0.6)"
      strokeWidth="0.8"
      strokeLinecap="round"
    />
  </svg>
);

export const MacMinIcon: React.FC = () => (
  <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
    <line
      x1="1.2"
      y1="3.5"
      x2="5.8"
      y2="3.5"
      stroke="rgba(0,0,0,0.6)"
      strokeWidth="0.8"
      strokeLinecap="round"
    />
  </svg>
);

export const MacMaxIcon: React.FC = () => (
  <svg width="7" height="7" viewBox="0 0 7 7" aria-hidden="true">
    <path
      d="M3.5 1.1 L5.9 3.5 L3.5 5.9 L1.1 3.5 Z"
      fill="rgba(0,0,0,0.6)"
    />
  </svg>
);
