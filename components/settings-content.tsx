"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Download,
  FileLock2,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  Moon,
  Plus,
  Settings,
  Share2,
  Store,
  Trash2,
  User,
  UserRoundX,
} from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/formatting";
import { cn } from "cn";

export function SettingsContent({
  email,
  name,
  role,
  createdAt,
  company,
  city,
  whatsapp,
  emailConfirmed,
  lastSignIn,
  devPublicUrl,
}: {
  email: string;
  name: string | null;
  role: "client" | "developer" | null;
  createdAt: string;
  company: string | null;
  city: string | null;
  whatsapp: string | null;
  emailConfirmed: boolean;
  lastSignIn: string | null;
  devPublicUrl: string | null;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [changing, setChanging] = React.useState(false);

  const [newEmail, setNewEmail] = React.useState(email);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [emailSending, setEmailSending] = React.useState(false);
  const [emailDone, setEmailDone] = React.useState(false);

  const [deleteConfirm, setDeleteConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem("tl-reduce-motion");
    const enabled = stored === "1";
    setReduceMotion(enabled);
    document.documentElement.toggleAttribute("data-reduce-motion", enabled);
  }, []);

  const toggleReduceMotion = (enabled: boolean) => {
    setReduceMotion(enabled);
    window.localStorage.setItem("tl-reduce-motion", enabled ? "1" : "0");
    document.documentElement.toggleAttribute("data-reduce-motion", enabled);
  };

  const exportData = () => {
    const data = {
      service: "TERANGA LABS",
      exportedAt: new Date().toISOString(),
      profil: {
        email,
        emailConfirmé: emailConfirmed,
        nom: name,
        rôle: role === "client" ? "client" : role === "developer" ? "développeur" : null,
        structure: company,
        ville: city,
        whatsapp,
        membreDepuis: createdAt,
        dernièreConnexion: lastSignIn,
        profilPublic: devPublicUrl ? `https://${window.location.host}${devPublicUrl}` : null,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mes-donnees-teranga-labs.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isClient = role === "client";
  const isDev = role === "developer";

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Configuration Supabase manquante.");
      return;
    }
    setChanging(true);
    const supabase = createClient();
    const { error: sessionError } = await supabase.auth.refreshSession();
    if (sessionError) {
      setChanging(false);
      setError("Session expirée. Reconnectez-vous puis réessayez.");
      return;
    }
    const { error: updateError, data } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (updateError?.message?.toLowerCase().includes("reauthentication") ||
        updateError?.status === 403) {
      setError("Sécurité : réauthentifiez-vous puis réessayez. Si le problème persiste, déconnectez-vous et reconnectez-vous.");
    } else if (updateError) {
      setError(updateError.message);
    } else if (!data.user) {
      setError("Impossible de mettre à jour le mot de passe.");
    } else {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChanging(false);
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailDone(false);
    const target = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setEmailError("Adresse email invalide.");
      return;
    }
    if (target === email) {
      setEmailError("Cette adresse est déjà celle de votre compte.");
      return;
    }
    setEmailSending(true);
    const supabase = createClient();
    const { error: sessionError } = await supabase.auth.refreshSession();
    if (sessionError) {
      setEmailSending(false);
      setEmailError("Session expirée. Reconnectez-vous puis réessayez.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: target });
    setEmailSending(false);
    if (error) {
      if (
        error.message?.toLowerCase().includes("reauthentication") ||
        error.status === 403
      ) {
        setEmailError(
          "Sécurité : réauthentifiez-vous puis réessayez. Si le problème persiste, déconnectez-vous et reconnectez-vous."
        );
      } else if (
        error.message?.toLowerCase().includes("already been registered") ||
        error.message?.toLowerCase().includes("already exists")
      ) {
        setEmailError("Cette adresse est déjà utilisée par un autre compte.");
      } else {
        setEmailError(error.message);
      }
      return;
    }
    setEmailDone(true);
  };

  const submitDelete = async () => {
    setDeleteError(null);
    if (deleteConfirm.trim() !== "SUPPRIMER") {
      setDeleteError('Tapez "SUPPRIMER" pour confirmer.');
      return;
    }
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_account", {
      p_confirm: deleteConfirm.trim(),
    });
    if (error) {
      setDeleting(false);
      setDeleteError(error.message || "Suppression impossible. Réessayez.");
      return;
    }
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const homeHref = isClient ? "/client" : "/dashboard";

  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Paramètres
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Gérez votre compte, votre mot de passe et accédez à votre espace.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section
            className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
            aria-label="Mon espace"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <Settings className="size-4 text-[#E86A2C]" aria-hidden="true" />
              Ma navigation
            </h2>
            <ul className="mt-5 flex flex-col gap-2">
              <SideLink href={homeHref} label="Accueil de mon espace" />
              <SideLink href="/conversations" label="Messages" />
              {isClient ? (
                <SideLink href="/poster" label="Publier un brief" icon={<Plus className="size-4" aria-hidden="true" />} />
              ) : null}
              {isDev ? (
                <>
                  <SideLink href="/briefs" label="Voir les briefs" />
                  <SideLink href="/dashboard?tab=profil" label="Compléter mon profil" icon={<User className="size-4" aria-hidden="true" />} />
                  {devPublicUrl ? (
                    <Link
                      href={devPublicUrl}
                      target="_blank"
                      className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#F2F2F2] transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-[#E86A2C]/50"
                    >
                      <Share2 className="size-4 text-[#E86A2C]" aria-hidden="true" />
                      Voir mon profil public
                    </Link>
                  ) : null}
                </>
              ) : null}
              <div className="my-2 h-px bg-[#2A2A2A]" />
              <li>
                <SignOutButton />
              </li>
            </ul>
          </section>

          <div className="flex flex-col gap-6">
            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Informations du compte"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                {isClient ? (
                  <Store className="size-4 text-[#E86A2C]" aria-hidden="true" />
                ) : (
                  <Briefcase className="size-4 text-[#E86A2C]" aria-hidden="true" />
                )}
                Mon compte
              </h2>
              <dl className="mt-5 flex flex-col gap-3 text-sm">
                <InfoRow label="Email" value={email} />
                <InfoRow label="Email confirmé" value={emailConfirmed ? "Oui" : "Non — vérifiez votre boîte mail"} />
                <InfoRow
                  label="Nom"
                  value={name ?? (isClient ? "Client" : "Développeur")}
                />
                <InfoRow
                  label="Rôle"
                  value={isClient ? "Client" : isDev ? "Développeur" : "—"}
                />
                {company ? <InfoRow label="Structure" value={company} /> : null}
                {city ? <InfoRow label="Ville" value={city} /> : null}
                {whatsapp ? <InfoRow label="WhatsApp" value={whatsapp} /> : null}
                <InfoRow
                  label="Dernière connexion"
                  value={lastSignIn ? formatDate(lastSignIn) : "—"}
                />
                <InfoRow
                  label="Membre depuis"
                  value={createdAt ? formatDate(createdAt) : "—"}
                />
              </dl>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Changer le mot de passe"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <KeyRound className="size-4 text-[#E86A2C]" aria-hidden="true" />
                Sécurité
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Changer le mot de passe de votre compte.
              </p>
              <form onSubmit={submitPassword} className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="current-password">Mot de passe actuel</Label>
                  <Input
                    id="current-password"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="h-10 rounded-xl"
                    autoComplete="current-password"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-10 rounded-xl"
                    autoComplete="new-password"
                    placeholder="Au moins 8 caractères"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 rounded-xl"
                    autoComplete="new-password"
                  />
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                {success ? (
                  <p role="status" className="text-sm text-[#4ADE80]">
                    Mot de passe mis à jour.
                  </p>
                ) : null}
                <Button type="submit" disabled={changing || !currentPassword || !newPassword} className="h-10">
                  {changing ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <KeyRound className="size-4" aria-hidden="true" />
                  )}
                  Mettre à jour le mot de passe
                </Button>
              </form>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Changer l'adresse email"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Mail className="size-4 text-[#E86A2C]" aria-hidden="true" />
                Email de connexion
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Changez l&apos;adresse utilisée pour vous connecter. Un email de
                confirmation est envoyé à l&apos;ancienne et à la nouvelle adresse.
              </p>
              <form onSubmit={submitEmail} className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-email">Nouvelle adresse email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      setEmailDone(false);
                    }}
                    className="h-10 rounded-xl"
                    autoComplete="email"
                  />
                </div>
                {emailError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {emailError}
                  </p>
                ) : null}
                {emailDone ? (
                  <p role="status" className="text-sm text-[#4ADE80]">
                    Demande envoyée. Confirmez le changement depuis vos boîtes
                    mail (ancienne et nouvelle adresse).
                  </p>
                ) : null}
                <Button
                  type="submit"
                  disabled={emailSending || newEmail.trim() === email}
                  className="h-10"
                >
                  {emailSending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Mail className="size-4" aria-hidden="true" />
                  )}
                  Demander le changement d&apos;email
                </Button>
              </form>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Préférences"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Moon className="size-4 text-[#E86A2C]" aria-hidden="true" />
                Préférences
              </h2>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#2A2A2A] bg-[#0F0F0F] p-4">
                <label htmlFor="reduce-motion" className="cursor-pointer text-sm">
                  <span className="block font-medium text-foreground">Réduire les animations</span>
                  <span className="block text-sm text-muted-foreground">
                    Limite les transitions sur tout le site, sur cet appareil.
                  </span>
                </label>
                <button
                  id="reduce-motion"
                  type="button"
                  role="switch"
                  aria-checked={reduceMotion}
                  onClick={() => toggleReduceMotion(!reduceMotion)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#E86A2C]/60",
                    reduceMotion ? "bg-[#E86A2C]" : "bg-[#2A2A2A]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block size-4 translate-x-1 rounded-full bg-white transition-transform duration-200",
                      reduceMotion && "translate-x-6"
                    )}
                  />
                </button>
              </div>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Mes données"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <Download className="size-4 text-[#E86A2C]" aria-hidden="true" />
                Mes données
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Téléchargez une copie des informations de votre profil, ou faites
                valoir vos droits (accès, rectification, suppression) par écrit.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={exportData}
                  className="btn btn-invert"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Exporter mes données
                </button>
                <Link
                  href="/contact"
                  className="btn btn-secondary"
                >
                  <FileLock2 className="size-4" aria-hidden="true" />
                  Contacter pour mes droits
                </Link>
              </div>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Aide et légal"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <MessageCircle className="size-4 text-[#E86A2C]" aria-hidden="true" />
                Aide &amp; légal
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <SideLink href="/faq" label="Questions fréquentes — FAQ" />
                <SideLink href="/contact" label="Contacter l’équipe" />
                <SideLink href="/conditions-utilisation" label="Conditions d’utilisation" />
                <SideLink href="/politique-de-confidentialite" label="Politique de confidentialité" />
                <SideLink href="/cookies" label="Politique de cookies" />
              </div>
            </section>

            <section
              className="rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 sm:p-8"
              aria-label="Zone de danger"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-destructive">
                <Trash2 className="size-4" aria-hidden="true" />
                Supprimer mon compte
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Supprime définitivement votre compte, vos briefs, vos
                discussions et vos données associées. Cette action est
                irréversible.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="delete-confirm">
                    Tapez <span className="font-semibold text-destructive">SUPPRIMER</span> pour confirmer
                  </Label>
                  <Input
                    id="delete-confirm"
                    value={deleteConfirm}
                    onChange={(e) => {
                      setDeleteConfirm(e.target.value);
                      setDeleteError(null);
                    }}
                    className="h-10 rounded-xl"
                    placeholder="SUPPRIMER"
                    aria-label="Confirmation de suppression de compte"
                  />
                </div>
                {deleteError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={submitDelete}
                  disabled={deleting}
                  className="h-10 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <UserRoundX className="size-4" aria-hidden="true" />
                  )}
                  Supprimer définitivement mon compte
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#F2F2F2] transition-colors outline-none hover:bg-muted [&>svg:first-child]:text-[#E86A2C]",
        !icon && "hover:underline underline-offset-4"
      )}
    >
      {icon ?? (
        <span className="flex size-4 items-center justify-center text-[#E86A2C]">
          <MessageCircle className="size-4" aria-hidden="true" />
        </span>
      )}
      {label}
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#2A2A2A] py-2 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}