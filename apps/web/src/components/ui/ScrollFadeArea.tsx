import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(value);
  else ref.current = value;
}

export function ScrollFadeArea({
  children,
  className = "",
  wrapperClassName = "",
  hideScrollbar = false,
  viewportRef,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
  /** 스크롤은 가능하되 스크롤바는 숨김 (하단 fade만 표시) */
  hideScrollbar?: boolean;
  viewportRef?: Ref<HTMLDivElement>;
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
        ref={(node) => {
          scrollRef.current = node;
          assignRef(viewportRef, node);
        }}
        onScroll={updateBottomFade}
        className={`${hideScrollbar ? "scrollbar-none" : "scrollbar-subtle"} overflow-y-auto ${className} ${
          showBottomFade ? "scroll-fade-mask-bottom" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
