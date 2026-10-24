import MarkdownIt from "markdown-it";
import pages from "./content.generated.json";
import { ComponentCatalog } from "./component-catalog";
import { GuideResources } from "./resources";
import { ComponentExamples } from "./examples";
const md = new MarkdownIt({ html: false, linkify: true });
export function Article({ slug }: { slug: string }) {
  const page = pages.find((p) => p.slug === slug)!;
  return (
    <div>
      <div className="docs-eyebrow">
        Wuff field guide · {slug === "overview" ? "Start here" : page.title}
      </div>
      {["overview", "prototyping", "handoff"].includes(slug) && (
        <GuideResources />
      )}
      {slug === "components" && (
        <a href="#component-catalog" className="docs-app-link">
          Jump to component search ↓
        </a>
      )}
      <article
        className="docs-article"
        dangerouslySetInnerHTML={{ __html: md.render(page.markdown) }}
      />
      {slug === "components" ? (
        <>
          <ComponentExamples />
          <ComponentCatalog />
        </>
      ) : null}
    </div>
  );
}
