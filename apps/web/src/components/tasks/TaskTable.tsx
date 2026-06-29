import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskDto } from "@/api/types";
import { api } from "@/api/client";
import { PriorityBadge } from "@/components/tasks/PriorityBadge";
import { StatusSelect } from "@/components/tasks/StatusSelect";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PRIORITY_OPTIONS } from "@/lib/priority";

function ReminderPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reminders", taskId],
    queryFn: () => api.listReminders(taskId),
  });

  if (isLoading) return <p className="text-xs text-slate-500">불러오는 중…</p>;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">예약된 알림이 없습니다.</p>;
  }

  return (
    <ul className="max-h-40 space-y-1 overflow-auto text-xs">
      {items.map((r) => (
        <li key={r.id} className="flex justify-between gap-2 rounded bg-slate-50 px-2 py-1">
          <span>{formatDateTime(r.fireAt)}</span>
          <span
            className={
              r.status === "pending"
                ? "text-amber-600"
                : r.status === "sent"
                  ? "text-emerald-600"
                  : "text-slate-400"
            }
          >
            {r.status === "pending" ? "예약" : r.status === "sent" ? "발송" : "취소"}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface TaskTableProps {
  tasks: TaskDto[];
  sort: string;
  onSortChange: (sort: string) => void;
}

export function TaskTable({ tasks, sort, onSortChange }: TaskTableProps) {
  const queryClient = useQueryClient();
  const [openReminder, setOpenReminder] = useState<string | null>(null);

  const priorityMutation = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: TaskDto["priority"] }) =>
      api.updateTask(id, { priority }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

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
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">우선순위</th>
              <th className="px-4 py-3 text-center">알림</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  등록된 업무가 없습니다. 텔레그램에서 추가하거나 새 업무를 등록하세요.
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
                  <td className="px-4 py-3">
                    <StatusSelect task={task} />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="rounded-md border border-surface-border bg-white px-2 py-1 text-xs"
                      value={task.priority}
                      disabled={priorityMutation.isPending}
                      onChange={(e) =>
                        priorityMutation.mutate({
                          id: task.id,
                          priority: e.target.value as TaskDto["priority"],
                        })
                      }
                    >
                      {PRIORITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1">
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </td>
                  <td className="relative px-4 py-3 text-center">
                    <button
                      type="button"
                      className="rounded-full p-1.5 hover:bg-slate-100"
                      title="알림 로그"
                      onClick={() =>
                        setOpenReminder((cur) => (cur === task.id ? null : task.id))
                      }
                    >
                      🔔
                      {task.reminderSummary.pending > 0 && (
                        <span className="ml-0.5 text-xs text-amber-600">
                          {task.reminderSummary.pending}
                        </span>
                      )}
                    </button>
                    {openReminder === task.id && (
                      <div className="absolute right-4 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg">
                        <p className="mb-2 text-xs font-semibold text-slate-700">알림 예약/발송</p>
                        <ReminderPanel taskId={task.id} />
                      </div>
                    )}
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
