import {
  Circle,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CirclePlay,
} from "lucide-react";
import { statusLabels, type Task } from "@wuff/contracts";
const statuses = {
  todo: [Circle, "neutral"],
  in_progress: [CirclePlay, "active"],
  in_review: [CircleDashed, "review"],
  blocked: [CirclePause, "danger"],
  done: [CircleCheck, "success"],
} as const;
export function StatusTag({ status }: { status: Task["status"] }) {
  const [Icon, tone] = statuses[status];
  return (
    <span className="status-tag" data-tone={tone}>
      <Icon aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}
