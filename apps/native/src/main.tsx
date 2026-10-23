import { installNativeSocket } from "./native-socket";
import { Workspace, loadWorkspace, type WorkspaceData } from "./workspace";
import { Button } from "@wuff/ui/button";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { listThemeVariables } from "@wuff/design";
import { client, signIn, signOut, listenForSignIn } from "./session";
import "./styles.css";

function App() {
  const [lists, setLists] = useState<WorkspaceData | null>(null);
  const [busy, setBusy] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const report = useCallback(
    (error: unknown) =>
      setError(
        error instanceof Error
          ? error.message
          : "Could not complete this action. Please try again.",
      ),
    [],
  );
  const upgradeGithub = useCallback(async () => {
    setError("");
    await signIn(true);
  }, []);
  async function load() {
    const current = ++generation.current;
    setBusy(true);
    try {
      const result = await loadWorkspace();
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
      setHasSession(false);
      setBusy(false);
    };
    void (async () => {
      try {
        const restored = await client.restore();
        if (active) setHasSession(restored);
        if (restored && active) await load();
        if (!active) return;
        stop = await listenForSignIn(
          () => {
            setWaiting(false);
            setHasSession(true);
            setLists(null);
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
  const logout = useCallback(async () => {
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
  }, [report]);
  if (lists)
    return (
      <Workspace
        key={lists.userId + ":" + generation.current}
        data={lists}
        onSignOut={logout}
        onError={report}
        onGithubConsent={upgradeGithub}
        sessionError={error}
      />
    );
  return (
    <main
      className="login-screen"
      style={listThemeVariables("lavender") as CSSProperties}
    >
      <section className="welcome" aria-labelledby="welcome-title">
        <img
          src="/mascot/waffles-icon.webp"
          alt="Waffles the corgi"
          width="144"
          height="144"
        />
        <p className="brand">Wuff Todo</p>
        <h1 id="welcome-title">Your pack, wherever you work.</h1>
        {error && <p role="alert">{error}</p>}
        {error && hasSession && (
          <Button disabled={busy} onClick={() => void load()}>
            Retry loading lists
          </Button>
        )}
        {busy && <p role="status">Fetching your pack…</p>}
        {!isTauri() ? (
          <p>
            Open the installed Wuff app to sign in. This browser preview shows
            the bundled interface.
          </p>
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
