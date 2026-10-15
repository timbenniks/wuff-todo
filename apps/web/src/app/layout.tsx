import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Wuff Todo",
  description:
    "A little less to remember. Private lists for you and your people.",
  robots: { index: false, follow: false },
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
