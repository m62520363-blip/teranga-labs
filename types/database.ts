export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProjectType = "vitrine" | "e-commerce" | "landing page" | "app web" | "refonte";

export type RequestStatus = "ouvert" | "attribué" | "terminé" | "fermé";

export type DeveloperStatus =
  | "pending"
  | "active"
  | "verified"
  | "verification_pending"
  | "changes_requested"
  | "rejected"
  | "suspended";

export type UserRole = "admin" | "developer" | "moderator" | "client";

export type ReportStatus = "open" | "resolved" | "dismissed";

export type TokenOrderStatus = "pending" | "confirmed" | "cancelled";

export type CrmStatus = "a_contacter" | "en_discussion" | "gagne" | "perdu";

export type RefundStatus = "pending" | "approved" | "rejected";

export type PortfolioLink = {
  title: string;
  url: string;
  description?: string | null;
  image_url?: string | null;
};

export type PaymentIntentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "expired";

export type ConversationStatus = "active" | "awarded" | "archived";

export type MissionStatus =
  | "draft"
  | "negotiating"
  | "awaiting_agreement"
  | "awaiting_payment"
  | "payment_confirmed"
  | "in_progress"
  | "delivery_submitted"
  | "awaiting_acceptance"
  | "corrections_requested"
  | "dispute_open"
  | "completed"
  | "cancellation_requested"
  | "cancelled"
  | "refund_in_progress"
  | "refunded"
  | "new"
  | "disputed";

export type MessageType = "text" | "offer" | "system" | "audio";

export type OfferStatus = "pending" | "accepted" | "rejected";

export type ClientProfile = Database["public"]["Tables"]["client_profiles"]["Row"];

