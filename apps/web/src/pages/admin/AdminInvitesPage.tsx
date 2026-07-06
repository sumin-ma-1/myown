import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card } from "@/components/ui/Card";

const inputClass =
  "w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function statusLabel(status: string): string {
  switch (status) {
    case "available":
      return "사용 가능";
    case "used":
      return "사용됨";
    case "expired":
      return "만료";
    default:
      return status;
  }
}

export function AdminInvitesPage() {
  const queryClient = useQueryClient();
  const [allowedEmail, setAllowedEmail] = useState("");
  const [note, setNote] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: api.adminListInvites,
  });

  const createInvite = useMutation({
    mutationFn: () =>
      api.adminCreateInvite({
        allowedEmail: allowedEmail.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: (res) => {
      setCreatedUrl(res.item.signupUrl);
      setAllowedEmail("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
  });

  if (isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">불러오는 중…</p>;
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        {error instanceof Error ? error.message : "오류"}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">초대코드</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">이메일 전용 1회용 가입 코드</p>
      </div>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">새 초대코드</h2>
        <div>
          <label
            htmlFor="allowedEmail"
            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            초대할 Google 이메일
          </label>
          <input
            id="allowedEmail"
            type="email"
            value={allowedEmail}
            onChange={(e) => setAllowedEmail(e.target.value)}
            placeholder="user@example.com"
            className={inputClass}
          />
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (선택)"
          className={inputClass}
        />
        <button
          type="button"
          disabled={createInvite.isPending || !allowedEmail.trim()}
          onClick={() => createInvite.mutate()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {createInvite.isPending ? "발급 중…" : "초대코드 발급"}
        </button>
        {createInvite.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {createInvite.error instanceof Error ? createInvite.error.message : "발급 실패"}
          </p>
        )}
        {createdUrl && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            <p className="font-medium">가입 링크가 생성되었습니다.</p>
            <p className="mt-1 break-all font-mono text-xs">{createdUrl}</p>
            <button
              type="button"
              className="mt-2 text-xs font-medium underline"
              onClick={() => void navigator.clipboard.writeText(createdUrl)}
            >
              링크 복사
            </button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">코드</th>
              <th className="px-4 py-3 font-medium">초대 이메일</th>
              <th className="px-4 py-3 font-medium">메모</th>
              <th className="px-4 py-3 font-medium">상태</th>
              <th className="px-4 py-3 font-medium">사용자</th>
              <th className="px-4 py-3 font-medium">생성일</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((invite) => (
              <tr
                key={invite.id}
                className="border-b border-surface-border last:border-0 dark:border-slate-700"
              >
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 dark:text-slate-100">
                  {invite.code}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{invite.allowedEmail}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{invite.note ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {statusLabel(invite.status)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{invite.usedByEmail ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {new Date(invite.createdAt).toLocaleString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
