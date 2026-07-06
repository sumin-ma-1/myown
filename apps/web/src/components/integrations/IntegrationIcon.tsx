import type { ChannelProvider } from "@/api/types";

export type IntegrationIconId = ChannelProvider | "google-calendar";

const ICON_SRC: Record<IntegrationIconId, string> = {
  telegram: "/icons/telegram.png",
  kakao: "/icons/kakaotalk.png",
  slack: "/icons/slack.png",
  "google-calendar": "/icons/google-calendar.png",
};

interface IntegrationIconProps {
  id: IntegrationIconId;
  size?: number;
  className?: string;
}

export function IntegrationIcon({ id, size = 20, className = "" }: IntegrationIconProps) {
  return (
    <img
      src={ICON_SRC[id]}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-sm ${className}`}
      aria-hidden
    />
  );
}

interface IntegrationTitleProps {
  id: IntegrationIconId;
  name: string;
  iconSize?: number;
  className?: string;
}

export function IntegrationTitle({
  id,
  name,
  iconSize = 20,
  className = "",
}: IntegrationTitleProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <IntegrationIcon id={id} size={iconSize} />
      <span>{name}</span>
    </span>
  );
}
