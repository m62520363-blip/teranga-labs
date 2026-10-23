import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const LINK_CLS = "font-medium text-primary underline underline-offset-2";

/**
 * Rendu des corps de sections légales depuis messages (ICU rich text).
 *
 * Le helper est autonome (il charge le namespace lui-même) pour que les
 * pages légales récupèrent `t` et `rich` avec la même instance typée.
 * Tags ICU utilisés dans messages : p, strong, it, ul, li, mail,
 * privacy, cookies, vercel.
 */
export async function getLegal(namespace: string) {
  const t = await getTranslations(namespace);
  const rich = (key: string): ReactNode =>
    t.rich(key, {
      p: (chunks) => <p>{chunks}</p>,
      strong: (chunks) => <strong>{chunks}</strong>,
      it: (chunks) => <span className="italic text-muted-foreground">{chunks}</span>,
      ul: (chunks) => <ul className="list-disc space-y-1 pl-5">{chunks}</ul>,
      li: (chunks) => <li>{chunks}</li>,
      mail: (chunks) => (
        <a href="mailto:contact@devmarket.com" className={LINK_CLS}>
          {chunks}
        </a>
      ),
      privacy: (chunks) => (
        <Link href="/politique-de-confidentialite" className={LINK_CLS}>
          {chunks}
        </Link>
      ),
      cookies: (chunks) => (
        <Link href="/cookies" className={LINK_CLS}>
          {chunks}
        </Link>
      ),
      vercel: (chunks) => (
        <a href="https://vercel.com" className={LINK_CLS}>
          {chunks}
        </a>
      ),
    });
  return { t, rich };
}
