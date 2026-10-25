import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wuff Empire",
    short_name: "Wuff",
    description: "Your pack of apps, together in one private place.",
    id: "/",
    start_url: "/",
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
