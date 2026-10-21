import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CheckCheck,
  MessageCircle,
  Sparkles,
  Star,
  Truck,
  UserPlus,
  Wallet,
  XCircle,
} from "lucide-react";

/**
 * Icône d'une notification, par type. Tous les types émis par les migrations
 * (notify_user) ont un rendu dédié ; tout type inconnu tombe sur la cloche.
 */
export function notificationIcon(type: string) {
  switch (type) {
    case "new_message":
    case "contact_message":
    case "review_responded":
      return MessageCircle;
    case "new_contact":
      return UserPlus;
    case "unlock_received":
    case "mission_created":
    case "mission_status":
    case "mission_status_change":
    case "mission_changes":
    case "mission_verified":
    case "mission_completed":
    case "mission_cancelled":
    case "mission_rejected":
    case "mission_hidden":
      return Briefcase;
    case "delivery_submitted":
      return Truck;
    case "offer_accepted":
      return CheckCheck;
    case "review_received":
    case "review_requested":
      return Star;
    case "account_certified":
    case "account_approved":
    case "profile_verified":
      return BadgeCheck;
    case "payment_completed":
    case "payment_confirmed":
    case "refund_completed":
    case "earnings_available":
    case "withdrawal_requested":
    case "withdrawal_paid":
    case "withdrawal_rejected":
      return Wallet;
    case "subscription_created":
    case "subscription_updated":
    case "agency_created":
      return type === "agency_created" ? Building2 : Sparkles;
    case "application_rejected":
    case "verification_rejected":
    case "changes_requested":
    case "moderation":
      return XCircle;
    default:
      if (type.startsWith("withdrawal_")) return Wallet;
      if (type.startsWith("token_")) return Sparkles;
      if (type.startsWith("mission_")) return Briefcase;
      if (type.startsWith("payment_")) return Wallet;
      return Bell;
  }
}
