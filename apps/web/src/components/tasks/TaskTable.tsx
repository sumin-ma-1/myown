import type { TaskDto } from "@/api/types";
import { PrioritySelect } from "@/components/tasks/PrioritySelect";
import { ReminderBell } from "@/components/tasks/ReminderBell";
import { StatusSelect } from "@/components/tasks/StatusSelect";
import { formatDate, formatDateTime } from "@/lib/dates";

interface TaskTableProps {
  tasks: TaskDto[];
  sort: string;
  onSortChange: (sort: string) => void;
  /** 완료·전체 탭에서 완료일 열 표시 */
  showCompletedAt?: boolean;
}

export function TaskTable({ tasks, sort, onSortChange, showCompletedAt = false }: TaskTableProps) {
  const colCount = showCompletedAt ? 8 : 7;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <h2 className="font-semibold text-slate-800">등록 업무 목록</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          정렬
          <select
            className="rounded-md border border-surface-border px-2 py-1 text-sm"
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
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
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
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-500">
                  등록된 업무가 없습니다. 여기서 새 업무를 등록하거나 연동된 APP에서 업무를 추가하세요.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{task.title}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {task.attachment?.fileName ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(task.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {task.dueAt ? formatDateTime(task.dueAt) : "-"}
                  </td>
                  {showCompletedAt && (
                    <td className="px-4 py-3 text-slate-600">
                      {task.status === "completed" && task.completedAt
                        ? formatDateTime(task.completedAt)
                        : "-"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <StatusSelect task={task} />
                  </td>
                  <td className="px-4 py-3">
                    <PrioritySelect task={task} />
                  </td>
                  <td className="px-4 py-3 text-center">
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
