import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { api } from "@/api/client";
import { googleAuthUrl } from "@/lib/google-auth";

export function SignupPage() {
  const [searchParams] = useSearchParams();
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") ?? "");
  const [allowedEmail, setAllowedEmail] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const urlError = searchParams.get("error");

  useEffect(() => {
    const code = inviteCode.trim();
    if (!code) {
      setAllowedEmail(null);
      setInviteError(null);
      return;
    }

    const timer = setTimeout(() => {
      void api
        .validateInvite(code)
        .then((res) => {
          if (res.ok) {
            setAllowedEmail(res.allowedEmail);
            setInviteError(null);
          }
        })
        .catch((err) => {
          setAllowedEmail(null);
          setInviteError(err instanceof Error ? err.message : "초대코드를 확인할 수 없습니다.");
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [inviteCode]);

  const canSignup = Boolean(inviteCode.trim() && allowedEmail && !inviteError);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Own</h1>
            <p className="text-sm text-slate-500">초대코드로 가입</p>
          </div>
        </div>

        {(urlError || inviteError) && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {urlError ?? inviteError}
          </p>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-700">
              초대코드
            </label>
            <input
              id="code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full rounded-lg border border-surface-border px-3 py-2 text-sm uppercase outline-none focus:border-brand"
              placeholder="MYOWN-XXXXXXXX"
            />
            {allowedEmail && (
              <p className="mt-2 text-xs text-emerald-700">
                <strong>{allowedEmail}</strong> Google 계정으로만 가입할 수 있습니다.
              </p>
            )}
          </div>

          <GoogleSignInButton
            purpose="signup"
            inviteCode={inviteCode}
            label="Google로 가입"
            disabled={!canSignup}
          />

          <p className="text-xs text-slate-500">
            운영자는{" "}
            <a href={googleAuthUrl("signup")} className="font-medium text-brand hover:underline">
              초대코드 없이 Google 가입
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          이미 계정이 있나요?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
