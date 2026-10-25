"use client";
import { ModuleDashboardSlot } from "./module-dashboard-slot";
import { ArrowRight } from "lucide-react";
import { Button } from "@wuff/ui/button";
import { empireModules, empireAppPreference } from "@wuff/contracts";
import { useEmpirePreferences } from "./empire-preferences";
import { moduleUi, type ModuleUi } from "@/modules/ui";
import { Corgi } from "./corgi";
export function EmpireDashboard() {
  const preferences = useEmpirePreferences();
  return (
    <main id="empire-content" className="empire-page empire-dashboard">
      <header className="empire-welcome">
        <div>
          <p className="empire-eyebrow">Your pack. One place.</p>
          <h1>
            {preferences.name
              ? `Welcome back, ${preferences.name}.`
              : "Welcome to Wuff Empire."}
          </h1>
          <p>A little less to remember. A little more room for life.</p>
        </div>
        <Corgi size={112} />
      </header>
      <section className="empire-apps" aria-labelledby="empire-apps-title">
        <h2 id="empire-apps-title">Your apps</h2>
        <div className="empire-app-grid">
          {empireModules
            .filter(
              (app) =>
                preferences.settings &&
                empireAppPreference(preferences.settings.apps, app.id).visible,
            )
            .map((app) => (
              <a className="empire-app-card" href={app.href} key={app.id}>
                <span className="empire-app-icon" aria-hidden="true">
                  {(() => {
                    const Icon = moduleUi[app.id].icon;
                    return <Icon size={28} />;
                  })()}
                </span>
                <div>
                  <h3>{app.name}</h3>
                  <p>{app.description}</p>
                  <span className="empire-app-action">
                    {app.status === "available" ? "Open app" : "Coming soon"}
                    <ArrowRight size={18} aria-hidden="true" />
                  </span>
                </div>
              </a>
            ))}
        </div>
        {!preferences.settings && (
          <p role="status">
            {preferences.error || "Fetching your app choices…"}
          </p>
        )}
        {preferences.error && (
          <Button onClick={() => void preferences.refresh()}>
            Retry app choices
          </Button>
        )}
        {preferences.settings &&
          empireModules.every(
            (app) =>
              !empireAppPreference(preferences.settings!.apps, app.id).visible,
          ) && (
            <p className="empire-state">
              Your apps are hidden.{" "}
              <a className="empire-text-link" href="/settings/apps">
                Choose your apps
              </a>
            </p>
          )}
      </section>

      {preferences.settings &&
        [...empireModules]
          .reverse()
          .filter((module) => {
            const choice = empireAppPreference(
              preferences.settings!.apps,
              module.id,
            );
            return choice.visible && choice.dashboard;
          })
          .flatMap((module) =>
            module.dashboard.map((widget) => {
              const Widget = (moduleUi[module.id] as ModuleUi).dashboard[
                widget.id
              ];
              return (
                <ModuleDashboardSlot
                  key={preferences.settings!.userId + ":" + widget.id}
                  name={module.name}
                >
                  <Widget userId={preferences.settings!.userId} />
                </ModuleDashboardSlot>
              );
            }),
          )}
    </main>
  );
}
