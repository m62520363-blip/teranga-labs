// Types interprétés des réponses jsonb des RPC "agences" (0044_agencies.sql).

export interface AgencyListItem {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  verified: boolean;
  members_count: number;
}

export interface AgencyMemberPublic {
  developer_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  main_specialty: string | null;
  is_verified: boolean | null;
  reputation_score: number | null;
}

export interface AgencyDetail extends AgencyListItem {
  owner_id: string;
  created_at: string;
  members: AgencyMemberPublic[];
}

export interface MyAgencyMember extends AgencyMemberPublic {
  role_in_agency: "admin" | "member";
}

export interface MyAgency {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  logo_url: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  verified: boolean;
  status: "pending" | "active" | "suspended";
  my_role: "owner" | "admin" | "member";
  invite_code: string | null;
  members: MyAgencyMember[];
}

export interface AgencyBadge {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

export function asAgencyList(data: unknown): AgencyListItem[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (a): a is AgencyListItem =>
      Boolean(a && typeof a === "object" && typeof (a as AgencyListItem).id === "string")
  );
}

export function asAgencyDetail(data: unknown): AgencyDetail | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<AgencyDetail>;
  if (typeof d.id !== "string" || typeof d.slug !== "string") return null;
  return {
    id: d.id,
    slug: d.slug,
    name: typeof d.name === "string" ? d.name : "",
    bio: typeof d.bio === "string" ? d.bio : null,
    logo_url: typeof d.logo_url === "string" ? d.logo_url : null,
    city: typeof d.city === "string" ? d.city : null,
    country: typeof d.country === "string" ? d.country : null,
    website: typeof d.website === "string" ? d.website : null,
    verified: Boolean(d.verified),
    members_count:
      typeof d.members_count === "number" ? d.members_count : 0,
    owner_id: typeof d.owner_id === "string" ? d.owner_id : "",
    created_at: typeof d.created_at === "string" ? d.created_at : "",
    members: Array.isArray(d.members) ? (d.members as AgencyMemberPublic[]) : [],
  };
}

export function asMyAgency(data: unknown): MyAgency | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<MyAgency>;
  if (typeof d.id !== "string" || typeof d.slug !== "string") return null;
  return {
    id: d.id,
    slug: d.slug,
    name: typeof d.name === "string" ? d.name : "",
    bio: typeof d.bio === "string" ? d.bio : null,
    logo_url: typeof d.logo_url === "string" ? d.logo_url : null,
    city: typeof d.city === "string" ? d.city : null,
    country: typeof d.country === "string" ? d.country : null,
    website: typeof d.website === "string" ? d.website : null,
    verified: Boolean(d.verified),
    status: d.status === "active" || d.status === "suspended" ? d.status : "pending",
    my_role:
      d.my_role === "owner" || d.my_role === "member"
        ? d.my_role
        : d.my_role === "admin"
          ? "admin"
          : "member",
    invite_code:
      typeof d.invite_code === "string" && d.invite_code
        ? d.invite_code
        : null,
    members: Array.isArray(d.members) ? (d.members as MyAgencyMember[]) : [],
  };
}

export function asAgencyBadge(data: unknown): AgencyBadge | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Partial<AgencyBadge>;
  if (typeof d.slug !== "string" || typeof d.name !== "string") return null;
  return {
    id: typeof d.id === "string" ? d.id : "",
    slug: d.slug,
    name: d.name,
    logo_url: typeof d.logo_url === "string" ? d.logo_url : null,
  };
}