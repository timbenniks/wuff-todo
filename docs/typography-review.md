# Typography review

October 17, 2026. DM Sans selected by the user and implemented locally across web and MCP. The original comparison below preserves the candidate evaluation.

The web currently pairs Avenir Next/Segoe UI body text with Trebuchet MS headings. MCP uses system-ui. These platform-dependent families create inconsistent letterforms across surfaces.

Initial recommendation before user selection: Plus Jakarta Sans throughout web and MCP, with body 400, controls and status labels 600, and major headings 700. Keep the implemented spacing and type-size hierarchy; use modest heading tracking rather than applying the existing -0.035em indiscriminately. Its expressive geometric forms suit Wuff's friendly companion identity. It runs slightly wider in this specimen; long task names and dense controls need a fresh app-level wrapping review if adopted.

DM Sans is the alternative for a quieter, more compact interface. The specimen compares the current pairing and both alternatives with identical layout and common text sizes/weights. Current heading tracking is retained; alternatives use -0.025em for h1 and -0.015em for h2. This is a visual design judgment, not a readability study.

UI/UX Pro Max's typography query `friendly productivity readable sans` returned Friendly SaaS (Plus Jakarta Sans for both heading and body), an applicable match for this productivity app. Its other results were language-specific or Material Design-specific and were not adopted.

Sources: [Plus Jakarta Sans upstream](https://github.com/tokotype/PlusJakartaSans), [DM Sans distribution](https://github.com/google/fonts/tree/main/ofl/dmsans). Upright variable files were obtained from the Google Fonts repository and embedded in the self-contained specimen; both distribution OFL files are adjacent. These are preview assets, not production font delivery. For adoption, self-host matching web and standalone MCP assets and include real italics for rich-text notes.

[Open the comparison](font-comparison.html) or [view the rendered comparison](screenshots/font-comparison-desktop.png). Chrome rendered both embedded fonts successfully. The static specimen was visually inspected at 1440px and measured without horizontal document overflow at 320px and 390px. These checks do not verify a font replacement in the application or a deployed client.

## Selected implementation

The user chose DM Sans. The root web layout now uses next/font/local with upright and italic variable files; body, headings, controls and prose inherit the same family. Code blocks retain monospace. Major headings use -0.025em tracking and h2 uses -0.015em. The standalone MCP build embeds those exact files as data URLs, preserving its existing external-resource policy. The OFL license and provenance live beside the source font files. No package dependency or theme behavior changed.

Production build and workspace typecheck passed. Local Chrome checks against the optimized web build confirmed DM Sans loaded for body/headings and real italic loading; a synthetic list fit 320px and 390px without horizontal document overflow. The MCP SDK test host loaded the same font, and a direct standalone resource check confirmed its italic face loads. Desktop web and MCP screenshots were captured; the phone screenshot was visually inspected. This is local rendering proof, not deployed or physical-device validation.

Evidence: [web](screenshots/dm-sans-web.png), [phone](screenshots/dm-sans-phone.png), [MCP](screenshots/dm-sans-mcp.png).
