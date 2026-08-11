import { useState, type ReactNode } from "react";
import type { TaskDto } from "@/api/types";
import { Card } from "@/components/ui/Card";
import { CardTitle } from "@/components/ui/CardTitle";
import { DayTimeline } from "@/components/dashboard/DayTimeline";
import { ScrollFadeArea } from "@/components/ui/ScrollFadeArea";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { formatDateTime, formatDday, dueDateToneClass, formatLocalDateKey } from "@/lib/dates";

/** Roughly eight task rows visible before the list scrolls. */
const SUMMARY_LIST_MAX_HEIGHT = "max-h-[28rem]";

function TaskRow({ task, onClick }: { task: TaskDto; onClick?: (task: TaskDto) => void }) {
  return (
    <li>
      <button
        type="button"
        className={`flex w-full items-start justify-between gap-2 rounded-2xl border border-white/55 bg-white/50 px-3 py-2.5 text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow,transform] dark:border-white/[0.06] dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07)] ${
          onClick
            ? "cursor-pointer hover:bg-white/75 hover:shadow-[0_2px_6px_rgba(15,23,42,0.08)] active:scale-[0.99] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.055] dark:hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
            : ""
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(task);
        }}
        disabled={!onClick}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{task.title}</p>
          {task.dueAt && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateTime(task.dueAt)}
              {task.dday !== null && (
                <>
                  <span className="text-slate-400 dark:text-slate-500"> · </span>
                  <span className={dueDateToneClass(task.dday)}>
                    {formatDday(task.dday)}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 self-start">
          <PriorityBadge priority={task.priority} />
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
    <ScrollFadeArea className={SUMMARY_LIST_MAX_HEIGHT} hideScrollbar>
      <ul className="space-y-2">
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
    <CardTitle icon={icon} iconClassName={`${iconClassName} shrink-0`}>
      <span className="min-w-0 truncate">
        {label}
        {count > 0 && (
          <span className="font-normal text-slate-500 dark:text-slate-400"> {count}건</span>
        )}
      </span>
    </CardTitle>
  );
}

function scrollCardIntoView(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function SummaryCard({
  id,
  icon,
  iconClassName,
  label,
  tasks,
  emptyMessage,
  onTaskClick,
  action,
  children,
}: {
  id: string;
  icon: string;
  iconClassName: string;
  label: string;
  tasks: TaskDto[];
  emptyMessage: string;
  onTaskClick?: (task: TaskDto) => void;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Card
      id={id}
      variant="glass"
      onClick={() => scrollCardIntoView(id)}
      className="h-full min-w-0 scroll-mt-6"
      title={
        <SummaryCardTitle
          icon={icon}
          iconClassName={iconClassName}
          label={label}
          count={tasks.length}
        />
      }
      action={action}
    >
      {children ?? (
        <SummaryTaskList tasks={tasks} emptyMessage={emptyMessage} onTaskClick={onTaskClick} />
      )}
    </Card>
  );
}

export function DueTodayCard({
  tasks,
  onTaskClick,
  onSlotClick,
}: {
  tasks: TaskDto[];
  onTaskClick?: (task: TaskDto) => void;
  onSlotClick?: (dateKey: string, dueTime: string) => void;
}) {
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <SummaryCard
      id="summary-due-today"
      icon="emergency"
      iconClassName="text-amber-600 dark:text-amber-400"
      label="금일 종료"
      tasks={tasks}
      emptyMessage="오늘 마감 업무가 없어요."
      onTaskClick={onTaskClick}
      action={
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          aria-pressed={showTimeline}
          aria-label={showTimeline ? "목록으로 보기" : "타임라인으로 보기"}
          title={showTimeline ? "목록으로 보기" : "타임라인으로 보기"}
          onClick={(event) => {
            event.stopPropagation();
            setShowTimeline((value) => !value);
          }}
        >
          <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden>
            {showTimeline ? "visibility_off" : "visibility"}
          </span>
        </button>
      }
    >
      {showTimeline ? (
        <div className="relative min-h-[28rem] flex-1">
          <div className="absolute inset-0">
            <DayTimeline
              hideHeader
              dayKey={formatLocalDateKey(new Date())}
              tasks={tasks}
              onTaskClick={onTaskClick}
              onSlotClick={onSlotClick}
            />
          </div>
        </div>
      ) : (
        <SummaryTaskList
          tasks={tasks}
          emptyMessage="오늘 마감 업무가 없어요."
          onTaskClick={onTaskClick}
        />
      )}
    </SummaryCard>
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
      id="summary-in-progress"
      icon="code"
      iconClassName="text-emerald-600 dark:text-emerald-400"
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
      id="summary-planned"
      icon="timeline"
      iconClassName="text-slate-500 dark:text-slate-400"
      label="계획"
      tasks={items}
      emptyMessage="계획 중인 업무가 없어요."
      onTaskClick={onTaskClick}
    />
  );
}
