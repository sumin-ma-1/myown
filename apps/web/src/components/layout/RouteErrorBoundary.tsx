import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page render failed:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="space-y-3">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            페이지를 표시하지 못했습니다
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {this.state.error.message || "알 수 없는 오류"}
          </p>
          <button
            type="button"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
            onClick={() => this.setState({ error: null })}
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
