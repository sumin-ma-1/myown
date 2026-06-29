import { useState } from "react";
import { api } from "@/api/client";

interface AttachmentDownloadProps {
  attachmentId: string;
  fileName: string;
  status?: string;
  className?: string;
}

export function AttachmentDownload({
  attachmentId,
  fileName,
  status = "ready",
  className = "text-brand hover:underline",
}: AttachmentDownloadProps) {
  const [loading, setLoading] = useState(false);

  if (status !== "ready") {
    return (
      <span className="text-slate-400" title={status === "processing" ? "처리 중" : "사용 불가"}>
        {fileName}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      disabled={loading}
      title="다운로드"
      onClick={async (e) => {
        e.stopPropagation();
        setLoading(true);
        try {
          await api.downloadAttachment(attachmentId, fileName);
        } catch (err) {
          alert(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "다운로드 중…" : fileName}
    </button>
  );
}
