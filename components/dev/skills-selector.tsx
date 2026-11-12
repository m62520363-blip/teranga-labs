"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "cn";
import { SKILL_CATEGORIES, SPECIALTIES } from "@/lib/skills-catalog";

type SkillsSelectorProps = {
  selectedSkills: string[];
  selectedSpecialties: string[];
  onSkillsChange: (skills: string[]) => void;
  onSpecialtiesChange: (specialties: string[]) => void;
  /** Masque le bloc spécialités (ex. : inscription, où seules les compétences sont demandées). */
  showSpecialties?: boolean;
};

export function SkillsSelector({
  selectedSkills,
  selectedSpecialties,
  onSkillsChange,
  onSpecialtiesChange,
  showSpecialties = true,
}: SkillsSelectorProps) {
  const [skillSearch, setSkillSearch] = React.useState("");
  const [openSkills, setOpenSkills] = React.useState(false);
  const [openSpecialties, setOpenSpecialties] = React.useState(false);

  const filteredCategories = SKILL_CATEGORIES.map((cat) => ({
    ...cat,
    skills: cat.skills.filter((s) =>
      s.toLowerCase().includes(skillSearch.toLowerCase())
    ),
  })).filter((cat) => cat.skills.length > 0);

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      onSkillsChange(selectedSkills.filter((s) => s !== skill));
    } else {
      onSkillsChange([...selectedSkills, skill]);
    }
  };

  const toggleSpecialty = (value: string) => {
    if (selectedSpecialties.includes(value)) {
      onSpecialtiesChange(selectedSpecialties.filter((s) => s !== value));
    } else {
      onSpecialtiesChange([...selectedSpecialties, value]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compétences */}
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Compétences ({selectedSkills.length})
          </label>
          <button
            type="button"
            onClick={() => setOpenSkills(!openSkills)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {openSkills ? "Masquer" : "Afficher"}
            <ChevronDown className={cn("size-3.5 transition-transform", openSkills && "rotate-180")} />
          </button>
        </div>

        {/* Selected skills chips */}
        {selectedSkills.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className="hover:text-primary-hover"
                  aria-label={`Retirer ${skill}`}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {openSkills ? (
          <div className="mt-3 space-y-4 rounded-xl border border-hairline bg-muted/40 p-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                placeholder="Rechercher une compétence..."
                className="h-9 w-full rounded-lg border border-hairline bg-surface pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Categories */}
            <div className="max-h-64 space-y-4 overflow-y-auto">
              {filteredCategories.map((cat) => (
                <div key={cat.name}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {cat.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.skills.map((skill) => {
                      const selected = selectedSkills.includes(skill);
                      return (
                        <button
                          key={skill}
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                            selected
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-hairline bg-surface text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {selected ? <Check className="size-3" aria-hidden="true" /> : null}
                          {skill}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Spécialités */}
      {showSpecialties ? (
      <div>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            Spécialités ({selectedSpecialties.length})
          </label>
          <button
            type="button"
            onClick={() => setOpenSpecialties(!openSpecialties)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {openSpecialties ? "Masquer" : "Afficher"}
            <ChevronDown className={cn("size-3.5 transition-transform", openSpecialties && "rotate-180")} />
          </button>
        </div>

        {/* Selected specialties */}
        {selectedSpecialties.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedSpecialties.map((val) => {
              const spec = SPECIALTIES.find((s) => s.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {spec?.label ?? val}
                  <button
                    type="button"
                    onClick={() => toggleSpecialty(val)}
                    className="hover:text-primary-hover"
                    aria-label={`Retirer ${spec?.label ?? val}`}
                  >
                    <X className="size-3" aria-hidden="true" />
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}

        {openSpecialties ? (
          <div className="mt-3 space-y-1 rounded-xl border border-hairline bg-muted/40 p-4">
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {SPECIALTIES.map((spec) => {
                const selected = selectedSpecialties.includes(spec.value);
                return (
                  <button
                    key={spec.value}
                    type="button"
                    onClick={() => toggleSpecialty(spec.value)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      selected
                        ? "bg-primary-soft text-primary"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        selected
                          ? "border-primary bg-primary text-ink"
                          : "border-hairline"
                      )}
                    >
                      {selected ? <Check className="size-3" aria-hidden="true" /> : null}
                    </span>
                    {spec.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}
