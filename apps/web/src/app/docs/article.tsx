import MarkdownIt from "markdown-it";
import pages from "./content.generated.json";
import catalog from "./catalog.generated.json";
import { ComponentExamples } from "./examples";
const md = new MarkdownIt({ html: false, linkify: true });
export function Article({ slug }: { slug: string }) {
  const page = pages.find((p) => p.slug === slug)!;
  return (
    <main>
      <div className="docs-eyebrow">
        Wuff field guide · {slug === "overview" ? "Start here" : page.title}
      </div>
      <article
        className="docs-article"
        dangerouslySetInnerHTML={{ __html: md.render(page.markdown) }}
      />
      {slug === "overview" || slug === "prototyping" ? (
        <aside className="docs-downloads" aria-label="Prototype resources">
          <h2>Give your agent the same starting point</h2>
          <p>
            Real UI source, a working starter and the rules that make it Wuff.
          </p>
          <div>
            <a
              className="wuff-button"
              data-variant="primary"
              href="/prototype-kit/wuff-prototype.zip"
              download
            >
              Download prototype kit
            </a>
            <a
              className="wuff-button"
              data-variant="outline"
              href="/prototype-kit/wuff-prototype-skill.zip"
              download
            >
              Download skill
            </a>
            <a href="/prototype-kit/SKILL.md">Read skill instructions</a>
          </div>
          <p className="docs-caption">
            Built from this deployment’s source ·{" "}
            <a href="/prototype-kit/source-manifest.json">File hashes</a> ·{" "}
            <a href="/docs/agent-context.md">Agent reference</a>
          </p>
        </aside>
      ) : null}
      {slug === "components" ? (
        <>
          <ComponentExamples />
          <section className="docs-catalog" aria-labelledby="catalog-heading">
            <h2 id="catalog-heading">Complete component inventory</h2>
            <p>
              {catalog.reduce(
                (total, item) => total + item.components.length,
                0,
              )}{" "}
              exported React components. Expand a module for the exact props
              signature. The archive also includes helpers, CSS, types and
              runtime interfaces.
            </p>
            {catalog.map((item) => (
              <details className="docs-source" key={item.source}>
                <summary>
                  {item.components.map((c) => c.name).join(", ")}
                </summary>
                <p>
                  <code>{item.module}</code>
                </p>
                <p className="docs-caption">{item.source}</p>
                {item.components.map((component) => (
                  <pre key={component.name}>
                    <code>{component.signature}</code>
                  </pre>
                ))}
              </details>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
