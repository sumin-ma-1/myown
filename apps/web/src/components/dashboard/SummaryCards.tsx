import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { formatDday, formatDateTime } from "@/lib/dates";

function TaskRow({ task, onClick }: { task: TaskDto; onClick?: (task: TaskDto) => void }) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-start justify-between gap-2 border-b border-slate-100 py-2 text-left last:border-0 dark:border-slate-700 ${
          onClick ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-700/50" : ""
        }`}
        onClick={() => onClick?.(task)}
        disabled={!onClick}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
          {task.dueAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(task.dueAt)}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <PriorityBadge priority={task.priority} />
          {task.dday !== null && (
            <span className="text-xs font-semibold text-brand">{formatDday(task.dday)}</span>
          )}
        </div>
      </button>
    </li>
  );
}

export function DueTodayCard({
  tasks,
  onTaskClick,
}: {
  tasks: TaskDto[];
  onTaskClick?: (task: TaskDto) => void;
}) {
  return (
    <Card title="금일 마감">
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">오늘 마감 업무가 없습니다.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function InProgressCard({
  tasks,
  onTaskClick,
}: {
  tasks: TaskDto[];
  onTaskClick?: (task: TaskDto) => void;
}) {
  const items = tasks.filter(
    (t) => t.status === "active" && t.workflowStatus === "in_progress",
  );

  return (
    <Card title="진행 중">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">진행 중인 업무가 없습니다.</p>
      ) : (
        <ul>
          {items.slice(0, 8).map((task) => (
            <TaskRow key={task.id} task={task} onClick={onTaskClick} />
          ))}
        </ul>
      )}
    </Card>
  );
}
