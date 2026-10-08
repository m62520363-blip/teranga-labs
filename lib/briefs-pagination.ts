export const BRIEFS_PAGE_SIZE = 50;

export const BRIEFS_COLUMNS =
  "id, client_name, client_city, project_type, budget, description, status, hidden, budget_verified, demo, created_at, sponsored_briefs(ends_at)";

export function isBriefSponsored(
  brief: { sponsored_briefs?: { ends_at?: string | null }[] | null } | null | undefined
): boolean {
  return Boolean(
    brief?.sponsored_briefs?.some(
      (e) => Boolean(e.ends_at) && new Date(e.ends_at as string).getTime() > Date.now()
    )
  );
}
