import type { Metadata } from "next";
import { appOrigin } from "@/lib/config";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  applicationName: "Wuff Todo",
  title: "Wuff Todo",
  description:
    "A little less to remember. Private lists for you and your people.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/app-180.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: { capable: true, title: "Wuff Todo", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    siteName: "Wuff Todo",
    title: "Wuff Todo",
    description:
      "A little less to remember. Private lists for you and your people.",
    images: [
      {
        url: "/icons/share.png",
        width: 1200,
        height: 630,
        alt: "Waffles the corgi — Wuff Todo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wuff Todo",
    description:
      "A little less to remember. Private lists for you and your people.",
    images: ["/icons/share.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
