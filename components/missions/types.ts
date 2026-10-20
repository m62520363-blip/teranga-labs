import type { MissionStatus } from "@/types/database";

export type MissionEventPayload = {
  id: string;
  actor_id: string;
  status_from: string | null;
  status_to: string;
  comment: string | null;
  created_at: string;
};

export type MissionPayload = {
  id: string;
  request_id: string;
  conversation_id: string | null;
  offer_id: string | null;
  status: MissionStatus;
  agreed_price_fcfa: number;
  agreed_days: number;
  description: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  opponent: {
    related_as: "developer" | "client";
    full_name?: string | null;
    username?: string | null;
    city?: string | null;
    avatar_url?: string | null;
    company_name?: string | null;
    contact_name?: string | null;
  } | null;
  request: {
    project_type: string | null;
    budget: number | null;
    client_city: string | null;
  } | null;
  events: MissionEventPayload[];
};
