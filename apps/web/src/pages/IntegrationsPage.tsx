import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { GoogleCalendarCard } from "@/components/integrations/GoogleCalendarCard";
import { INTEGRATIONS_SUBTITLE_MESSAGES, RotatingSubtitle } from "@/components/ui/RotatingSubtitle";

export function IntegrationsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">연동 APP</h1>
        <RotatingSubtitle
          messages={INTEGRATIONS_SUBTITLE_MESSAGES}
          className="mt-1 text-sm text-slate-600 dark:text-slate-400"
        />
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
