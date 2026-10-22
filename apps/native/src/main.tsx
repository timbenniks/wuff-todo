import { installNativeSocket } from "./native-socket";
import { NativeLive } from "./live";
import { Button } from "@wuff/ui/button";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { listThemeVariables } from "@wuff/design";
import type { ListSummary } from "@wuff/contracts";
import { client, signIn, signOut, listenForSignIn } from "./session";
import waffles from "../../web/public/mascot/waffles-icon.webp";
import "./styles.css";

function App() {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const report = (error: unknown) =>
    setError(
      error instanceof Error
        ? error.message
        : "Could not complete this action. Please try again.",
    );
  async function load() {
    const current = ++generation.current;
    setBusy(true);
    try {
      const result = await client.lists();
      if (current === generation.current) setLists(result);
    } catch (error) {
      if (current === generation.current) report(error);
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!isTauri()) {
      setBusy(false);
      return;
    }
    let active = true;
    let stop: (() => void) | undefined;
    client.onSignedOut = () => {
      generation.current++;
      setLists(null);
      setBusy(false);
    };
    void (async () => {
      try {
        if ((await client.restore()) && active) await load();
        if (!active) return;
        stop = await listenForSignIn(
          () => {
            setWaiting(false);
            setError("");
            void load();
          },
          (error) => {
            setWaiting(false);
            report(error);
          },
        );
        if (!active) stop();
      } catch (error) {
        if (active) report(error);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
      generation.current++;
      stop?.();
      client.onSignedOut = () => {};
    };
  }, []);
  async function login() {
    setError("");
    setWaiting(true);
    try {
      await signIn();
    } catch (error) {
      setWaiting(false);
      report(error);
    }
  }
  async function logout() {
    setWaiting(false);
    setError("");
    setBusy(true);
    try {
      await signOut();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main style={listThemeVariables("lavender") as CSSProperties}>
      <section className="welcome" aria-labelledby="welcome-title">
        <img src={waffles} alt="Waffles the corgi" width="144" height="144" />
        <p className="brand">Wuff Todo</p>
        <h1 id="welcome-title">
          {lists ? "Your lists" : "Your pack, wherever you work."}
        </h1>
        {error && <p role="alert">{error}</p>}
        {busy && <p role="status">Fetching your pack…</p>}
        {!isTauri() ? (
          <p>
            Open the installed Wuff app to sign in. This browser preview shows
            the bundled interface.
          </p>
        ) : lists ? (
          <>
            <NativeLive refresh={load} />
            <ul className="lists">
              {lists.map((list) => (
                <li key={list.id}>{list.title}</li>
              ))}
            </ul>
            {!lists.length && <p>Your pack has no lists yet.</p>}
            <p>List editing is coming in the next development milestone.</p>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void load()}
            >
              Refresh
            </Button>{" "}
            <Button variant="primary" onClick={() => void logout()}>
              Sign out
            </Button>
          </>
        ) : waiting ? (
          <>
            <p role="status">
              Finish signing in in your browser, then return to Wuff.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                void signOut()
                  .then(() => setWaiting(false))
                  .catch(report);
              }}
            >
              Cancel sign-in
            </Button>
          </>
        ) : (
          <>
            <p>One home for your lists and shared adventures.</p>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void login()}
            >
              Sign in with your browser
            </Button>
            <p className="preview">
              Invite-only · Your session is saved in this device’s credential
              store.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
installNativeSocket();
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(<App />);
