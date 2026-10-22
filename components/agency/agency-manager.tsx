"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Building2,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  asMyAgency,
  type MyAgency,
  type MyAgencyMember,
} from "@/types/agency";
import { cn } from "cn";

const STATUS_LABEL: Record<MyAgency["status"], string> = {
  pending: "En attente de validation",
  active: "Agence active",
  suspended: "Agence suspendue",
};

function friendlyRpcError(error: unknown): string {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  const base = message || "Une erreur est survenue, réessayez.";
  if (/TLLOW|tokens insuffisants/i.test(base)) {
    return "Solde insuffisant : la création d'une agence coûte 4 Tokens. Rechargez depuis Mon wallet, puis réessayez.";
  }
  return base;
}

export default function AgencyManager() {
  const [agency, setAgency] = React.useState<MyAgency | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [form, setForm] = React.useState({
    name: "",
    slug: "",
    city: "",
    country: "",
    website: "",
  });
  const [joinCode, setJoinCode] = React.useState("");
  const [joinInfo, setJoinInfo] = React.useState<{
    id: string;
    slug: string;
    name: string;
  } | null>(null);

  const supabase = createClient();

  const refresh = React.useCallback(async () => {
    const { data, error: err } = await supabase.rpc("my_agency");
    if (err) {
      setAgency(null);
      return;
    }
    setAgency(asMyAgency(data));
  }, [supabase]);

  React.useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const createAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_agency", {
      p_name: form.name.trim(),
      p_slug: form.slug.trim().toLowerCase(),
      p_bio: null,
      p_logo_url: null,
      p_city: form.city.trim() || null,
      p_country: form.country.trim() || null,
      p_website: form.website.trim() || null,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    if (data) {
      setNotice("Votre agence a été créée. Elle sera visible après validation.");
      setAgency(null);
      await refresh();
    }
  };

  const lookupInvite = async () => {
    setError("");
    setJoinInfo(null);
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      setError("Saisissez le code d'invitation.");
      return;
    }
    const { data, error: err } = await supabase.rpc("get_agency_by_invite", {
      p_invite_code: code,
    });
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    const info = data as { id?: string; slug?: string; name?: string } | null;
    if (!info?.id || !info.slug) {
      setError("Code d'invitation invalide.");
      return;
    }
    setJoinInfo({ id: info.id, slug: info.slug, name: info.name ?? "" });
  };

  const confirmJoin = async () => {
    if (!joinInfo) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("join_agency", {
      p_agency_id: joinInfo.id,
      p_invite_code: joinCode.trim(),
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    if (data) {
      setNotice("Vous avez rejoint l'agence.");
      await refresh();
    }
  };

  const rotateInvite = async () => {
    if (!agency) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("rotate_agency_invite", {
      p_agency_id: agency.id,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    setNotice("Nouveau code d'invitation généré.");
    await refresh();
  };

  const removeMember = async (member: MyAgencyMember) => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("remove_agency_member", {
      p_developer_id: member.developer_id,
    });
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    await refresh();
  };

  const leave = async () => {
    setBusy(true);
    setError("");
    const { error: err } = await supabase.rpc("leave_agency");
    setBusy(false);
    if (err) {
      setError(friendlyRpcError(err));
      return;
    }
    setAgency(null);
    await refresh();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Chargement de votre agence…
      </div>
    );
  }

  if (!agency) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Mon agence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Regroupez vos développeurs sous une même enseigne et gagnez en
            visibilité. Un agence n&apos;est visible qu&apos;après validation.
          </p>
        </div>

        <form
          onSubmit={createAgency}
          className="max-w-xl space-y-4 rounded-2xl border border-hairline bg-card p-5"
        >
          <div className="space-y-1">
            <label htmlFor="agency-name" className="text-sm font-medium">
              Nom de l&apos;agence *
            </label>
            <input
              id="agency-name"
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 w-full rounded-xl border border-hairline bg-background px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
              placeholder="Ex. Atelier Teranga"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="agency-slug" className="text-sm font-medium">
              Adresse de la page (URL) *
            </label>
            <div className="flex h-11 w-full items-center rounded-xl border border-hairline bg-background px-3 text-sm">
              <span className="text-muted-foreground">/agences/</span>
              <input
                id="agency-slug"
                required
                pattern="[a-z0-9][a-z0-9-]{1,39}"
                title="Lettres minuscules, chiffres et tirets uniquement."
                value={form.slug}
                onChange={(e) =>
                  setForm({
                    ...form,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                  })
                }
                className="w-full flex-1 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="atelier-teranga"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="agency-city" className="text-sm font-medium">
                Ville
              </label>
              <input
                id="agency-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-11 w-full rounded-xl border border-hairline bg-background px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="Dakar"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="agency-country" className="text-sm font-medium">
                Pays
              </label>
              <input
                id="agency-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="h-11 w-full rounded-xl border border-hairline bg-background px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="Ex. Côte d'Ivoire"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="agency-website" className="text-sm font-medium">
              Site web
            </label>
            <input
              id="agency-website"
              type="url"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="h-11 w-full rounded-xl border border-hairline bg-background px-3 text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
              placeholder="https://…"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
          ) : null}

          <p className="text-sm text-muted-foreground">
            Création d&apos;agence :{" "}
            <span className="font-semibold text-foreground">4 Tokens</span>{" "}
            débités de votre solde au moment de la création.
          </p>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-ink transition-colors outline-none hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Building2 className="size-4" aria-hidden="true" />
            )}
            Créer mon agence
          </button>
        </form>

        <div className="max-w-xl space-y-4 rounded-2xl border border-hairline bg-card p-5">
          <div>
            <h3 className="text-sm font-semibold">Rejoindre une agence</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Vous avez reçu un code d&apos;invitation ? Saisissez-le.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 space-y-1">
              <label htmlFor="agency-invite" className="text-sm font-medium">
                Code d&apos;invitation
              </label>
              <input
                id="agency-invite"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.trim())}
                className="h-11 w-full rounded-xl border border-hairline bg-background px-3 font-mono text-sm outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/50"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </div>
            <button
              type="button"
              onClick={() => void lookupInvite()}
              disabled={busy}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-hairline bg-background px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
            >
              <Search className="size-4" aria-hidden="true" />
              Vérifier
            </button>
          </div>

          {joinInfo ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary-soft px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="size-4 text-primary" aria-hidden="true" />
                {joinInfo.name}
              </div>
              <button
                type="button"
                onClick={() => void confirmJoin()}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-ink transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                Rejoindre
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const canManage = agency.my_role === "owner" || agency.my_role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{agency.name}</h2>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                agency.status === "active"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : agency.status === "suspended"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-600"
              )}
            >
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {STATUS_LABEL[agency.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {agency.members.length} membre{agency.members.length > 1 ? "s" : ""} ·
            /agences/{agency.slug}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {agency.status === "active" ? (
            <Link
              href={`/agences/${agency.slug}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-background px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
            >
              Voir ma fiche
            </Link>
          ) : null}
          {agency.my_role !== "owner" ? (
            <button
              type="button"
              onClick={leave}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-hairline bg-background px-4 text-sm font-medium text-destructive transition-colors hover:border-destructive/50 disabled:opacity-60"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Quitter
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-hairline bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="size-4 text-primary" aria-hidden="true" />
          Invitations
        </h3>
        {canManage && agency.invite_code ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Partagez ce code avec un développeur pour qu&apos;il rejoigne votre
              agence (onglet « Mon agence » de son dashboard).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-hairline bg-background px-3 py-2 font-mono text-sm">
                {agency.invite_code}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(agency.invite_code ?? "");
                  setNotice("Code copié.");
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-hairline bg-background px-3 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary"
              >
                <Copy className="size-3.5" aria-hidden="true" />
                Copier
              </button>
              <button
                type="button"
                onClick={rotateInvite}
                disabled={busy}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-hairline bg-background px-3 text-xs font-medium transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Régénérer
              </button>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Les codes d&apos;invitation sont réservés aux gestionnaires de
            l&apos;agence.
          </p>
        )}

        {agency.my_role === "member" ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-hairline/60 px-3 py-2 text-xs text-muted-foreground">
            <UserPlus className="size-3.5" aria-hidden="true" />
            Pour rejoindre la même agence : « Mon agence » → « Rejoindre » et
            saisissez le code fourni par un gestionnaire.
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-hairline bg-card p-5">
        <h3 className="text-sm font-semibold">Membres ({agency.members.length})</h3>
        <ul className="mt-3 divide-y divide-hairline">
          {agency.members.map((m) => (
            <li
              key={m.developer_id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {m.avatar_url ? (
                  <Image
                    src={m.avatar_url}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="size-10 shrink-0 rounded-full border border-hairline object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-hairline text-sm font-semibold">
                    {(m.full_name || m.username || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.full_name || (m.role_in_agency === "admin" ? "Gestionnaire" : "Membre")}
                  </p>
                  {m.username ? (
                    <p className="truncate text-xs text-muted-foreground">@{m.username}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-hairline px-2.5 py-1 text-xs text-muted-foreground">
                  {m.role_in_agency === "admin" ? "Admin" : "Membre"}
                </span>
                {canManage && m.role_in_agency !== "admin" ? (
                  <button
                    type="button"
                    onClick={() => removeMember(m)}
                    disabled={busy}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-background text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-60"
                    aria-label={`Retirer ${m.full_name ?? m.username ?? "ce membre"}`}
                    title="Retirer ce membre"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}