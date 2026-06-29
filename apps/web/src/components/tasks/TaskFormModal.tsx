import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ExtraReminderRule, TaskDto } from "@/api/types";
import { Modal } from "@/components/ui/Modal";
import { AttachmentDownload } from "@/components/tasks/AttachmentDownload";
import { formatDateTime } from "@/lib/dates";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitDueAt(iso: string | null) {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function toDueAtIso(date: string, time: string): string | undefined {
  if (!date.trim()) return undefined;
  const t = time.trim() || "09:00";
  const parsed = new Date(`${date}T${t}:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

interface ExtraRuleRow {
  key: string;
  daysBefore: string;
  hoursBefore: string;
}

function emptyRule(): ExtraRuleRow {
  return { key: crypto.randomUUID(), daysBefore: "", hoursBefore: "" };
}

function rulesToRows(rules: ExtraReminderRule[]): ExtraRuleRow[] {
  if (rules.length === 0) return [emptyRule()];
  return rules.map((r) => ({
    key: crypto.randomUUID(),
    daysBefore: r.daysBefore !== undefined ? String(r.daysBefore) : "",
    hoursBefore: r.hoursBefore !== undefined ? String(r.hoursBefore) : "",
  }));
}

function rowsToRules(rows: ExtraRuleRow[]): ExtraReminderRule[] {
  return rows
    .map((r) => ({
      daysBefore: r.daysBefore.trim() ? Number(r.daysBefore) : undefined,
      hoursBefore: r.hoursBefore.trim() ? Number(r.hoursBefore) : undefined,
    }))
    .filter(
      (r) =>
        (r.daysBefore !== undefined && !Number.isNaN(r.daysBefore) && r.daysBefore >= 0) ||
        (r.hoursBefore !== undefined && !Number.isNaN(r.hoursBefore) && r.hoursBefore > 0),
    );
}

interface TaskFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  taskId?: string;
  onClose: () => void;
}

export function TaskFormModal({ open, mode, taskId, onClose }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<TaskDto["priority"]>("medium");
  const [workflowStatus, setWorkflowStatus] = useState<TaskDto["workflowStatus"]>("planned");
  const [useDefaultReminders, setUseDefaultReminders] = useState(true);
  const [extraRows, setExtraRows] = useState<ExtraRuleRow[]>([emptyRule()]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    enabled: open,
  });

  const { data: taskData, isLoading: taskLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.getTask(taskId!),
    enabled: open && mode === "edit" && !!taskId,
  });

  const { data: remindersData } = useQuery({
    queryKey: ["reminders", taskId],
    queryFn: () => api.listReminders(taskId!),
    enabled: open && mode === "edit" && !!taskId,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setFile(null);

    if (mode === "create") {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setPriority("medium");
      setWorkflowStatus("planned");
      setUseDefaultReminders(true);
      setExtraRows([emptyRule()]);
      return;
    }

    if (taskData?.item) {
      const t = taskData.item;
      const { date, time } = splitDueAt(t.dueAt);
      setTitle(t.title);
      setDescription(t.description ?? "");
      setDueDate(date);
      setDueTime(time);
      setPriority(t.priority);
      setWorkflowStatus(t.workflowStatus);
      setUseDefaultReminders(taskData.reminderConfig.useDefaultReminders);
      setExtraRows(rulesToRows(taskData.reminderConfig.extraRules));
    }
  }, [open, mode, taskData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dueAt = toDueAtIso(dueDate, dueTime);
      const extraReminders = rowsToRules(extraRows);
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueAt,
        workflowStatus,
        useDefaultReminders,
        extraReminders,
      };

      let saved: TaskDto;
      if (mode === "create") {
        const res = await api.createTask(payload);
        saved = res.item;
      } else {
        const res = await api.updateTask(taskId!, {
          ...payload,
          description: description.trim() || null,
          dueAt: dueAt ?? null,
          rescheduleReminders: true,
        });
        saved = res.item;
      }

      if (file) {
        await api.uploadAttachment(saved.id, file);
      }
      return saved;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      if (taskId) {
        void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
        void queryClient.invalidateQueries({ queryKey: ["reminders", taskId] });
      }
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: string) => api.deleteReminder(reminderId),
    onSuccess: () => {
      if (taskId) void queryClient.invalidateQueries({ queryKey: ["reminders", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const offsets = settings?.notification.ddayOffsets ?? [3, 1, 0];
  const offsetLabel = offsets.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(", ");

  const isLoading = mode === "edit" && taskLoading;

  return (
    <Modal
      open={open}
      title={mode === "create" ? "새 업무 등록" : "업무 수정"}
      onClose={onClose}
      extraWide
    >
      {isLoading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) {
              setError("제목을 입력해 주세요.");
              return;
            }
            saveMutation.mutate();
          }}
        >
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">업무</h3>

              <div>
                <label className="block text-xs font-medium text-slate-600">제목 *</label>
                <input
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">설명</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">마감일</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">마감 시각</label>
                  <input
                    type="time"
                    className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600">우선순위</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskDto["priority"])}
                  >
                    <option value="urgent">긴급</option>
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">상태</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    value={workflowStatus}
                    onChange={(e) =>
                      setWorkflowStatus(e.target.value as TaskDto["workflowStatus"])
                    }
                  >
                    <option value="planned">예정</option>
                    <option value="in_progress">진행</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">첨부 파일</label>
                {mode === "edit" && taskData?.item.attachment && (
                  <p className="mt-1 text-xs text-slate-500">
                    {" "}
                    <AttachmentDownload
                      attachmentId={taskData.item.attachment.id}
                      fileName={taskData.item.attachment.fileName}
                      status={taskData.item.attachment.status}
                    />
                  </p>
                )}
                <input
                  type="file"
                  className="mt-1 w-full text-sm"
                  accept=".hwp,.hwpx,.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-400">
                  HWP, PDF, DOCX, TXT, 이미지 등 지원
                </p>
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 lg:min-h-full">
              <h3 className="text-sm font-semibold text-slate-800">알림</h3>

              {!dueDate ? (
                <p className="text-sm text-slate-500">
                  마감일을 설정하면 알림을 예약할 수 있습니다.
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={useDefaultReminders}
                      onChange={(e) => setUseDefaultReminders(e.target.checked)}
                    />
                    기본 ({offsetLabel})
                  </label>

                  {useDefaultReminders && (
                    <p className="text-xs text-slate-500">
                      마감일 기준 {offsetLabel}에 알림이 예약됩니다.
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">추가 알림</p>
                    {extraRows.map((row, index) => (
                      <div key={row.key} className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="N일 전"
                          className="w-24 rounded-md border border-surface-border bg-white px-2 py-1 text-sm"
                          value={row.daysBefore}
                          onChange={(e) => {
                            const next = [...extraRows];
                            next[index] = { ...row, daysBefore: e.target.value };
                            setExtraRows(next);
                          }}
                        />
                        <span className="text-xs text-slate-500">일 전</span>
                        <input
                          type="number"
                          min={1}
                          placeholder="N시간 전"
                          className="w-24 rounded-md border border-surface-border bg-white px-2 py-1 text-sm"
                          value={row.hoursBefore}
                          onChange={(e) => {
                            const next = [...extraRows];
                            next[index] = { ...row, hoursBefore: e.target.value };
                            setExtraRows(next);
                          }}
                        />
                        <span className="text-xs text-slate-500">시간 전</span>
                        {extraRows.length > 1 && (
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() => setExtraRows(extraRows.filter((_, i) => i !== index))}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-brand"
                      onClick={() => setExtraRows([...extraRows, emptyRule()])}
                    >
                      + 추가
                    </button>
                  </div>

                  {mode === "edit" && (remindersData?.items.length ?? 0) > 0 && (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-medium text-slate-600">예약된 알림</p>
                      <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                        {remindersData!.items.map((r) => (
                          <li
                            key={r.id}
                            className="flex items-center justify-between gap-2 rounded bg-white px-2 py-1"
                          >
                            <span>{formatDateTime(r.fireAt)}</span>
                            <span className="flex items-center gap-2">
                              <span
                                className={
                                  r.status === "pending"
                                    ? "text-amber-600"
                                    : r.status === "sent"
                                      ? "text-emerald-600"
                                      : "text-slate-400"
                                }
                              >
                                {r.status === "pending"
                                  ? "예약"
                                  : r.status === "sent"
                                    ? "발송"
                                    : "취소"}
                              </span>
                              {r.status === "pending" && (
                                <button
                                  type="button"
                                  className="text-red-600"
                                  disabled={deleteReminderMutation.isPending}
                                  onClick={() => deleteReminderMutation.mutate(r.id)}
                                >
                                  취소
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              onClick={onClose}
            >
              닫기
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "저장 중…" : mode === "create" ? "등록" : "저장"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
