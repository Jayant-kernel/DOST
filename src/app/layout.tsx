import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./voice.css";

export const metadata: Metadata = {
  title: "Dost — Your voice companion",
  description:
    "Saathi is a browser voice companion. Speak in Hindi, with simple English controls.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never block zoom. Pinch-to-zoom is how many elders read anything at all.
  maximumScale: 5,
  userScalable: true,
  themeColor: "#c2410c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
