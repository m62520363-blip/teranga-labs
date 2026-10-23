"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "cn";
import type { AppNavLink, AppNavSection, NavIcon } from "@/components/nav/app-nav";

export function initialsOf(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + second).toUpperCase();
}

/** Lien de section de la sidebar (style V8, partagé dashboard + client). */
export function SideLink({
  link,
  active,
  onClick,
}: {
  link: AppNavLink;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = link.icon;
  return (
    <li>
      <Link
        href={link.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
          active
            ? "bg-primary-soft font-semibold text-foreground"
            : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
            active
              ? "bg-primary text-ink"
              : "text-muted-foreground group-hover:text-foreground"
          )}
        >
          <Icon className={active ? "size-4" : "size-5"} aria-hidden="true" />
        </span>
        <span className="truncate">{link.label}</span>
        {active ? (
          <span
            aria-hidden="true"
            className="ml-auto size-1.5 shrink-0 rounded-full bg-primary"
          />
        ) : null}
      </Link>
    </li>
  );
}

/** Sections du menu (titre + liens), identiques ordinateur et tiroir mobile. */
export function NavSections({
  sections,
  isLinkActive,
  onLinkClick,
}: {
  sections: AppNavSection[];
  isLinkActive: (link: AppNavLink) => boolean;
  onLinkClick?: (href: string) => void;
}) {
  return (
    <>
      {sections.map((section) => (
        <div key={section.title} className="mb-5 last:mb-0">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </p>
          <ul className="flex flex-col gap-1">
            {section.links.map((link) => (
              <SideLink
                key={link.href + (link.match ?? "")}
                link={link}
                active={isLinkActive(link)}
                onClick={onLinkClick ? () => onLinkClick(link.href) : undefined}
              />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Bloc profil en bas de sidebar / de tiroir : initiales, nom, e-mail,
 * zone complémentaire (solde, déconnexion…) via `extra`.
 */
export function ProfileBlock({
  href,
  name,
  email,
  label = "Mon compte",
  onLinkClick,
  extra,
}: {
  href: string;
  name: string | null;
  email: string | null;
  label?: string;
  onLinkClick?: () => void;
  extra?: React.ReactNode;
}) {
  const displayName = name?.trim() || label;
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={href}
        onClick={onLinkClick}
        className="flex items-center gap-2.5 rounded-xl p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-light">
          {initialsOf(name)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold text-foreground">
            {displayName}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {email ?? "Mon compte"}
          </span>
        </span>
      </Link>
      {extra}
    </div>
  );
}

/** Icône réexportée pour les shells (évite un import lucide dans chaque vue). */
export type ShellIcon = NavIcon;
