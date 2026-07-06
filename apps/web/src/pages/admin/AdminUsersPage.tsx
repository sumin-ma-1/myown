import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card } from "@/components/ui/Card";

export function AdminUsersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: api.adminListUsers,
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">사용자</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">가입한 계정과 Telegram 연동 상태</p>
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">역할</th>
              <th className="px-4 py-3 font-medium">Telegram</th>
              <th className="px-4 py-3 font-medium">초대코드</th>
              <th className="px-4 py-3 font-medium">마지막 로그인</th>
              <th className="px-4 py-3 font-medium">활성 업무</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((user) => (
              <tr
                key={user.id}
                className="border-b border-surface-border last:border-0 dark:border-slate-700"
              >
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.role}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {user.telegramConnected
                    ? user.telegramDisplayName ?? "연결됨"
                    : "미연결"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {user.inviteCode ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString("ko-KR")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.activeTaskCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            아직 사용자가 없습니다.
          </p>
        )}
      </Card>
    </div>
  );
}
