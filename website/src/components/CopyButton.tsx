"use client";

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export default function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200 ${copied
        ? 'bg-green-500/20 text-green-500'
        : 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-gray-300'
        } ${className}`}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          <span className="text-sm font-medium">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          <span className="text-sm font-medium">Copy</span>
        </>
      )}
    </button>
  );
}
