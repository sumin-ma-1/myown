import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NotificationSettingsModal } from "@/components/dashboard/NotificationSettingsModal";
import { TaskFormModal } from "@/components/tasks/TaskFormModal";
import { FlashMessage } from "@/components/ui/FlashMessage";

const FAB_PATHS = new Set(["/dashboard", "/tasks", "/integrations"]);
const STORAGE_KEY = "myown.quickstart";
const SIZE = 56;
const MARGIN = 12;
const DRAG_THRESHOLD = 6;

type EdgePos = {
  h: "left" | "right";
  v: "top" | "bottom";
  x: number;
  y: number;
};

const DEFAULT_POS: EdgePos = { h: "right", v: "bottom", x: 32, y: 32 };

function clampPoint(left: number, top: number): { left: number; top: number } {
  const maxL = Math.max(MARGIN, window.innerWidth - SIZE - MARGIN);
  const maxT = Math.max(MARGIN, window.innerHeight - SIZE - MARGIN);
  return {
    left: Math.min(maxL, Math.max(MARGIN, left)),
    top: Math.min(maxT, Math.max(MARGIN, top)),
  };
}

function toEdges(left: number, top: number): EdgePos {
  const right = window.innerWidth - left - SIZE;
  const bottom = window.innerHeight - top - SIZE;
  return {
    h: left <= right ? "left" : "right",
    v: top <= bottom ? "top" : "bottom",
    x: Math.round(Math.min(left, right)),
    y: Math.round(Math.min(top, bottom)),
  };
}

function fromEdges(pos: EdgePos): { left: number; top: number } {
  const left = pos.h === "left" ? pos.x : window.innerWidth - SIZE - pos.x;
  const top = pos.v === "top" ? pos.y : window.innerHeight - SIZE - pos.y;
  return clampPoint(left, top);
}

function loadPos(): EdgePos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POS;
    const parsed = JSON.parse(raw) as Partial<EdgePos>;
    if (parsed.h !== "left" && parsed.h !== "right") return DEFAULT_POS;
    if (parsed.v !== "top" && parsed.v !== "bottom") return DEFAULT_POS;
    const x = Number(parsed.x);
    const y = Number(parsed.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return DEFAULT_POS;
    return { h: parsed.h, v: parsed.v, x, y };
  } catch {
    return DEFAULT_POS;
  }
}

const menuBtnClass =
  "flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-600 shadow-md transition hover:border-brand/40 hover:text-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300";

export function ChatFab() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);

  const [pos, setPos] = useState<EdgePos>(() => loadPos());
  const [point, setPoint] = useState(() =>
    typeof window === "undefined" ? { left: 0, top: 0 } : fromEdges(loadPos()),
  );
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const pointRef = useRef(point);
  pointRef.current = point;

  const syncFromEdges = useCallback((next: EdgePos) => {
    setPos(next);
    setPoint(fromEdges(next));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    const onResize = () => setPoint(fromEdges(pos));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!FAB_PATHS.has(pathname)) return null;

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origLeft: point.left,
      origTop: point.top,
      moved: false,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setDragging(true);
    setMenuOpen(false);
    const next = clampPoint(drag.origLeft + dx, drag.origTop + dy);
    pointRef.current = next;
    setPoint(next);
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    if (drag.moved) {
      syncFromEdges(toEdges(pointRef.current.left, pointRef.current.top));
      setDragging(false);
      return;
    }
    setDragging(false);
    setMenuOpen((open) => !open);
  };

  const menuAbove = point.top + SIZE / 2 > window.innerHeight / 2;

  return (
    <>
      <div
        ref={rootRef}
        className="fixed z-50"
        style={{ left: point.left, top: point.top, width: SIZE, height: SIZE }}
      >
        {menuOpen && (
          <div
            className={`absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 ${
              menuAbove ? "bottom-full mb-3" : "top-full mt-3"
            }`}
            role="menu"
            aria-label="바로가기"
          >
            <button
              type="button"
              role="menuitem"
              className={menuBtnClass}
              title="마이온 챗"
              aria-label="마이온 챗"
              onClick={() => {
                setMenuOpen(false);
                navigate("/chat");
              }}
            >
              <span className="material-icons text-[22px] leading-none" aria-hidden>
                commit
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuBtnClass}
              title="알림 설정"
              aria-label="알림 설정"
              onClick={() => {
                setMenuOpen(false);
                setNotifyOpen(true);
              }}
            >
              <span className="material-icons text-[22px] leading-none" aria-hidden>
                alarm
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={menuBtnClass}
              title="새 업무 등록"
              aria-label="새 업무 등록"
              onClick={() => {
                setMenuOpen(false);
                setTaskOpen(true);
              }}
            >
              <span className="material-icons text-[22px] leading-none" aria-hidden>
                add
              </span>
            </button>
          </div>
        )}

        <button
          type="button"
          className={`group h-14 w-14 overflow-hidden rounded-full border border-slate-200/70 shadow-md transition-[border-color,box-shadow,opacity] duration-200 hover:border-brand/40 hover:shadow-lg dark:border-slate-600/70 dark:hover:border-blue-500/40 ${
            dragging ? "cursor-grabbing" : "cursor-grab"
          } ${dragging || menuOpen ? "" : "chat-fab-float"}`}
          aria-label="바로가기"
          aria-expanded={menuOpen}
          title="바로가기"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <img
            src="/bot-profile.png"
            alt=""
            className="pointer-events-none h-full w-full object-cover opacity-40 transition-opacity duration-200 group-hover:opacity-100"
            width={56}
            height={56}
            draggable={false}
          />
        </button>
      </div>

      <TaskFormModal
        open={taskOpen}
        mode="create"
        onClose={() => setTaskOpen(false)}
        onSaved={setFlashMessage}
      />
      <NotificationSettingsModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        onSaved={setFlashMessage}
      />
      <FlashMessage message={flashMessage} onDismiss={() => setFlashMessage(null)} />
    </>
  );
}
