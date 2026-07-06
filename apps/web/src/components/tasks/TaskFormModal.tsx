import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ExtraReminderRule, ReminderDto, TaskDto } from "@/api/types";
import { Modal } from "@/components/ui/Modal";
import { AttachmentDownload } from "@/components/tasks/AttachmentDownload";
import { formatDateTime, isValidTimeInput, normalizeTimeInput } from "@/lib/dates";
import { extraRulesEqual } from "@/lib/reminder-rules";
import { describeExtraRuleSchedule } from "@/lib/reminder-preview";

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
  const normalized = normalizeTimeInput(time);
  const t = normalized || "09:00";
  if (!isValidTimeInput(t)) return undefined;
  const parsed = new Date(`${date}T${t}:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

interface ExtraRuleRow {
  key: string;
  daysBefore: string;
  hoursBefore: string;
  minutesBefore: string;
}

function emptyRule(): ExtraRuleRow {
  return { key: crypto.randomUUID(), daysBefore: "", hoursBefore: "", minutesBefore: "" };
}

function rulesToRows(rules: ExtraReminderRule[]): ExtraRuleRow[] {
  if (rules.length === 0) return [emptyRule()];
  return rules.map((r) => ({
    key: crypto.randomUUID(),
    daysBefore: r.daysBefore !== undefined ? String(r.daysBefore) : "",
    hoursBefore: r.hoursBefore !== undefined ? String(r.hoursBefore) : "",
    minutesBefore: r.minutesBefore !== undefined ? String(r.minutesBefore) : "",
  }));
}

function rowsToRules(rows: ExtraRuleRow[]): ExtraReminderRule[] {
  return rows
    .map((r) => ({
      daysBefore: r.daysBefore.trim() ? Number(r.daysBefore) : undefined,
      hoursBefore: r.hoursBefore.trim() ? Number(r.hoursBefore) : undefined,
      minutesBefore: r.minutesBefore.trim() ? Number(r.minutesBefore) : undefined,
    }))
    .filter(
      (r) =>
        (r.daysBefore !== undefined && !Number.isNaN(r.daysBefore) && r.daysBefore >= 0) ||
        (r.hoursBefore !== undefined && !Number.isNaN(r.hoursBefore) && r.hoursBefore > 0) ||
        (r.minutesBefore !== undefined && !Number.isNaN(r.minutesBefore) && r.minutesBefore > 0),
    );
}

function rowToRule(row: ExtraRuleRow): ExtraReminderRule | null {
  const [rule] = rowsToRules([row]);
  return rule ?? null;
}

function ReminderList({
  items,
  emptyMessage,
  onCancel,
  cancelPending,
}: {
  items: ReminderDto[];
  emptyMessage: string;
  onCancel: (id: string) => void;
  cancelPending: boolean;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-slate-500">{emptyMessage}</p>;
  }

  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-xs">
      {items.map((r) => (
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
              {r.status === "pending" ? "예약" : r.status === "sent" ? "발송" : "취소"}
            </span>
            {r.status === "pending" && (
              <button
                type="button"
                className="text-red-600"
                disabled={cancelPending}
                onClick={() => onCancel(r.id)}
              >
                취소
              </button>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface PendingFile {
  key: string;
  file: File;
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
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [extraReminderMessage, setExtraReminderMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialReminderConfigRef = useRef<{
    useDefaultReminders: boolean;
    extraRules: ExtraReminderRule[];
  } | null>(null);

  const addPendingFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setPendingFiles((prev) => [
      ...prev,
      ...list.map((file) => ({ key: crypto.randomUUID(), file })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (key: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.key !== key));
  };

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
    setSaveMessage(null);
    setExtraReminderMessage(null);
    setPendingFiles([]);
    setRemovedAttachmentIds([]);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (mode === "create") {
      setTitle("");
      setDescription("");
      setDueDate("");
      setDueTime("");
      setPriority("medium");
      setWorkflowStatus("planned");
      setUseDefaultReminders(true);
      setExtraRows([emptyRule()]);
      initialReminderConfigRef.current = null;
      return;
    }

    if (!taskData || taskData.item.id !== taskId) {
      initialReminderConfigRef.current = null;
      return;
    }

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
    initialReminderConfigRef.current = {
      useDefaultReminders: taskData.reminderConfig.useDefaultReminders,
      extraRules: taskData.reminderConfig.extraRules,
    };
  }, [open, mode, taskData, taskId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dueAt = toDueAtIso(dueDate, dueTime);
      const extraReminders = rowsToRules(extraRows);
      const payload: Parameters<typeof api.createTask>[0] = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueAt,
        workflowStatus,
      };

      if (mode === "create") {
        payload.useDefaultReminders = useDefaultReminders;
        payload.extraReminders = extraReminders;
      } else {
        let loadedConfig: { useDefaultReminders: boolean; extraRules: ExtraReminderRule[] } | null =
          null;
        if (taskData && taskData.item.id === taskId) {
          loadedConfig = taskData.reminderConfig;
        }
        const baseline = initialReminderConfigRef.current ?? loadedConfig;
        if (baseline) {
          if (useDefaultReminders !== baseline.useDefaultReminders) {
            payload.useDefaultReminders = useDefaultReminders;
          }
          if (!extraRulesEqual(extraReminders, baseline.extraRules)) {
            payload.extraReminders = extraReminders;
          }
        } else {
          payload.useDefaultReminders = useDefaultReminders;
          payload.extraReminders = extraReminders;
        }
      }

      let saved: TaskDto;
      if (mode === "create") {
        const res = await api.createTask(payload);
        saved = res.item;
      } else {
        const res = await api.updateTask(taskId!, {
          ...payload,
          description: description.trim() || null,
          dueAt: dueAt ?? null,
        });
        saved = res.item;
      }

      if (pendingFiles.length > 0) {
        await api.uploadAttachment(
          saved.id,
          pendingFiles.map((p) => p.file),
        );
      }
      for (const attachmentId of removedAttachmentIds) {
        await api.removeAttachment(saved.id, attachmentId);
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
      if (mode === "create") {
        onClose();
        return;
      }
      setSaveMessage("저장되었습니다.");
      initialReminderConfigRef.current = {
        useDefaultReminders,
        extraRules: rowsToRules(extraRows),
      };
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    },
  });

  const applyExtraRemindersMutation = useMutation({
    mutationFn: async (rules: ExtraReminderRule[]) => {
      if (!taskId) throw new Error("업무를 먼저 저장해 주세요.");
      await api.updateTask(taskId, { extraReminders: rules });
      return rules;
    },
    onSuccess: (rules) => {
      initialReminderConfigRef.current = {
        useDefaultReminders,
        extraRules: rules,
      };
      void queryClient.invalidateQueries({ queryKey: ["reminders", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const commitExtraRemindersIfChanged = async (rules: ExtraReminderRule[]): Promise<boolean> => {
    if (mode !== "edit" || !taskId) return false;
    const baseline = initialReminderConfigRef.current;
    if (baseline && extraRulesEqual(rules, baseline.extraRules)) return false;
    await applyExtraRemindersMutation.mutateAsync(rules);
    return true;
  };

  const handleAddExtraRow = async () => {
    const rules = rowsToRules(extraRows);
    if (mode === "edit" && taskId && rules.length > 0) {
      try {
        setError(null);
        setExtraReminderMessage(null);
        const applied = await commitExtraRemindersIfChanged(rules);
        if (applied) {
          setExtraReminderMessage("예약된 알림에 반영되었습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알림 예약에 실패했습니다.");
        return;
      }
    }
    setExtraRows([...extraRows, emptyRule()]);
  };

  const handleRemoveExtraRow = async (index: number) => {
    const nextRows = extraRows.filter((_, i) => i !== index);
    const normalizedRows = nextRows.length > 0 ? nextRows : [emptyRule()];
    setExtraRows(normalizedRows);

    if (mode !== "edit" || !taskId) return;

    const rules = rowsToRules(normalizedRows);
    try {
      setError(null);
      setExtraReminderMessage(null);
      const applied = await commitExtraRemindersIfChanged(rules);
      if (applied) {
        setExtraReminderMessage("예약된 알림에 반영되었습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 변경에 실패했습니다.");
    }
  };

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: string) => api.deleteReminder(reminderId),
    onSuccess: () => {
      if (taskId) void queryClient.invalidateQueries({ queryKey: ["reminders", taskId] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: () => api.deleteTask(taskId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: () => api.updateTask(taskId!, { status: "completed" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      if (taskId) void queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "완료 처리에 실패했습니다.");
    },
  });

  const offsets = settings?.notification.ddayOffsets ?? [3, 1, 0];
  const offsetLabel = offsets.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(", ");
  const reminderHour = settings?.notification.reminderHour ?? 9;
  const dueAtIso = toDueAtIso(dueDate, dueTime);
  const extraApplying = applyExtraRemindersMutation.isPending;

  const existingAttachments =
    taskData?.item.attachments.filter((a) => !removedAttachmentIds.includes(a.id)) ?? [];
  const scheduledReminders =
    remindersData?.items.filter((r) => r.status !== "cancelled") ?? [];
  const extraScheduleOptions = { useDefaultReminders, ddayOffsets: offsets };
  const isLoading = mode === "edit" && taskLoading;
  const canComplete = mode === "edit" && taskData?.item.status === "active";
  const footerBusy =
    saveMutation.isPending || deleteTaskMutation.isPending || completeTaskMutation.isPending;

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
            if (dueDate && dueTime.trim() && !isValidTimeInput(dueTime)) {
              setError("마감 시각은 24시간 형식으로 입력해 주세요. (예: 14:00)");
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
                    type="text"
                    inputMode="numeric"
                    placeholder="14:00"
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    onBlur={(e) => setDueTime(normalizeTimeInput(e.target.value))}
                  />
                  <p className="mt-1 text-xs text-slate-400">24시간 형식 (기본 09:00)</p>
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
                {(existingAttachments.length > 0 || pendingFiles.length > 0) && (
                  <ul className="mt-2 space-y-2">
                    {existingAttachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm">
                          <AttachmentDownload
                            attachmentId={attachment.id}
                            fileName={attachment.fileName}
                            status={attachment.status}
                          />
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-red-600 hover:text-red-700"
                          onClick={() =>
                            setRemovedAttachmentIds((prev) => [...prev, attachment.id])
                          }
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                    {removedAttachmentIds.map((id) => {
                      const removed = taskData?.item.attachments.find((a) => a.id === id);
                      if (!removed) return null;
                      return (
                        <li
                          key={`removed-${id}`}
                          className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-400 line-through">
                            {removed.fileName}
                          </span>
                          <span className="shrink-0 text-xs text-amber-600">저장 시 삭제</span>
                          <button
                            type="button"
                            className="shrink-0 text-xs text-slate-600 hover:text-slate-800"
                            onClick={() =>
                              setRemovedAttachmentIds((prev) => prev.filter((x) => x !== id))
                            }
                          >
                            취소
                          </button>
                        </li>
                      );
                    })}
                    {pendingFiles.map((pending) => (
                      <li
                        key={pending.key}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          {pending.file.name}
                          <span className="ml-1 text-xs text-slate-400">(새 파일)</span>
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-red-600 hover:text-red-700"
                          onClick={() => removePendingFile(pending.key)}
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="mt-1 w-full text-sm"
                  accept=".hwp,.hwpx,.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => addPendingFiles(e.target.files ?? [])}
                />
                <p className="mt-1 text-xs text-slate-400">
                  여러 파일 선택 가능 (HWP, PDF, DOCX, TXT, 이미지 등 지원)
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
                    {extraRows.map((row, index) => {
                      const rule = rowToRule(row);
                      const scheduleHint =
                        rule &&
                        describeExtraRuleSchedule(
                          dueAtIso,
                          reminderHour,
                          rule,
                          formatDateTime,
                          extraScheduleOptions,
                        );
                      const isLastRow = index === extraRows.length - 1;

                      return (
                        <div key={row.key} className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              placeholder="일"
                              className="w-14 shrink-0 rounded-md border border-surface-border bg-white px-2 py-1.5 text-sm"
                              value={row.daysBefore}
                              onChange={(e) => {
                                const next = [...extraRows];
                                next[index] = { ...row, daysBefore: e.target.value };
                                setExtraRows(next);
                              }}
                            />
                            <span className="shrink-0 text-sm text-slate-500">일</span>
                            <input
                              type="number"
                              min={1}
                              placeholder="시"
                              className="w-14 shrink-0 rounded-md border border-surface-border bg-white px-2 py-1.5 text-sm"
                              value={row.hoursBefore}
                              onChange={(e) => {
                                const next = [...extraRows];
                                next[index] = { ...row, hoursBefore: e.target.value };
                                setExtraRows(next);
                              }}
                            />
                            <span className="shrink-0 text-sm text-slate-500">시간</span>
                            <input
                              type="number"
                              min={1}
                              placeholder="분"
                              className="w-14 shrink-0 rounded-md border border-surface-border bg-white px-2 py-1.5 text-sm"
                              value={row.minutesBefore}
                              onChange={(e) => {
                                const next = [...extraRows];
                                next[index] = { ...row, minutesBefore: e.target.value };
                                setExtraRows(next);
                              }}
                            />
                            <span className="shrink-0 text-sm text-slate-500">분 전</span>
                            {isLastRow && (
                              <button
                                type="button"
                                className="shrink-0 rounded-md border border-brand/30 bg-brand/5 px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-50"
                                disabled={extraApplying || !rule}
                                onClick={() => void handleAddExtraRow()}
                              >
                                {extraApplying ? "예약 중" : "추가"}
                              </button>
                            )}
                            {extraRows.length > 1 && (
                              <button
                                type="button"
                                className="shrink-0 px-1 text-sm text-red-600 disabled:opacity-50"
                                disabled={extraApplying}
                                onClick={() => void handleRemoveExtraRow(index)}
                              >
                                삭제
                              </button>
                            )}
                          </div>
                          {scheduleHint && (
                            <p className="pl-0.5 text-[11px] text-slate-500">
                              {scheduleHint}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {mode === "create" && (
                      <p className="text-[11px] text-slate-400">
                        추가 알림은 업무 등록 후 예약됩니다.
                      </p>
                    )}
                    {extraReminderMessage && (
                      <p className="text-xs text-emerald-700">{extraReminderMessage}</p>
                    )}
                  </div>

                  {mode === "edit" && (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs font-medium text-slate-600">예약된 알림</p>
                      {remindersData && (
                        <ReminderList
                          items={scheduledReminders}
                          emptyMessage="예약된 알림이 없습니다."
                          onCancel={(id) => deleteReminderMutation.mutate(id)}
                          cancelPending={deleteReminderMutation.isPending}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saveMessage && <p className="text-sm text-emerald-700">{saveMessage}</p>}

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
            {mode === "edit" ? (
              <div className="flex flex-wrap gap-2">
                {canComplete && (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-4 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                    disabled={footerBusy}
                    onClick={() => {
                      if (!taskId) return;
                      const name = title.trim() || "이 업무";
                      if (window.confirm(`「${name}」을(를) 완료 처리할까요?`)) {
                        completeTaskMutation.mutate();
                      }
                    }}
                  >
                    <span className="material-icons text-[18px] leading-none" aria-hidden>
                      check_circle
                    </span>
                    {completeTaskMutation.isPending ? "처리 중…" : "업무 완료"}
                  </button>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                  disabled={footerBusy}
                  onClick={() => {
                    if (!taskId) return;
                    const name = title.trim() || "이 업무";
                    if (window.confirm(`「${name}」을(를) 삭제할까요?\n예약된 알림도 함께 취소됩니다.`)) {
                      deleteTaskMutation.mutate();
                    }
                  }}
                >
                  <span className="material-icons text-[18px] leading-none" aria-hidden>
                    delete
                  </span>
                  {deleteTaskMutation.isPending ? "삭제 중…" : "업무 삭제"}
                </button>
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                disabled={footerBusy}
              >
                {saveMutation.isPending ? "저장 중…" : mode === "create" ? "등록" : "저장"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
