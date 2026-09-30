import { CATEGORIES } from "@/components/landing/content";
import { Reveal } from "@/components/reveal";
import { Section, SectionHeader } from "@/components/landing/section";

export function CategoriesSection() {
  return (
    <Section className="border-y border-hairline bg-surface" ariaLabel="Catégories">
      <SectionHeader
        eyebrow="Catégories"
        title="Ce que vous pouvez chercher"
        lead="Du MacBook à la location d’appartement : quel que soit votre besoin, tout commence par une demande."
      />

      <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((category, index) => (
          <Reveal key={category.title} delay={(index % 3) as 0 | 1 | 2}>
            <div className="card card-interactive h-full p-5">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-soft">
                <category.icon className="size-5 text-primary" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                {category.title}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {category.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}