import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export function ScrollFadeArea({
  children,
  className = "",
  wrapperClassName = "",
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBottomFade, setShowBottomFade] = useState(false);

  const updateBottomFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
    const atBottom = distanceFromBottom <= 4;

    setShowBottomFade(hasOverflow && !atBottom);
  }, []);

  useEffect(() => {
    updateBottomFade();

    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateBottomFade);
    observer.observe(el);

    return () => observer.disconnect();
  }, [children, updateBottomFade]);

  return (
    <div className={`relative min-h-0 ${wrapperClassName}`}>
      <div
        ref={scrollRef}
        onScroll={updateBottomFade}
        className={`scrollbar-subtle overflow-y-auto ${className} ${
          showBottomFade ? "scroll-fade-mask-bottom" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
