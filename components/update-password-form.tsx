"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Au moins 8 caractères")
      .regex(/[A-Za-z]/, "Au moins une lettre")
      .regex(/\d/, "Au moins un chiffre"),
    password_confirmation: z.string().min(1, "Confirmez le mot de passe"),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Les mots de passe ne correspondent pas",
    path: ["password_confirmation"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [state, setState] = React.useState<"reading" | "ready" | "invalid">(
    "reading"
  );
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setState("invalid");
      return;
    }

    const supabase = createClient();
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        setState(error ? "invalid" : "ready");
      });
  }, []);

  const onSubmit = async (values: PasswordFormValues) => {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (error) {
      setFormError("Impossible de mettre à jour le mot de passe. Réessayez.");
      return;
    }
    toast.success("Mot de passe mis à jour");
    router.replace("/dashboard");
    router.refresh();
  };

  if (state === "reading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Vérification de votre session…
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm">
          Ce lien de réinitialisation est invalide ou expiré.
        </p>
        <a
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#F2F2F2] px-5 text-sm font-medium text-[#0D0D0D]"
        >
          Retour à la connexion
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pw-password">Nouveau mot de passe</Label>
        <Input
          id="pw-password"
          type="password"
          autoComplete="new-password"
          className="h-10 rounded-xl"
          {...register("password")}
          aria-invalid={Boolean(errors.password)}
        />
        {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pw-confirm">Confirmez le mot de passe</Label>
        <Input
          id="pw-confirm"
          type="password"
          autoComplete="new-password"
          className="h-10 rounded-xl"
          {...register("password_confirmation")}
          aria-invalid={Boolean(errors.password_confirmation)}
        />
        {errors.password_confirmation ? (
          <p className="text-xs text-destructive">{errors.password_confirmation.message}</p>
        ) : null}
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isSubmitting} className="h-11 rounded-xl">
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Save className="size-4" aria-hidden="true" />
        )}
        Mettre à jour le mot de passe
      </Button>
    </form>
  );
}