import { useEffect, useState } from "react";

const MESSAGES = [
  "오늘의 업무와 일정을 한눈에 확인해요.",
  "텔레그램, 카카오톡에서도 업무를 등록하고 조회할 수 있어요.",
  "캘린더에서 일정과 업무 마감을 함께 살펴보세요.",
  "구글 캘린더와 연동하여 일정을 가져오고, 텔레그램에서 업무 알림을 받을 수 있어요.",
] as const;

const ROTATE_MS = 6000;
const FADE_OUT_MS = 450;
const FADE_IN_MS = 1400;

export function RotatingSubtitle() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setVisible(false), ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLParagraphElement>) => {
    if (event.propertyName !== "opacity" || visible) return;

    setIndex((i) => (i + 1) % MESSAGES.length);
    setVisible(true);
  };

  return (
    <p
      className={`text-sm text-slate-500 transition-opacity ease-in-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ transitionDuration: `${visible ? FADE_IN_MS : FADE_OUT_MS}ms` }}
      onTransitionEnd={handleTransitionEnd}
      aria-live="polite"
    >
      {MESSAGES[index]}
    </p>
  );
}
