import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { CardTitle } from "@/components/ui/CardTitle";
import { ScrollFadeArea } from "@/components/ui/ScrollFadeArea";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { formatDday, formatDateTime } from "@/lib/dates";

/** Roughly eight task rows visible before the list scrolls. */
const SUMMARY_LIST_MAX_HEIGHT = "max-h-[28rem]";

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

function SummaryTaskList({
  tasks,
  emptyMessage,
  onTaskClick,
}: {
  tasks: TaskDto[];
  emptyMessage: string;
  onTaskClick?: (task: TaskDto) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>;
  }

  return (
    <ScrollFadeArea className={SUMMARY_LIST_MAX_HEIGHT}>
      <ul>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onClick={onTaskClick} />
        ))}
      </ul>
    </ScrollFadeArea>
  );
}

function SummaryCardTitle({
  icon,
  iconClassName,
  label,
  count,
}: {
  icon: string;
  iconClassName: string;
  label: string;
  count: number;
}) {
  return (
    <CardTitle icon={icon} iconClassName={iconClassName}>
      {label}
      {count > 0 && (
        <span className="font-normal text-slate-500 dark:text-slate-400"> {count}건</span>
      )}
    </CardTitle>
  );
}

function SummaryCard({
  icon,
  iconClassName,
  label,
  tasks,
  emptyMessage,
  onTaskClick,
}: {
  icon: string;
  iconClassName: string;
  label: string;
  tasks: TaskDto[];
  emptyMessage: string;
  onTaskClick?: (task: TaskDto) => void;
}) {
  return (
    <Card
      className="transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20"
      title={
        <SummaryCardTitle
          icon={icon}
          iconClassName={iconClassName}
          label={label}
          count={tasks.length}
        />
      }
    >
      <SummaryTaskList tasks={tasks} emptyMessage={emptyMessage} onTaskClick={onTaskClick} />
    </Card>
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
    <SummaryCard
      icon="alarm"
      iconClassName="text-amber-600 dark:text-amber-400"
      label="금일 종료"
      tasks={tasks}
      emptyMessage="오늘 마감 업무가 없어요."
      onTaskClick={onTaskClick}
    />
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
    <SummaryCard
      icon="play_circle"
      iconClassName="text-brand dark:text-blue-400"
      label="진행 중"
      tasks={items}
      emptyMessage="진행 중인 업무가 없어요."
      onTaskClick={onTaskClick}
    />
  );
}

export function PlannedCard({
  tasks,
  onTaskClick,
}: {
  tasks: TaskDto[];
  onTaskClick?: (task: TaskDto) => void;
}) {
  const items = tasks.filter(
    (t) => t.status === "active" && t.workflowStatus === "planned",
  );

  return (
    <SummaryCard
      icon="event_note"
      iconClassName="text-slate-500 dark:text-slate-400"
      label="계획"
      tasks={items}
      emptyMessage="계획 중인 업무가 없어요."
      onTaskClick={onTaskClick}
    />
  );
}
