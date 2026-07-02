import { Link, useSearchParams } from "react-router-dom";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Own</h1>
            <p className="text-sm text-slate-500">로그인</p>
          </div>
        </div>

        {urlError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{urlError}</p>
        )}

        <GoogleSignInButton purpose="login" label="Google로 로그인" />

        <p className="mt-6 text-center text-sm text-slate-500">
          초대코드가 있나요?{" "}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            가입하기
          </Link>
        </p>
      </div>
    </div>
  );
}
