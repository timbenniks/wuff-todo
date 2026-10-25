"use client";
import React, { Component, Suspense, type ReactNode } from "react";
import { Button } from "@wuff/ui/button";
/** Each contribution owns its loading/error state; a broken chunk cannot hide other apps. */
export class ModuleDashboardSlot extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section role="alert" className="empire-state">
          <p>Could not open your {this.props.name} dashboard.</p>
          <Button onClick={() => window.location.reload()}>
            Reload dashboard
          </Button>
        </section>
      );
    return (
      <Suspense
        fallback={
          <p role="status">Fetching your {this.props.name} overview…</p>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
