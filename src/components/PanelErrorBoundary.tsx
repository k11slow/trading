"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";

export class PanelErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development")
      console.error(`${this.props.name} panel failed`, error, info);
  }
  render() {
    return this.state.failed ? (
      <section className="grid min-h-32 flex-1 place-items-center border border-red-500/20 bg-[#0c0f14] p-5 text-center text-[10px] text-red-300">
        {this.props.name} is temporarily unavailable. The rest of the terminal
        is still active.
      </section>
    ) : (
      this.props.children
    );
  }
}
