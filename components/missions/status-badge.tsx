import { MISSION_STATUS_LABELS } from "@/lib/mission-labels";
import type { MissionStatus } from "@/types/database";

export function StatusBadge({ status }: { status: MissionStatus }) {
  const meta = MISSION_STATUS_LABELS[status];
  return <span className={meta.badge}>{meta.short}</span>;
}
