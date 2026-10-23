"use client";

import * as React from "react";
import { toast } from "sonner";
import Image from "next/image";
import {
  AlertTriangle,
  Briefcase,
  CheckCheck,
  Edit3,
  HelpCircle,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/client";
import {
  PROJECT_TYPES,
  PUBLICATION_LABELS,
  MISSION_STATUS_LABELS,
  missionStatusBadge,
  projectTypeLabel,
  formatProjectDate,
} from "@/lib/dev-missions-labels";
import { formatDate } from "@/lib/formatting";
import type { MyDeveloperMission } from "@/types/database";

export type TlMissionOption = {
  conversation_id: string;
  name: string;
};

type FormState = {
  id: string | null;
  name: string;
  description: string;
  project_type: string;
  technologies: string;
  url: string;
  screenshots: string;
  role: string;
  key_features: string;
  client_name: string;
  client_authorization: "public" | "confidential" | "clients_only";
  completion_date: string;
  duration: string;
  demo_url: string;
  demo_video_url: string;
  tlConversation: string;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  description: "",
  project_type: "app web",
  technologies: "",
  url: "",
  screenshots: "",
  role: "",
  key_features: "",
  client_name: "",
  client_authorization: "public",
  completion_date: "",
  duration: "",
  demo_url: "",
  demo_video_url: "",
  tlConversation: "",
};

function fromMission(m: MyDeveloperMission): FormState {
  return {
    id: m.id,
    name: m.name,
    description: m.description ?? "",
    project_type: m.project_type ?? "autre",
    technologies: (m.technologies ?? []).join(", "),
    url: m.url ?? "",
    screenshots: (m.screenshots ?? []).join("\n"),
    role: m.role ?? "",
    key_features: (m.key_features ?? []).join("\n"),
    client_name: m.client_name ?? "",
    client_authorization: m.client_authorization ?? "public",
    completion_date: m.completion_date ?? "",
    duration: m.duration ?? "",
    demo_url: m.demo_url ?? "",
    demo_video_url: m.demo_video_url ?? "",
    tlConversation: m.conversation_id ?? "",
  };
}

function toList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function MissionsManager({
  initial,
  tlMissions,
}: {
  initial: MyDeveloperMission[];
  tlMissions: TlMissionOption[];
}) {
  const [missions, setMissions] = React.useState<MyDeveloperMission[]>(initial);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MyDeveloperMission | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<MyDeveloperMission | null>(null);

  const locked = editing?.details_locked ?? false;

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (m: MyDeveloperMission) => {
    setEditing(m);
    setForm(fromMission(m));
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Indiquez le nom de la mission.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      id: form.id ?? undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      project_type: form.project_type || null,
      technologies: toList(form.technologies),
      url: form.url.trim() || null,
      screenshots: toList(form.screenshots),
      role: form.role.trim() || null,
      key_features: toList(form.key_features),
      client_name: form.client_name.trim() || null,
      client_authorization: form.client_authorization,
      completion_date: form.completion_date || null,
      duration: form.duration.trim() || null,
      demo_url: form.demo_url.trim() || null,
      demo_video_url: form.demo_video_url.trim() || null,
    };
    const tlConv =
      !locked && form.tlConversation
        ? form.tlConversation
        : undefined;
    const { data, error } = await supabase.rpc("set_developer_mission", {
      p_payload: payload,
      p_tl_conversation: tlConv,
    });
    setSaving(false);
    if (error) {
      toast.error(
        error.message?.includes("TLBAD")
          ? "Certains champs sont invalides. Vérifiez les URL (http(s)://)."
          : error.message || "Impossible d’enregistrer la mission."
      );
      return;
    }
    setMissions((data as unknown as MyDeveloperMission[]) ?? []);
    setOpen(false);
    setEditing(null);
    toast.success("Mission enregistrée. Elle sera vérifiée par l’équipe.");
  };

  const del = async () => {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_developer_mission", {
      p_mission: confirmDelete.id,
    });
    setDeleting(null);
    if (error) {
      toast.error(error.message || "Impossible de supprimer la mission.");
      return;
    }
    setMissions((prev) => prev.filter((m) => m.id !== confirmDelete.id));
    setConfirmDelete(null);
    toast.success("Mission supprimée.");
  };

  const counts = missions.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Vos missions réalisées
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Présentez vos projets livrés. Une mission est affichée publiquement
            une fois vérifiée par Devmarket.
          </p>
        </div>
        <Button type="button" onClick={openNew} className="h-10">
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une mission réalisée
        </Button>
      </div>

      {missions.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Aucune mission déclarée"
            description="Ajoutez un site vitrine, une application web, un e-commerce… pour enrichir votre profil public et inspirer confiance."
            action={
              <Button type="button" onClick={openNew} className="h-10">
                <Plus className="size-4" aria-hidden="true" />
                Ajouter ma première mission
              </Button>
            }
          />
        </div>
      ) : null}

      {missions.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {missions.map((m) => {
            const status = m.status;
            const badge = missionStatusBadge(status);
            const shot = (m.screenshots ?? [])[0];
            return (
              <li
                key={m.id}
                className="rounded-2xl border border-hairline bg-card p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  {shot ? (
                    <Image
                      src={shot}
                      alt=""
                      loading="lazy"
                      width={384}
                      height={192}
                      unoptimized
                      className="h-24 w-full shrink-0 rounded-xl border border-hairline object-cover md:w-36"
                    />
                  ) : (
                    <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl border border-hairline bg-muted md:w-36">
                      {m.client_authorization === "confidential" ? (
                        <Lock className="size-6 text-primary" aria-hidden="true" />
                      ) : (
                        <Briefcase className="size-6 text-primary" aria-hidden="true" />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{m.name}</p>
                      {m.via_teranga_labs ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                          <ShieldCheck className="size-3" aria-hidden="true" />
                          Devmarket
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {projectTypeLabel(m.project_type)}
                      {formatProjectDate(m.completion_date)
                        ? ` · ${formatProjectDate(m.completion_date)}`
                        : ""}
                      {m.duration ? ` · ${m.duration}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge
                        variant={badge === "success" ? "default" : "secondary"}
                        className="capitalize"
                      >
                        {MISSION_STATUS_LABELS[status] ?? status}
                      </Badge>
                      {m.is_hidden ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error-soft px-2 py-0.5 text-[11px] font-medium text-error">
                          <X className="size-3" aria-hidden="true" />
                          Masquée
                        </span>
                      ) : null}
                      {m.client_authorization === "confidential" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-light">
                          <Lock className="size-3" aria-hidden="true" />
                          Confidentiel
                        </span>
                      ) : null}
                    </div>
                    {m.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {m.description}
                      </p>
                    ) : null}
                    {m.status === "corrections" || m.status === "rejected" ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-xs text-primary-light">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {m.admin_note ?? "Notre équipe vous expliquera les ajustements."}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 md:items-end">
                    {m.mission_ref ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {m.mission_ref}
                      </span>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Ajoutée le {formatDate(m.created_at)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(m)}
                      >
                        <Edit3 className="size-3.5" aria-hidden="true" />
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDelete(m)}
                        className="text-error hover:bg-error-soft"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={(o) => !o && !saving && setOpen(o)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier la mission" : "Ajouter une mission réalisée"}
            </DialogTitle>
            <DialogDescription>
              Décrivez un projet que vous avez livré. Les informations sensibles
              (client, coordonnées) ne sont jamais affichées sans autorisation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={save} className="flex flex-col gap-4">
            {locked ? (
              <div className="rounded-xl border border-success/40 bg-success-soft px-3 py-2.5 text-xs text-success">
                Mission officielle Devmarket : le nom, le type et la date sont
                issus de la mission enregistrée et ne peuvent pas être modifiés.
              </div>
            ) : tlMissions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="ms-tl">
                  Lier à une mission Devmarket (optionnel)
                </Label>
                <Select
                  value={form.tlConversation}
                  onValueChange={(v) =>
                    setForm((f) => {
                      const chosen = tlMissions.find((t) => t.conversation_id === v);
                      return {
                        ...f,
                        tlConversation: v ?? "",
                        ...(chosen
                          ? { name: chosen.name, client_name: chosen.name.split(" · ")[0] }
                          : {}),
                      };
                    })
                  }
                >
                  <SelectTrigger id="ms-tl" className="h-10 w-full rounded-xl">
                    <SelectValue placeholder="— Mission externe —" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectItem value="">— Mission externe —</SelectItem>
                    {tlMissions.map((tl) => (
                      <SelectItem key={tl.conversation_id} value={tl.conversation_id}>
                        {tl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Le nom, le type et la date seront repris officiellement ;
                  le statut devient « Mission vérifiée » automatiquement.
                </p>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-name">Nom du projet *</Label>
              <Input
                id="ms-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={locked}
                required
                className="h-10 rounded-xl"
                placeholder="Application E-commerce"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-type">Type de projet *</Label>
              <Select
                value={form.project_type}
                onValueChange={(v) =>
                  setForm({ ...form, project_type: v ?? "autre" })
                }
                disabled={locked}
              >
                <SelectTrigger id="ms-type" className="h-10 w-full rounded-xl">
                  <SelectValue placeholder="Type de projet" />
                </SelectTrigger>
                <SelectContent align="start">
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-desc">Description courte</Label>
              <Textarea
                id="ms-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="min-h-20 rounded-xl"
                placeholder="E-commerce pour une entreprise locale : catalogue, paiement mobile et suivi des commandes."
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-tech">Technologies utilisées</Label>
              <Input
                id="ms-tech"
                value={form.technologies}
                onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                className="h-10 rounded-xl"
                placeholder="Next.js, Supabase, Tailwind CSS"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-features">Fonctionnalités principales</Label>
              <Textarea
                id="ms-features"
                value={form.key_features}
                onChange={(e) => setForm({ ...form, key_features: e.target.value })}
                className="min-h-16 rounded-xl"
                placeholder="Catalogue produits, Paiement mobile, Espace admin… (une par ligne)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-role">Rôle du développeur</Label>
              <Input
                id="ms-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="h-10 rounded-xl"
                placeholder="Développeur full-stack"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="ms-date">Date de réalisation</Label>
                <Input
                  id="ms-date"
                  type="date"
                  value={form.completion_date}
                  onChange={(e) =>
                    setForm({ ...form, completion_date: e.target.value })
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="ms-duration">Durée de la mission</Label>
                <Input
                  id="ms-duration"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  className="h-10 rounded-xl"
                  placeholder="3 mois"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-url">URL du projet</Label>
              <Input
                id="ms-url"
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="h-10 rounded-xl"
                placeholder="https://www.exemple.com"
              />
              <p className="text-xs text-muted-foreground">
                Affichée sous forme de bouton « Voir le projet ↗ » sans exposer
                la barre d’adresse complète si elle est sensible.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-shots">Captures d’écran</Label>
              <Textarea
                id="ms-shots"
                value={form.screenshots}
                onChange={(e) => setForm({ ...form, screenshots: e.target.value })}
                className="min-h-16 rounded-xl"
                placeholder="https://…/capture-1.png (une par ligne)"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-auth">Autorisation du client</Label>
              <Select
                value={form.client_authorization}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    client_authorization: (v ?? "public") as FormState["client_authorization"],
                  })
                }
              >
                <SelectTrigger id="ms-auth" className="h-10 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {(
                    [
                      "public",
                      "confidential",
                      "clients_only",
                    ] as FormState["client_authorization"][]
                  ).map((v) => (
                    <SelectItem key={v} value={v}>
                      {PUBLICATION_LABELS[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.client_authorization === "confidential" ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Le nom du client, l’URL et les captures ne seront pas affichés.
                  Fournissez éventuellement une URL de présentation ci-dessous.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ms-client">
                Client / entreprise concerné
                {form.client_authorization === "confidential"
                  ? " (non affiché)"
                  : form.client_authorization === "clients_only"
                    ? " (visible par les clients connectés)"
                    : " (publique)"}
              </Label>
              <Input
                id="ms-client"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="h-10 rounded-xl"
                placeholder={
                  form.client_authorization === "confidential"
                    ? "Client confidentiel"
                    : "Entreprise de Dakar"
                }
              />
            </div>

            {form.client_authorization === "confidential" ? (
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <HelpCircle className="size-3.5" aria-hidden="true" />
                  Aperçu masqué (projet confidentiel)
                </p>
                <div className="mt-3 grid gap-3">
                  <Input
                    value={form.demo_url}
                    onChange={(e) => setForm({ ...form, demo_url: e.target.value })}
                    type="url"
                    className="h-9 rounded-lg text-sm"
                    placeholder="URL de démonstration (sans données réelles)"
                  />
                  <Input
                    value={form.demo_video_url}
                    onChange={(e) => setForm({ ...form, demo_video_url: e.target.value })}
                    type="url"
                    className="h-9 rounded-lg text-sm"
                    placeholder="Vidéo de démonstration (URL)"
                  />
                </div>
              </div>
            ) : null}

            <DialogFooter className="mt-2 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !form.name.trim()}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCheck className="size-4" aria-hidden="true" />
                )}
                {editing ? "Enregistrer les modifications" : "Déclarer la mission"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette mission ?</DialogTitle>
            <DialogDescription>
              « {confirmDelete?.name} » ne sera plus visible sur aucun espace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(null)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={del}
              disabled={deleting === confirmDelete?.id}
            >
              {deleting === confirmDelete?.id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {missions.length > 0 ? (
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {Object.entries(counts)
            .map(([k, v]) => `${MISSION_STATUS_LABELS[k] ?? k} : ${v}`)
            .join(" · ")}
        </div>
      ) : null}
    </div>
  );
}