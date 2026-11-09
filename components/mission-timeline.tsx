"use client";

import * as React from "react";
import { Check, Circle, Clock, Lock, Star } from "lucide-react";
import { cn } from "cn";

const STEPS = [
  { key: "ouvert", label: "Publié", icon: Circle },
  { key: "attribué", label: "Attribué", icon: Lock },
  { key: "terminé", label: "Terminé", icon: Check },
  { key: "payé", label: "Payé", icon: Star },
];

type MissionTimelineProps = {
  status: string;
  escrowStatus?: "pending" | "released" | "refunded" | null;
};

export function MissionTimeline({ status, escrowStatus }: MissionTimelineProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === status);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  // If escrow is released, mark as paid
  const paidIndex = escrowStatus === "released" ? 3 : -1;

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const isCompleted = i < activeIndex || (i === 3 && paidIndex === 3);
        const isActive = i === activeIndex && !(i === 3 && paidIndex === 3);

        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2 transition-colors sm:size-9",
                  isCompleted
                    ? "border-primary bg-primary text-ink"
                    : isActive
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-hairline bg-muted text-muted-foreground"
                )}
              >
                <Icon className="size-3.5 sm:size-4" aria-hidden="true" />
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium sm:text-xs",
                  isCompleted || isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={cn(
                  "h-0.5 w-4 flex-1 rounded-full sm:w-8",
                  i < activeIndex || (i === 2 && paidIndex === 3)
                    ? "bg-primary"
                    : "bg-hairline"
                )}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
