import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { formatDday, formatDateTime } from "@/lib/dates";

function TaskRow({ task }: { task: TaskDto }) {
  return (
    <li className="flex items-start justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-800">
          {task.listIndex}. {task.title}
        </p>
        {task.dueAt && (
          <p className="text-xs text-slate-500">{formatDateTime(task.dueAt)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <PriorityBadge priority={task.priority} />
        {task.dday !== null && (
          <span className="text-xs font-semibold text-brand">{formatDday(task.dday)}</span>
        )}
      </div>
    </li>
  );
}

export function DueTodayCard({ tasks }: { tasks: TaskDto[] }) {
  return (
    <Card title="금일 마감">
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">오늘 마감 업무가 없습니다.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function InProgressCard({ tasks }: { tasks: TaskDto[] }) {
  const items = tasks.filter(
    (t) => t.status === "active" && t.workflowStatus === "in_progress",
  );

  return (
    <Card title="진행 중">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">진행 중인 업무가 없습니다.</p>
      ) : (
        <ul>
          {items.slice(0, 8).map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      )}
    </Card>
  );
}
