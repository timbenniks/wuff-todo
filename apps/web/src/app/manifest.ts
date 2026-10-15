import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wuff Todo",
    short_name: "Wuff",
    description:
      "A little less to remember. Private lists for you and your people.",
    id: "/",
    start_url: "/lists",
    scope: "/",
    display: "standalone",
    background_color: "#f7fafc",
    theme_color: "#e7f0f8",
    icons: [
      {
        src: "/icons/app-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/app-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
