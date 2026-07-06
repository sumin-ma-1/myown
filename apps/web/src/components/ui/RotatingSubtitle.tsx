import { useEffect, useState } from "react";

const ROTATE_MS = 6000;
const FADE_OUT_MS = 450;
const FADE_IN_MS = 1400;

interface RotatingSubtitleProps {
  messages: readonly string[];
  className?: string;
}

export function RotatingSubtitle({
  messages,
  className = "text-sm text-slate-500",
}: RotatingSubtitleProps) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setVisible(false), ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLParagraphElement>) => {
    if (event.propertyName !== "opacity" || visible) return;

    setIndex((i) => (i + 1) % messages.length);
    setVisible(true);
  };

  return (
    <p
      className={`${className} transition-opacity ease-in-out ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDuration: `${visible ? FADE_IN_MS : FADE_OUT_MS}ms` }}
      onTransitionEnd={handleTransitionEnd}
      aria-live="polite"
    >
      {messages[index]}
    </p>
  );
}

export const DASHBOARD_SUBTITLE_MESSAGES = [
  "오늘의 업무와 일정을 한눈에 확인해요.",
  "텔레그램, 카카오톡에서도 업무를 등록하고 조회할 수 있어요.",
  "캘린더에서 일정과 업무 마감을 함께 살펴보세요.",
  "구글 캘린더와 연동하여 일정을 가져오고, 텔레그램에서 업무 알림을 받을 수 있어요.",
] as const;

export const TASK_LIST_SUBTITLE_MESSAGES = [
  "등록한 업무와 첨부파일, 알림 상태를 관리합니다.",
  "업무 진행 상태, 정렬 필터로 업무를 빠르게 찾아보세요.",
  "행을 클릭하면 업무를 수정하거나 완료 처리할 수 있어요.",
  "마감, 우선순위 순으로 정렬해 놓치지 않게 관리해요.",
] as const;

export const INTEGRATIONS_SUBTITLE_MESSAGES = [
  "APP과 연동하여 채팅으로 업무를 등록하고 알림을 받을 수 있어요.",
  "텔레그램, 카카오톡 채널과 웹 계정을 연결해 보세요.",
  "구글 캘린더 일정을 가져와 업무로 활성화할 수 있어요.",
  "알림 수신은 텔레그램 연동 시 이용할 수 있어요.",
] as const;
