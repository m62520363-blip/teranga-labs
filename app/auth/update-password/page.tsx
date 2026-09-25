import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/update-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe",
  description: "Définissez un nouveau mot de passe pour votre compte TERANGA LABS.",
};

export default function UpdatePasswordPage() {
  return (
    <div className="bg-[#0F0F0F] py-16 md:py-24">
      <div className="container-tl">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Nouveau mot de passe
          </h1>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Choisissez un nouveau mot de passe pour votre compte.
          </p>

          <div className="mt-8 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-sm sm:p-8">
            <UpdatePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}