import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Birthday Studio — Make their birthday feel unforgettable",
  description:
    "Birthday Studio turns a simple birthday wish into a personalized web experience. Add their name, your words and their favorite memories, then share a beautiful surprise page in one link.",
  applicationName: "Birthday Studio",
  openGraph: {
    title: "Birthday Studio — Make their birthday feel unforgettable",
    description:
      "Turn a simple birthday wish into a personalized web experience they will remember.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#04050d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-50 overflow-hidden"
        >
          <div className="bs-ambient" />
          <div className="bs-grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
