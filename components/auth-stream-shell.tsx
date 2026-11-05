import type { ReactNode } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SiteShell } from "@/components/site-shell";
import { Providers } from "@/components/providers";
import { getCurrentRole, getCurrentUser } from "@/lib/supabase/server";

export async function AuthStreamShell({ children }: { children: ReactNode }) {
  const [user, role] = await Promise.all([getCurrentUser(), getCurrentRole()]);
  return (
    <Providers isAuthed={Boolean(user)}>
      <SiteShell
        navbar={
          <Navbar
            user={user ? { name: user.user_metadata?.full_name ?? null } : null}
            role={role}
            userId={user?.id ?? null}
          />
        }
        footer={<Footer />}
        role={role}
        user={
          user
            ? {
                name: user.user_metadata?.full_name ?? null,
                email: user.email ?? null,
              }
            : null
        }
        userId={user?.id ?? null}
      >
        {children}
      </SiteShell>
    </Providers>
  );
}

export function AuthStreamShellFallback({ children }: { children: ReactNode }) {
  return (
    <Providers isAuthed={false}>
      <SiteShell
        navbar={<Navbar user={null} role={null} userId={null} />}
        footer={<Footer />}
        role={null}
        user={null}
        userId={null}
      >
        {children}
      </SiteShell>
    </Providers>
  );
}