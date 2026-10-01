import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { api } from "@/api/client";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { GoogleCalendarCard } from "@/components/integrations/GoogleCalendarCard";

export function IntegrationsPage() {
  const location = useLocation();
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
  });

  useEffect(() => {
    if (location.hash !== "#google-calendar") return;
    const timer = window.setTimeout(() => {
      document.getElementById("google-calendar")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [location.hash, data, isLoading]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-8">
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