export interface Database {
  public: {
    Tables: {
      requests: {
        Row: {
          id: string;
          client_name: string;
          client_whatsapp: string;
          client_city: string;
          project_type: ProjectType;
          budget: number;
          description: string;
          status: RequestStatus;
          hidden: boolean;
          budget_verified: boolean;
          management_key: string;
          client_id: string | null;
          max_unlocks: number;
          current_unlocks_count: number;
          selected_developer_id: string | null;
          features: string[];
          deadline: string | null;
          demo: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_name: string;
          client_whatsapp: string;
          client_city: string;
          project_type: ProjectType;
          budget: number;
          description: string;
          status?: RequestStatus;
          hidden?: boolean;
          budget_verified?: boolean;
          client_id?: string | null;
          max_unlocks?: number;
          current_unlocks_count?: number;
          selected_developer_id?: string | null;
          features?: string[];
          deadline?: string | null;
          demo?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["requests"]["Insert"]>;
        Relationships: [];
      };
      developers: {
        Row: {
          id: string;
          full_name: string | null;
          first_name?: string | null;
          last_name?: string | null;
          whatsapp: string | null;
          phone?: string | null;
          skills: string[] | null;
          languages?: string[] | null;
          city: string | null;
          country?: string | null;
          address?: string | null;
          notifications_enabled: boolean;
          username: string | null;
          bio: string | null;
          avatar_url: string | null;
          portfolio_links: PortfolioLink[];
          is_verified: boolean;
          experience_years: number;
          rating_avg: number;
          completed_projects_count: number;
          reviews_count: number;
          reputation_score: number;
          reputation_level: string;
          penalty: number;
          monthly_goal: number;
          status: DeveloperStatus;
          rejection_reason?: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          whatsapp?: string | null;
          phone?: string | null;
          skills?: string[] | null;
          languages?: string[] | null;
          city?: string | null;
          country?: string | null;
          address?: string | null;
          notifications_enabled?: boolean;
          username?: string | null;
          bio?: string | null;
          avatar_url?: string | null;
          portfolio_links?: PortfolioLink[];
          is_verified?: boolean;
          experience_years?: number;
          rating_avg?: number;
          completed_projects_count?: number;
          reviews_count?: number;
          reputation_score?: number;
          reputation_level?: string;
          penalty?: number;
          monthly_goal?: number;
          status?: DeveloperStatus;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["developers"]["Insert"]>;
        Relationships: [];
      };
      token_packages: {
        Row: {
          id: string;
          name: string;
          tokens: number;
          price_fcfa: number;
          popular: boolean;
        };
        Insert: {
          id: string;
          name: string;
          tokens: number;
          price_fcfa: number;
          popular?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["token_packages"]["Insert"]>;
        Relationships: [];
      };
      token_transactions: {
        Row: {
          id: string;
          developer_id: string;
          amount: number;
          amount_fcfa: number | null;
          type: "purchase" | "unlock" | "bonus" | "publish" | "contact" | "adjust";
          request_id: string | null;
          target_developer_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          amount: number;
          amount_fcfa?: number | null;
          type: "purchase" | "unlock" | "bonus" | "publish" | "contact" | "adjust";
          request_id?: string | null;
          target_developer_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["token_transactions"]["Insert"]>;
        Relationships: [];
      };
      unlocks: {
        Row: {
          id: string;
          developer_id: string;
          request_id: string;
          crm_status: CrmStatus;
          notes: string | null;
          reminder_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          request_id: string;
          crm_status?: CrmStatus;
          notes?: string | null;
          reminder_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["unlocks"]["Insert"]>;
        Relationships: [];
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          request_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["favorites"]["Insert"]>;
        Relationships: [];
      };
      token_refund_requests: {
        Row: {
          id: string;
          unlock_id: string;
          developer_id: string;
          reason: string;
          status: RefundStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          unlock_id: string;
          developer_id: string;
          reason: string;
          status?: RefundStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["token_refund_requests"]["Insert"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          developer_id: string;
          request_id: string;
          client_id: string | null;
          rating: number;
          rating_quality: number | null;
          rating_deadline: number | null;
          rating_communication: number | null;
          comment: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          request_id: string;
          client_id?: string | null;
          rating: number;
          rating_quality?: number | null;
          rating_deadline?: number | null;
          rating_communication?: number | null;
          comment?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
        Relationships: [];
      };
      client_profiles: {
        Row: {
          id: string;
          company_name: string | null;
          contact_name: string | null;
          phone: string | null;
          city: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          company_name?: string | null;
          contact_name?: string | null;
          phone?: string | null;
          city?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_profiles"]["Insert"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          request_id: string | null;
          developer_id: string | null;
          client_id: string | null;
          status: ConversationStatus;
          last_message_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id?: string | null;
          developer_id?: string | null;
          client_id?: string | null;
          status?: ConversationStatus;
          last_message_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
        Relationships: [];
      };
      missions: {
        Row: {
          id: string;
          request_id: string;
          conversation_id: string | null;
          offer_id: string | null;
          developer_id: string;
          client_id: string;
          status: MissionStatus;
          agreed_price_fcfa: number;
          agreed_days: number;
          description: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          conversation_id?: string | null;
          offer_id?: string | null;
          developer_id: string;
          client_id: string;
          status?: MissionStatus;
          agreed_price_fcfa: number;
          agreed_days: number;
          description?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["missions"]["Insert"]>;
        Relationships: [];
      };
      mission_events: {
        Row: {
          id: string;
          mission_id: string;
          actor_id: string;
          status_from: string | null;
          status_to: string;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          actor_id: string;
          status_from?: string | null;
          status_to: string;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mission_events"]["Insert"]>;
        Relationships: [];
      };
      developer_projects: {
        Row: {
          id: string;
          developer_id: string;
          name: string;
          description: string | null;
          project_type: string | null;
          technologies: string[];
          url: string | null;
          screenshots: string[];
          role: string | null;
          key_features: string[];
          client_name: string | null;
          client_authorization: "public" | "confidential" | "clients_only";
          completion_date: string | null;
          duration: string | null;
          demo_url: string | null;
          demo_video_url: string | null;
          status: "pending" | "verified" | "corrections" | "rejected";
          admin_note: string | null;
          is_hidden: boolean;
          via_teranga_labs: boolean;
          mission_ref: string | null;
          conversation_id: string | null;
          details_locked: boolean;
          reviewed_at: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          name: string;
          description?: string | null;
          project_type?: string | null;
          technologies?: string[];
          url?: string | null;
          screenshots?: string[];
          role?: string | null;
          key_features?: string[];
          client_name?: string | null;
          client_authorization?: "public" | "confidential" | "clients_only";
          completion_date?: string | null;
          duration?: string | null;
          demo_url?: string | null;
          demo_video_url?: string | null;
          status?: "pending" | "verified" | "corrections" | "rejected";
          admin_note?: string | null;
          is_hidden?: boolean;
          via_teranga_labs?: boolean;
          mission_ref?: string | null;
          conversation_id?: string | null;
          details_locked?: boolean;
          reviewed_at?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["developer_projects"]["Insert"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          content: string;
          message_type: MessageType;
          metadata: Json | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          content: string;
          message_type?: MessageType;
          metadata?: Json | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      formal_offers: {
        Row: {
          id: string;
          conversation_id: string;
          developer_id: string | null;
          total_price_fcfa: number;
          deposit_fcfa: number | null;
          delivery_days: number;
          description: string | null;
          status: OfferStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          developer_id?: string | null;
          total_price_fcfa: number;
          deposit_fcfa?: number | null;
          delivery_days: number;
          description?: string | null;
          status?: OfferStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["formal_offers"]["Insert"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          target_type: "brief" | "developer";
          target_id: string;
          reporter_id: string | null;
          reason: string;
          description: string | null;
          status: ReportStatus;
          note: string | null;
          penalty: number;
          resolver_id: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          target_type: "brief" | "developer";
          target_id: string;
          reporter_id?: string | null;
          reason: string;
          description?: string | null;
          status?: ReportStatus;
          note?: string | null;
          penalty?: number;
          resolver_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
        Relationships: [];
      };
      token_orders: {
        Row: {
          id: string;
          developer_id: string;
          package_id: string;
          package_name: string;
          tokens: number;
          price_fcfa: number;
          status: TokenOrderStatus;
          notes: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          package_id: string;
          package_name: string;
          tokens: number;
          price_fcfa: number;
          status?: TokenOrderStatus;
          notes?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["token_orders"]["Insert"]>;
        Relationships: [];
      };
      payment_intents: {
        Row: {
          id: string;
          developer_id: string;
          package_id: string;
          package_name: string;
          tokens: number;
          amount_fcfa: number;
          currency: string;
          provider: string;
          provider_session_id: string | null;
          status: PaymentIntentStatus;
          created_at: string;
          credited_at: string | null;
        };
        Insert: {
          id?: string;
          developer_id: string;
          package_id: string;
          package_name: string;
          tokens: number;
          amount_fcfa: number;
          currency?: string;
          provider?: string;
          provider_session_id?: string | null;
          status?: PaymentIntentStatus;
          created_at?: string;
          credited_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payment_intents"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          developer_id: string;
          kind: string;
          method: string;
          amount_fcfa: number;
          currency: string;
          status: string;
          provider: string | null;
          provider_session_id: string | null;
          entity_type: string | null;
          entity_id: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          kind?: string;
          method: string;
          amount_fcfa: number;
          currency?: string;
          status?: string;
          provider?: string | null;
          provider_session_id?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      verification_requests: {
        Row: {
          id: string;
          developer_id: string;
          amount_fcfa: number;
          method: string;
          provider: string | null;
          provider_session_id: string | null;
          payment_status: string;
          verification_status: string;
          paid_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          amount_fcfa: number;
          method: string;
          provider?: string | null;
          provider_session_id?: string | null;
          payment_status?: string;
          verification_status?: string;
          paid_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["verification_requests"]["Insert"]>;
        Relationships: [];
      };
      notification_jobs: {
        Row: {
          id: string;
          type: "client_confirmation" | "developer_matches";
          payload: Json;
          status: "pending" | "sent" | "failed";
          attempts: number;
          last_error: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          type: "client_confirmation" | "developer_matches";
          payload: Json;
          status?: "pending" | "sent" | "failed";
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          processed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["notification_jobs"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          entity_type: string | null;
          entity_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          entity_type?: string | null;
          entity_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
      user_presence: {
        Row: {
          user_id: string;
          last_seen_at: string;
        };
        Insert: {
          user_id: string;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_presence"]["Insert"]>;
        Relationships: [];
      };
      mission_payments: {
        Row: {
          id: string;
          mission_id: string;
          payer_id: string;
          amount_fcfa: number;
          currency: string;
          provider: string;
          provider_sale_id: string | null;
          status: string;
          created_at: string;
          confirmed_at: string | null;
          refunded_at: string | null;
        };
        Insert: {
          id?: string;
          mission_id: string;
          payer_id: string;
          amount_fcfa: number;
          currency?: string;
          provider?: string;
          provider_sale_id?: string | null;
          status?: string;
          created_at?: string;
          confirmed_at?: string | null;
          refunded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mission_payments"]["Insert"]>;
        Relationships: [];
      };
      earnings_ledger: {
        Row: {
          id: string;
          developer_id: string;
          mission_id: string | null;
          withdrawal_id: string | null;
          amount_fcfa: number;
          kind: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          mission_id?: string | null;
          withdrawal_id?: string | null;
          amount_fcfa: number;
          kind: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["earnings_ledger"]["Insert"]>;
        Relationships: [];
      };
      withdrawals: {
        Row: {
          id: string;
          developer_id: string;
          amount_fcfa: number;
          method: string;
          destination: string;
          status: string;
          provider_reference: string | null;
          admin_note: string | null;
          requested_at: string;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          developer_id: string;
          amount_fcfa: number;
          method: string;
          destination: string;
          status?: string;
          provider_reference?: string | null;
          admin_note?: string | null;
          requested_at?: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["withdrawals"]["Insert"]>;
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["app_settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      welcome_offer_status: {
        Row: {
          user_id: string;
          has_published_brief: boolean;
          has_unlocked_contact: boolean;
          gift_consumed: boolean;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: {
        Args: {
          p_roles: string[];
        };
        Returns: boolean;
      };
      request_otp: {
        Args: {
          p_channel: string;
          p_target?: string;
          p_purpose?: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      verify_otp: {
        Args: {
          p_channel: string;
          p_target: string;
          p_code: string;
          p_purpose?: string;
        };
        Returns: Json;
      };
      create_mission_from_offer: {
        Args: {
          p_offer_id: string;
          p_description?: string;
        };
        Returns: Json;
      };
      mission_update_status: {
        Args: {
          p_mission_id: string;
          p_to_status: string;
          p_comment?: string;
        };
        Returns: Json;
      };
      track_event: {
        Args: {
          p_event: string;
          p_actor_id?: string;
          p_request_id?: string;
          p_metadata?: Record<string, unknown>;
        };
        Returns: Json;
      };
      get_leaderboard: {
        Args: {
          p_year?: number;
          p_month?: number;
        };
        Returns: Json;
      };
      settle_leaderboard: {
        Args: {
          p_year: number;
          p_month: number;
        };
        Returns: Json;
      };
      teranga_match: {
        Args: {
          p_project_type?: string;
          p_city?: string;
          p_budget?: number;
          p_services?: string[];
          p_limit?: number;
        };
        Returns: Json;
      };
      get_developer_score: {
        Args: {
          p_identifier: string;
        };
        Returns: Json;
      };
      create_agency: {
        Args: {
          p_name: string;
          p_slug: string;
          p_bio?: string;
          p_logo_url?: string;
          p_city?: string;
          p_country?: string;
          p_website?: string;
        };
        Returns: Json;
      };
      get_agency_by_invite: {
        Args: {
          p_invite_code: string;
        };
        Returns: Json;
      };
      join_agency: {
        Args: {
          p_agency_id: string;
          p_invite_code: string;
        };
        Returns: Json;
      };
      rotate_agency_invite: {
        Args: {
          p_agency_id: string;
        };
        Returns: Json;
      };
      remove_agency_member: {
        Args: {
          p_developer_id: string;
        };
        Returns: Json;
      };
      leave_agency: {
        Args: Record<string, never>;
        Returns: Json;
      };
      set_agency_status: {
        Args: {
          p_agency_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      list_agencies: {
        Args: {
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      get_agency: {
        Args: {
          p_slug: string;
        };
        Returns: Json;
      };
      get_agency_by_developer: {
        Args: {
          p_developer_id: string;
        };
        Returns: Json;
      };
      my_agency: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_sponsoring_prices: {
        Args: Record<string, never>;
        Returns: Json;
      };
      sponsor_dev_profile: {
        Args: {
          p_days?: number;
        };
        Returns: Json;
      };
      sponsor_brief: {
        Args: {
          p_request_id: string;
          p_management_key: string;
          p_days?: number;
        };
        Returns: Json;
      };
      admin_set_sponsoring_prices: {
        Args: {
          p_profile_price_tokens: number;
          p_brief_price_tokens: number;
        };
        Returns: Json;
      };
      get_pro_prices: {
        Args: Record<string, never>;
        Returns: Json;
      };
      subscribe_pro: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_pro_status: {
        Args: {
          p_developer_id?: string;
        };
        Returns: Json;
      };
      admin_set_pro_prices: {
        Args: {
          p_price_tokens: number;
          p_duration_days: number;
        };
        Returns: Json;
      };
      toggle_favorite: {
        Args: {
          p_request_id: string;
        };
        Returns: Json;
      };
      is_favorited: {
        Args: {
          p_request_id: string;
        };
        Returns: boolean;
      };
      get_token_balance: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_my_role: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_contact_cost: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_my_token_history: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      get_peer_display_name: {
        Args: {
          p_user_id: string;
        };
        Returns: Json;
      };
      list_approved_developers: {
        Args: {
          p_query?: string;
          p_specialty?: string;
          p_technologies?: string[];
          p_services?: string[];
          p_city?: string;
          p_min_experience?: number;
          p_availability?: string;
          p_min_rating?: number;
          p_verified_only?: boolean;
          p_project_type?: string;
          p_sort?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Json;
      };
      get_directory_filters: {
        Args: Record<string, never>;
        Returns: Json;
      };
      contact_developer: {
        Args: {
          p_developer_id: string;
          p_initial_message?: string;
        };
        Returns: Json;
      };
      admin_list_packages: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_update_package: {
        Args: {
          p_id: string;
          p_name: string;
          p_tokens: number;
          p_price_fcfa: number;
          p_popular?: boolean;
        };
        Returns: Json;
      };
      admin_list_balances: {
        Args: {
          p_query?: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      admin_adjust_tokens: {
        Args: {
          p_developer: string;
          p_amount: number;
          p_reason?: string;
        };
        Returns: Json;
      };
      admin_set_contact_cost: {
        Args: {
          p_tokens: number;
        };
        Returns: Json;
      };
      admin_list_contacts: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      get_my_unlocks: {
        Args: Record<string, never>;
        Returns: Json;
      };
      update_unlock_crm: {
        Args: {
          p_unlock_id: string;
          p_status: string;
          p_notes?: string | null;
          p_reminder_at?: string | null;
        };
        Returns: Json;
      };
      set_monthly_goal: {
        Args: {
          p_goal: number;
        };
        Returns: Json;
      };
      my_notifications: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      notifications_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_notifications_read: {
        Args: {
          p_ids: unknown;
        };
        Returns: undefined;
      };
      mark_entity_notifications_read: {
        Args: {
          p_entity_type: string;
          p_entity_id: string;
        };
        Returns: undefined;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      delete_account: {
        Args: {
          p_confirm?: string;
        };
        Returns: Json;
      };
      client_archive_conversation: {
        Args: {
          p_conversation_id: string;
        };
        Returns: Json;
      };
      request_token_refund: {
        Args: {
          p_unlock_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      get_public_developer_profile: {
        Args: {
          p_identifier: string;
          p_viewer_role?: string;
        };
        Returns: Json;
      };
      list_my_missions: {
        Args: Record<string, never>;
        Returns: Json;
      };
      set_developer_mission: {
        Args: {
          p_payload: Json;
          p_tl_conversation?: string;
        };
        Returns: Json;
      };
      delete_developer_mission: {
        Args: {
          p_mission: string;
        };
        Returns: Json;
      };
      unlock_request: {
        Args: {
          request_id: string;
        };
        Returns: Json;
      };
      get_admin_stats: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_requests: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_developers: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_transactions: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      credit_tokens: {
        Args: {
          p_developer: string;
          p_amount: number;
          p_amount_fcfa?: number;
        };
        Returns: Json;
      };
      create_brief: {
        Args: {
          p_client_name: string;
          p_client_whatsapp: string;
          p_client_city: string;
          p_project_type: string;
          p_budget: number;
          p_description: string;
        };
        Returns: Json;
      };
      publish_brief: {
        Args: {
          p_client_name: string;
          p_client_whatsapp: string;
          p_client_city: string;
          p_project_type: string;
          p_budget: number;
          p_description: string;
          p_features?: string[];
          p_deadline?: string | null;
        };
        Returns: Json;
      };
      unlock_and_start_chat: {
        Args: {
          p_request_id: string;
          p_initial_message: string;
          p_estimated_price: number;
          p_estimated_days: number;
        };
        Returns: Json;
      };
      accept_formal_offer: {
        Args: {
          p_offer_id: string;
        };
        Returns: Json;
      };
      get_brief_management: {
        Args: {
          p_management_key: string;
        };
        Returns: Json;
      };
      update_brief_status: {
        Args: {
          p_management_key: string;
          p_status: string;
        };
        Returns: Json;
      };
      submit_review: {
        Args: {
          p_request_id: string;
          p_rating: number;
          p_comment?: string | null;
          p_criteria?: Json | null;
          p_questions?: Json | null;
          p_assets?: string[] | null;
        };
        Returns: Json;
      };
      get_review_for_request: {
        Args: {
          p_request_id: string;
        };
        Returns: Json;
      };
      get_my_request_reviews: {
        Args: Record<string, never>;
        Returns: Json;
      };
      list_my_developer_reviews: {
        Args: Record<string, never>;
        Returns: Json;
      };
      respond_to_review: {
        Args: {
          p_review_id: string;
          p_response: string;
        };
        Returns: Json;
      };
      submit_review_report: {
        Args: {
          p_review_id: string;
          p_reason: string;
          p_description?: string | null;
        };
        Returns: Json;
      };
      admin_get_reviews: {
        Args: {
          p_visibility?: string | null;
        };
        Returns: Json;
      };
      admin_set_review_status: {
        Args: {
          p_review_id: string;
          p_hidden: boolean;
          p_note?: string | null;
        };
        Returns: Json;
      };
      admin_list_review_reports: {
        Args: {
          p_status?: string | null;
        };
        Returns: Json;
      };
      get_developer_reviews: {
        Args: {
          p_developer: string;
        };
        Returns: Json;
      };
      submit_report: {
        Args: {
          p_target_type: string;
          p_target_id: string;
          p_reason: string;
          p_description: string;
        };
        Returns: Json;
      };
      set_developer_status: {
        Args: {
          p_developer: string;
          p_status: string;
        };
        Returns: Json;
      };
      create_token_order: {
        Args: {
          p_package_id: string;
        };
        Returns: Json;
      };
      get_my_orders: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_orders: {
        Args: {
          p_status?: string;
        };
        Returns: Json;
      };
      admin_confirm_order: {
        Args: {
          p_order_id: string;
        };
        Returns: Json;
      };
      admin_cancel_order: {
        Args: {
          p_order_id: string;
        };
        Returns: Json;
      };
      admin_list_reports: {
        Args: {
          p_status?: string;
        };
        Returns: Json;
      };
      admin_update_report: {
        Args: {
          p_report_id: string;
          p_status: string;
        };
        Returns: Json;
      };
      admin_resolve_report: {
        Args: {
          p_report_id: string;
          p_status: string;
          p_note?: string | null;
          p_penalty?: number;
          p_notify_target?: boolean;
        };
        Returns: Json;
      };
      credit_from_payment: {
        Args: {
          p_intent_id: string;
        };
        Returns: Json;
      };
      list_developers_for_brief: {
        Args: {
          p_city: string;
          p_keywords: string[];
        };
        Returns: Json;
      };
      admin_set_budget_verified: {
        Args: {
          p_request_id: string;
          p_verified: boolean;
        };
        Returns: Json;
      };
      is_username_taken: {
        Args: {
          p_username: string;
        };
        Returns: boolean;
      };
      get_verification_price: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_my_developer_application: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_my_verification_status: {
        Args: Record<string, never>;
        Returns: Json;
      };
      submit_developer_application: {
        Args: {
          p_payload: unknown;
        };
        Returns: Json;
      };
      submit_verification_request: {
        Args: {
          p_method?: string;
        };
        Returns: Json;
      };
      admin_list_developer_applications: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_get_developer_application: {
        Args: {
          p_developer: string;
        };
        Returns: Json;
      };
      admin_review_developer: {
        Args: {
          p_developer: string;
          p_action: string;
          p_message?: string | null;
        };
        Returns: Json;
      };
      admin_confirm_verification_payment: {
        Args: {
          p_verification: string;
        };
        Returns: Json;
      };
      admin_review_verification: {
        Args: {
          p_verification: string;
          p_approve: boolean;
          p_message?: string | null;
        };
        Returns: Json;
      };
      admin_set_verification_price: {
        Args: {
          p_price_fcfa: number;
        };
        Returns: Json;
      };
      admin_get_mission_payment_config: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_set_mission_payment_config: {
        Args: {
          p_product_id: string;
          p_price_variants: Json;
        };
        Returns: Json;
      };
      admin_list_verifications: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_list_admin_actions: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      admin_alerts: {
        Args: Record<string, never>;
        Returns: Json;
      };
      touch_presence: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_peer_presence: {
        Args: {
          p_conversation_id: string;
        };
        Returns: Json;
      };
      send_message: {
        Args: {
          p_conversation_id: string;
          p_body?: string | null;
          p_message_type?: string;
          p_audio_path?: string | null;
          p_audio_duration_seconds?: number | null;
          p_offer_id?: string | null;
        };
        Returns: Json;
      };
      edit_message: {
        Args: {
          p_message_id: string;
          p_body: string;
        };
        Returns: Json;
      };
      soft_delete_message: {
        Args: {
          p_message_id: string;
        };
        Returns: Json;
      };
      mark_conversation_read: {
        Args: {
          p_conversation_id: string;
        };
        Returns: Json;
      };
      get_message_audio_url: {
        Args: {
          p_message_id: string;
        };
        Returns: Json;
      };
      get_public_profile_completion: {
        Args: Record<string, never>;
        Returns: Json;
      };
      set_public_profile: {
        Args: {
          p_publish: boolean;
        };
        Returns: Json;
      };
      confirm_mission_payment: {
        Args: {
          p_mission_id: string;
          p_provider_sale_id: string;
          p_amount_fcfa: number;
          p_payer_id?: string;
        };
        Returns: Json;
      };
      release_mission_funds: {
        Args: {
          p_mission_id: string;
        };
        Returns: Json;
      };
      get_wallet_summary: {
        Args: Record<string, never>;
        Returns: Json;
      };
      request_withdrawal: {
        Args: {
          p_amount_fcfa: number;
          p_method: string;
          p_destination: string;
        };
        Returns: Json;
      };
      admin_withdrawal_status: {
        Args: {
          p_withdrawal_id: string;
          p_status: string;
          p_provider_reference?: string;
          p_admin_note?: string;
        };
        Returns: Json;
      };
      get_wallet_history: {
        Args: {
          p_limit?: number;
        };
        Returns: Json;
      };
      mission_submit_delivery: {
        Args: {
          p_mission_id: string;
          p_delivery_url?: string;
          p_delivery_notes?: string;
          p_delivery_files?: Json;
        };
        Returns: Json;
      };
      mission_request_cancellation: {
        Args: {
          p_mission_id: string;
          p_reason: string;
        };
        Returns: Json;
      };
      admin_process_mission_refund: {
        Args: {
          p_mission_id: string;
          p_refund_amount_fcfa: number;
          p_note?: string;
        };
        Returns: Json;
      };
      mission_finalize_auto_refund: {
        Args: {
          p_mission_id: string;
          p_actor?: string;
          p_context?: string;
        };
        Returns: Json;
      };
      leaderboard_settle_month: {
        Args: {
          p_year: number;
          p_month: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type PublicRequest = Pick<
  Database["public"]["Tables"]["requests"]["Row"],
  "id" | "client_name" | "client_city" | "project_type" | "budget" | "description" | "status" | "hidden" | "budget_verified" | "demo" | "created_at"
>;

export type PublicRequestWithSponsor = PublicRequest & {
  sponsored_briefs?: { ends_at: string | null }[] | null;
};

export type TokenPackage = Database["public"]["Tables"]["token_packages"]["Row"];

export type DeveloperProfile = Database["public"]["Tables"]["developers"]["Row"];

export type PublicDeveloperProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  whatsapp: string | null;
  phone_masked: string | null;
  email_masked: string | null;
  professional_title: string | null;
  main_specialty: string | null;
  experience_level: string | null;
  availability: string | null;
  rate_min_fcfa: number | null;
  rate_max_fcfa: number | null;
  skills: string[] | null;
  languages?: string[] | null;
  experience_years: number;
  is_verified: boolean;
  created_at: string;
  avg_response_minutes: number | null;
  response_rate: number | null;
  portfolio_links: PortfolioLink[];
  projects_count: number;
  completed_projects_count: number;
  review_count: number;
  review_average: number;
  reputation_score: number;
  reputation_level: string;
  penalty: number;
  projects: DeveloperMission[];
  reviews: PublicReview[];
};

export type ReviewCriteria = {
  qualite?: number;
  delais?: number;
  communication?: number;
  comprehension?: number;
  interface?: number;
  fonctionnalites?: number;
  qualite_prix?: number;
  professionnalisme?: number;
};

export type ReviewAnswer = "oui" | "partiellement" | "non";

export type ReviewQuestions = {
  conforme?: ReviewAnswer;
  reactivite?: ReviewAnswer;
  recommandation?: ReviewAnswer;
  retenir?: ReviewAnswer;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  criteria: ReviewCriteria;
  questions: ReviewQuestions;
  assets: string[];
  response: string | null;
  responded_at: string | null;
  client_name: string | null;
  request_type: string | null;
  request_budget: number | null;
  created_at: string;
};

export type DeveloperReviewStats = {
  total: number;
  average: number;
  satisfaction: number;
  average_criteria: Record<string, number>;
  reviews: PublicReview[];
};

export type DeveloperReviewItem = PublicReview & {
  hidden: boolean;
  admin_note: string | null;
};

export type MyDeveloperReviews = {
  total: number;
  average: number;
  satisfaction: number;
  average_criteria: Record<string, number>;
  reviews: DeveloperReviewItem[];
};

export type ReviewForRequest = {
  request: {
    id: string;
    client_name: string;
    project_type: string;
    budget: number;
    description: string;
    status: string;
    created_at: string;
  };
  developer: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  review: {
    id: string;
    rating: number;
    comment: string | null;
    criteria: ReviewCriteria;
    questions: ReviewQuestions;
    assets: string[];
    created_at: string;
    updated_at: string;
    hidden: boolean;
  } | null;
};

export type ApprovedDeveloper = {
  id: string;
  username: string | null;
  full_name: string | null;
  professional_title: string | null;
  main_specialty: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  skills: string[] | null;
  services: string[] | null;
  experience_years: number | null;
  experience_level: string | null;
  availability: string | null;
  rate_min_fcfa: number | null;
  rate_max_fcfa: number | null;
  rating_avg: number | null;
  review_count: number | null;
  completed_projects_count: number | null;
  projects_count: number | null;
  is_verified: boolean;
  reputation_score: number | null;
  response_rate: number | null;
  satisfaction_pct: number | null;
  phone_masked: string | null;
  email_masked: string | null;
  is_sponsored?: boolean | null;
  featured_until?: string | null;
  is_pro?: boolean | null;
  pro_until?: string | null;
};

export type DeveloperMission = {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  technologies: string[];
  url: string | null;
  screenshots: string[];
  role: string | null;
  key_features: string[];
  client_name: string | null;
  client_authorization: "public" | "confidential" | "clients_only";
  completion_date: string | null;
  duration: string | null;
  demo_url: string | null;
  demo_video_url: string | null;
  via_teranga_labs: boolean;
  mission_ref: string | null;
  is_verified: boolean;
};

export type MyDeveloperMission = Omit<DeveloperMission, "is_verified"> & {
  status: "pending" | "verified" | "corrections" | "rejected";
  admin_note: string | null;
  is_hidden: boolean;
  conversation_id: string | null;
  details_locked: boolean;
  created_at: string;
  updated_at: string;
};

export type TokenHistoryItem = {
  id: string;
  amount: number;
  amount_fcfa: number | null;
  type: string;
  label: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
};

export type DirectoryFilters = {
  specialties: string[];
  cities: string[];
  services: string[];
  project_types: string[];
};

export type MailContactResult = {
  conversation_id: string;
  first_contact: boolean;
  cost: number;
  balance: number;
};

export type TransactionRow = Database["public"]["Tables"]["token_transactions"]["Row"];

export type UnlockRow = Database["public"]["Tables"]["unlocks"]["Row"];