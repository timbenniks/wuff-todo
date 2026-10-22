import { StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { listThemeVariables } from "@wuff/design";
import waffles from "../../web/public/mascot/waffles-icon.webp";
import "./styles.css";

function App() {
  return (
    <main style={listThemeVariables("lavender") as CSSProperties}>
      <section className="welcome" aria-labelledby="welcome-title">
        <img src={waffles} alt="Waffles the corgi" width="144" height="144" />
        <p className="brand">Wuff Todo</p>
        <h1 id="welcome-title">Your pack, wherever you work.</h1>
        <p>One home for your lists and shared adventures.</p>
        <p className="preview">Development preview · Sign-in is coming next.</p>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
