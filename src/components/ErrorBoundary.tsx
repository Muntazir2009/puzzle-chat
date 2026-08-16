"use client";

import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  stackTrace: string;
  componentStack: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, stackTrace: "", componentStack: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, stackTrace: "", componentStack: "" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({
      stackTrace: error.stack ?? "(no stack)",
      componentStack: info.componentStack ?? "(no component stack)",
    });
    console.error("[ErrorBoundary] Caught error:", error.message);
    console.error("[ErrorBoundary] Stack:", error.stack);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, stackTrace: "", componentStack: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackUI
          message={this.state.error?.message}
          stackTrace={this.state.stackTrace}
          componentStack={this.state.componentStack}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Separate function component so useState works for the copy button  */
/* ------------------------------------------------------------------ */

function ErrorFallbackUI({
  message,
  stackTrace,
  componentStack,
  onRetry,
}: {
  message?: string;
  stackTrace: string;
  componentStack: string;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const fullDebug = [
    `Error: ${message || "(unknown)"}`,
    "",
    "--- Stack ---",
    stackTrace,
    "",
    "--- Component Stack ---",
    componentStack,
  ].join("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(fullDebug).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-start gap-3 overflow-y-auto px-4 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertTriangle className="size-7 text-red-500" />
      </div>
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 max-w-[300px] text-xs leading-relaxed text-muted-foreground">
          {message || "An unexpected error occurred."}
        </p>
      </div>

      {/* Debug details - scrollable */
      <div className="w-full max-w-sm">
        <details className="text-left">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Debug info
          </summary>
          <pre className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-all font-mono">
            {fullDebug}
          </pre>
        </details>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-xs font-medium text-white shadow-md shadow-violet-500/20 transition-all hover:shadow-lg hover:shadow-violet-500/30 active:scale-95"
        >
          <RotateCcw className="size-3.5" />
          Try again
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
