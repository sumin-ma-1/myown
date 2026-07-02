import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card } from "@/components/ui/Card";

export function AdminActivityPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "activity"],
    queryFn: api.adminListActivity,
  });

  if (isLoading) return <p className="text-sm text-slate-500">불러오는 중…</p>;
  if (error) {
    return <p className="text-sm text-red-600">{error instanceof Error ? error.message : "오류"}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">로그인 기록</h1>
        <p className="text-sm text-slate-500">최근 가입·로그인 (최대 100건)</p>
      </div>
      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-border bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">시간</th>
              <th className="px-4 py-3 font-medium">이벤트</th>
              <th className="px-4 py-3 font-medium">이메일</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((event) => (
              <tr key={event.id} className="border-b border-surface-border last:border-0">
                <td className="px-4 py-3 text-slate-600">
                  {new Date(event.createdAt).toLocaleString("ko-KR")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {event.eventType === "signup" ? "가입" : "로그인"}
                </td>
                <td className="px-4 py-3 font-medium text-slate-900">{event.email ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{event.ip ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.items.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-slate-500">기록이 없습니다.</p>
        )}
      </Card>
    </div>
  );
}
