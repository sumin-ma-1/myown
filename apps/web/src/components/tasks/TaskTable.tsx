import type { TaskDto } from "@/api/types";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import { AttachmentDownload } from "@/components/tasks/AttachmentDownload";
import { ReminderBell } from "@/components/tasks/ReminderBell";
import { StatusSelect } from "@/components/tasks/StatusSelect";
import { CardTitle } from "@/components/ui/CardTitle";
import { formatDateTime } from "@/lib/dates";

interface TaskTableProps {
  tasks: TaskDto[];
  sort: string;
  onSortChange: (sort: string) => void;
  /** 완료·전체 탭에서 완료일 열 표시 */
  showCompletedAt?: boolean;
  onTaskClick?: (task: TaskDto) => void;
}

export function TaskTable({ tasks, sort, onSortChange, showCompletedAt = false, onTaskClick }: TaskTableProps) {
  const colCount = showCompletedAt ? 8 : 7;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3 dark:border-slate-700">
        <h2 className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
          <CardTitle icon="sort" iconClassName="text-brand dark:text-blue-400">
            등록 업무 목록
          </CardTitle>
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          정렬
          <select
            className="rounded-md border border-surface-border bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="listIndex">등록 순</option>
            <option value="priority">우선순위 순</option>
            <option value="dueAt">마감일 순</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">업무</th>
              <th className="px-4 py-3">첨부 파일</th>
              <th className="px-4 py-3">등록일</th>
              <th className="px-4 py-3">마감일</th>
              {showCompletedAt && <th className="px-4 py-3">완료일</th>}
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">우선순위</th>
              <th className="px-4 py-3 text-center">알림</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                  등록된 업무가 없습니다. 여기서 새 업무를 등록하거나 연동된 APP에서 업무를 추가하세요.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr
                  key={task.id}
                  className={`border-t border-slate-100 hover:bg-slate-50/80 dark:border-slate-700 dark:hover:bg-slate-700/40 ${
                    onTaskClick ? "cursor-pointer" : ""
                  }`}
                  onClick={() => onTaskClick?.(task)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{task.title}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300" onClick={(e) => e.stopPropagation()}>
                    {task.attachments.length === 0 ? (
                      "-"
                    ) : (
                      <div className="space-y-1">
                        {task.attachments.slice(0, 2).map((attachment) => (
                          <div key={attachment.id}>
                            <AttachmentDownload
                              attachmentId={attachment.id}
                              fileName={attachment.fileName}
                              status={attachment.status}
                              className="text-left text-brand hover:underline"
                            />
                          </div>
                        ))}
                        {task.attachments.length > 2 && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            외 {task.attachments.length - 2}건
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTime(task.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {task.dueAt ? formatDateTime(task.dueAt) : "-"}
                  </td>
                  {showCompletedAt && (
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {task.status === "completed" && task.completedAt
                        ? formatDateTime(task.completedAt)
                        : "-"}
                    </td>
                  )}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect task={task} />
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <PrioritySelect task={task} />
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <ReminderBell
                      taskId={task.id}
                      pendingCount={task.reminderSummary.pending}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
