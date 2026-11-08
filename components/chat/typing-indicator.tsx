"use client";

import * as React from "react";

export function TypingIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  const label =
    names.length === 1
      ? `${names[0]} écrit…`
      : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]} écrivent…`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </span>
      <span>{label}</span>
    </div>
  );
}
