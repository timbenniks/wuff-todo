import type { Metadata } from "next";
import localFont from "next/font/local";
import { appOrigin } from "@/lib/config";
import "./globals.css";
const dmSans = localFont({
  src: [
    { path: "../fonts/dm-sans.ttf", weight: "100 1000", style: "normal" },
    {
      path: "../fonts/dm-sans-italic.ttf",
      weight: "100 1000",
      style: "italic",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});
export const metadata: Metadata = {
  metadataBase: new URL(appOrigin()),
  applicationName: "Wuff Empire",
  title: "Wuff Empire",
  description: "Your pack of apps, together in one private place.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/app-180.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    title: "Wuff Empire",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "Wuff Empire",
    title: "Wuff Empire",
    description: "Your pack of apps, together in one private place.",
    images: [
      {
        url: "/icons/share.png",
        width: 1200,
        height: 630,
        alt: "Waffles the corgi — Wuff Empire",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Wuff Empire",
    description: "Your pack of apps, together in one private place.",
    images: ["/icons/share.png"],
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
