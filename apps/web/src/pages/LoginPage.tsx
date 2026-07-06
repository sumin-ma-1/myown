import { Link, useSearchParams } from "react-router-dom";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { PAGE_BG_CLASS } from "@/lib/pageBackground";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const urlError = searchParams.get("error");

  return (
    <div className={`relative flex min-h-screen items-center justify-center p-4 ${PAGE_BG_CLASS}`}>
      <ThemeToggleButton className="absolute right-4 top-4" />
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Own</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">로그인</p>
          </div>
        </div>

        {urlError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            {urlError}
          </p>
        )}

        <GoogleSignInButton purpose="login" label="Google로 로그인" />

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          초대코드가 있나요?{" "}
          <Link to="/signup" className="font-medium text-brand hover:underline">
            가입하기
          </Link>
        </p>
      </div>
    </div>
  );
}
