import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { ComposeDraftDto } from "@/api/types";
import { formatDateTime } from "@/lib/dates";
import { priorityLabel } from "@/lib/priority";
import { ScrollFadeArea } from "@/components/ui/ScrollFadeArea";
import { CHAT_HINT_MESSAGES, RotatingSubtitle } from "@/components/ui/RotatingSubtitle";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

interface PendingFile {
  id: string;
  file: File;
}

const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";
/** main p-6 하단 패딩까지 쓰며 입력창을 페이지 바닥 쪽에 고정 */
const CHAT_PAGE_CLASS = "-mb-6 flex h-[calc(100vh-1.5rem)] flex-col";

const TYPING_DOT_SIZE_PX = 7;
const TYPING_DOT_GAP_PX = 4;

function ChatTypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-3xl bg-slate-100 px-4 py-2.5 dark:bg-slate-700"
        role="status"
        aria-label="답변 작성 중"
      >
        <div className="flex items-center" style={{ gap: TYPING_DOT_GAP_PX }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="animate-bounce rounded-full bg-slate-400 dark:bg-slate-300"
              style={{
                width: TYPING_DOT_SIZE_PX,
                height: TYPING_DOT_SIZE_PX,
                animationDelay: `${i * 150}ms`,
                animationDuration: "0.8s",
              }}
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatMessageBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-sm leading-relaxed ${
          role === "user"
            ? "bg-brand text-white"
            : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
        }`}
      >
        {text}
      </div>
    </div>
  );
}

function ComposePanel({
  compose,
  busy,
  onRegister,
  onCancel,
}: {
  compose: ComposeDraftDto;
  busy: boolean;
  onRegister: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-brand/25 bg-brand-muted/40 p-4 dark:border-blue-800/50 dark:bg-blue-950/30">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand dark:text-blue-300">
        등록 대기 중
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{compose.title}</p>
      {compose.description && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{compose.description}</p>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {compose.dueAt && <span>마감 {formatDateTime(compose.dueAt)}</span>}
        {compose.priority && <span>우선순위 {priorityLabel(compose.priority)}</span>}
      </div>
      {compose.attachments.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
          {compose.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1">
              <span className="material-icons text-[14px] leading-none" aria-hidden>
                upload_file
              </span>
              {a.fileName}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          disabled={busy}
          onClick={onRegister}
        >
          등록 완료
        </button>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          disabled={busy}
          onClick={onCancel}
        >
          등록 취소
        </button>
      </div>
    </div>
  );
}

function PendingFileChips({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (id: string) => void;
}) {
  if (files.length === 0) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {files.map((pending) => (
        <span
          key={pending.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          <span className="material-icons shrink-0 text-[14px] leading-none text-slate-500" aria-hidden>
            upload_file
          </span>
          <span className="max-w-[12rem] truncate">{pending.file.name}</span>
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            onClick={() => onRemove(pending.id)}
            aria-label={`${pending.file.name} 첨부 제거`}
          >
            <span className="material-icons text-[16px] leading-none" aria-hidden>
              close
            </span>
          </button>
        </span>
      ))}
    </div>
  );
}

function ChatSessionNotice() {
  return (
    <p className="mt-2 text-center text-xs text-slate-400 dark:text-slate-500">
      채팅 기록은 현재 브라우저 세션에만 남고, 등록 완료된 업무는 저장되어 알림드려요.
    </p>
  );
}

function ChatInputBar({
  input,
  compose,
  busy,
  sendPending,
  pendingFiles,
  fileInputRef,
  onInputChange,
  onSend,
  onFileSelect,
  onRemovePendingFile,
  className = "",
}: {
  input: string;
  compose: ComposeDraftDto | null;
  busy: boolean;
  sendPending: boolean;
  pendingFiles: PendingFile[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onFileSelect: (files: File[]) => void;
  onRemovePendingFile: (id: string) => void;
  className?: string;
}) {
  const controlClass =
    "h-11 shrink-0 rounded-3xl border border-surface-border bg-white text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  const canSend = input.trim().length > 0 || pendingFiles.length > 0;

  return (
    <div className={className}>
      <PendingFileChips files={pendingFiles} onRemove={onRemovePendingFile} />
      <div className="flex w-full items-center gap-2.5">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".hwp,.hwpx,.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length > 0) onFileSelect(selected);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={`flex w-11 items-center justify-center border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 ${controlClass}`}
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
        title="파일 첨부"
      >
        <span className="material-icons text-[20px] leading-none" aria-hidden>
          attach_file
        </span>
      </button>
      <textarea
        rows={1}
        className={`${controlClass} box-border h-11 min-h-11 max-h-32 flex-1 resize-none overflow-y-auto px-4 py-2.5 leading-5`}
        placeholder={compose ? "메모를 입력하세요." : "쉽게 일정을 등록해보세요."}
        value={input}
        disabled={busy}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button
        type="button"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-3xl bg-brand text-white disabled:opacity-60"
        disabled={busy || !canSend}
        onClick={onSend}
        title={sendPending ? "전송 중…" : "전송"}
        aria-label={sendPending ? "전송 중" : "전송"}
      >
        <span className="material-icons text-[20px] leading-none" aria-hidden>
          arrow_upward
        </span>
      </button>
      </div>
    </div>
  );
}

export function ChatPage() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [compose, setCompose] = useState<ComposeDraftDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: composeData } = useQuery({
    queryKey: ["chat-compose"],
    queryFn: api.getChatCompose,
  });

  useEffect(() => {
    if (composeData?.compose) {
      setCompose(composeData.compose);
    }
  }, [composeData]);

  const appendAssistantMessage = (reply: string, nextCompose: ComposeDraftDto | null) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", text: reply },
    ]);
    setCompose(nextCompose);
  };

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      if (compose) {
        return api.addChatMemo(text);
      }
      return api.sendChatMessage(text);
    },
    onMutate: (text) => {
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text },
      ]);
    },
    onSuccess: (data) => {
      appendAssistantMessage(data.reply, data.compose);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-compose"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "전송에 실패했습니다.");
    },
  });

  const sendWithAttachmentsMutation = useMutation({
    mutationFn: async ({
      files,
      text,
      hasCompose,
    }: {
      files: PendingFile[];
      text: string;
      hasCompose: boolean;
    }) => {
      let last = await api.uploadChatFile(
        files[0]!.file,
        hasCompose ? undefined : text || undefined,
      );

      for (let i = 1; i < files.length; i++) {
        last = await api.uploadChatFile(files[i]!.file);
      }

      if (text && hasCompose) {
        last = await api.addChatMemo(text);
      }

      return { last, files, text };
    },
    onMutate: ({ files, text }) => {
      setError(null);
      const fileLine = files.map((p) => `📎 ${p.file.name}`).join("\n");
      const userText = text ? (files.length > 0 ? `${text}\n${fileLine}` : text) : fileLine;
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: userText },
      ]);
    },
    onSuccess: ({ last }) => {
      appendAssistantMessage(last.reply, last.compose);
      void queryClient.invalidateQueries({ queryKey: ["chat-compose"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "전송에 실패했습니다.");
    },
  });

  const registerMutation = useMutation({
    mutationFn: api.registerChatCompose,
    onSuccess: (data) => {
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: data.reply },
      ]);
      setCompose(null);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-compose"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "등록에 실패했습니다.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: api.cancelChatCompose,
    onSuccess: (data) => {
      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", text: data.reply },
      ]);
      setCompose(null);
      void queryClient.invalidateQueries({ queryKey: ["chat-compose"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "취소에 실패했습니다.");
    },
  });

  const awaitingReply =
    sendMutation.isPending ||
    sendWithAttachmentsMutation.isPending ||
    registerMutation.isPending ||
    cancelMutation.isPending;

  const hasConversation = messages.length > 0 || awaitingReply;

  useEffect(() => {
    if (!hasConversation) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, compose, hasConversation, awaitingReply]);

  const busy = awaitingReply;

  const addPendingFiles = (files: File[]) => {
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSend = () => {
    if (busy) return;
    const text = input.trim();
    const files = pendingFiles;
    if (!text && files.length === 0) return;

    if (files.length > 0) {
      setInput("");
      setPendingFiles([]);
      sendWithAttachmentsMutation.mutate({
        files,
        text,
        hasCompose: compose !== null,
      });
      return;
    }

    setInput("");
    sendMutation.mutate(text);
  };

  const inputBarProps = {
    input,
    compose,
    busy,
    sendPending: awaitingReply,
    pendingFiles,
    fileInputRef,
    onInputChange: setInput,
    onSend: handleSend,
    onFileSelect: addPendingFiles,
    onRemovePendingFile: removePendingFile,
  };

  if (!hasConversation) {
    return (
      <div className={`${CHAT_PAGE_CLASS} items-center justify-center`}>
        <div className={CHAT_COLUMN_CLASS}>
          {error && (
            <p className="mb-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {compose && (
            <div className="mb-4">
              <ComposePanel
                compose={compose}
                busy={busy}
                onRegister={() => registerMutation.mutate()}
                onCancel={() => cancelMutation.mutate()}
              />
            </div>
          )}
          <div className="mb-6 flex min-h-[3.5rem] items-center justify-center px-4">
            <RotatingSubtitle
              messages={CHAT_HINT_MESSAGES}
              className="max-w-lg text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400"
            />
          </div>
          <ChatInputBar {...inputBarProps} />
          <ChatSessionNotice />
        </div>
      </div>
    );
  }

  return (
    <div className={CHAT_PAGE_CLASS}>
      <ScrollFadeArea
        wrapperClassName="-mr-6 flex-1"
        className="h-full"
      >
        <div className={`${CHAT_COLUMN_CLASS} space-y-3 py-4 pr-6`}>
          {messages.map((msg) => (
            <ChatMessageBubble key={msg.id} role={msg.role} text={msg.text} />
          ))}

          {awaitingReply && <ChatTypingIndicator />}

          {compose && (
            <ComposePanel
              compose={compose}
              busy={busy}
              onRegister={() => registerMutation.mutate()}
              onCancel={() => cancelMutation.mutate()}
            />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollFadeArea>

      {error && (
        <p className={`${CHAT_COLUMN_CLASS} py-2 text-sm text-red-600 dark:text-red-400`}>
          {error}
        </p>
      )}

      <div className={`${CHAT_COLUMN_CLASS} shrink-0 pb-8 pt-2`}>
        <ChatInputBar {...inputBarProps} />
        <ChatSessionNotice />
      </div>
    </div>
  );
}
