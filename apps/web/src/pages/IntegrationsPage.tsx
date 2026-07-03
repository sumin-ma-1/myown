import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { GoogleCalendarCard } from "@/components/integrations/GoogleCalendarCard";

export function IntegrationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">연동 APP</h1>
        <p className="mt-1 text-sm text-slate-600">
          APP과 연동하여 채팅으로 업무를 등록하고 알림을 받을 수 있습니다.
        </p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">불러오는 중…</p>}
      {error && (
        <p className="text-sm text-red-600">
          {error instanceof Error ? error.message : "연동 목록을 불러오지 못했습니다."}
        </p>
      )}

      {data && (
        <div className="space-y-4">
          {data.items.map((item) => (
            <IntegrationCard key={item.provider} item={item} />
          ))}
        </div>
      )}

      <GoogleCalendarCard />
    </div>
  );
}
