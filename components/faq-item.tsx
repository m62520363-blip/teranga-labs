"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";

export function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-[#2A2A2A]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50 rounded-lg -m-1 px-1"
      >
        <span className="text-[15px] font-medium tracking-tight">
          {question}
        </span>
        <Plus
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-45 text-[#E86A2C]"
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id={undefined}
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden pr-8 text-sm leading-relaxed text-muted-foreground">
          {answer}
        </div>
      </div>
    </div>
  );
}