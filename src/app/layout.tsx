import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LazyMotion, domMax } from "framer-motion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Puzzle – Direct Messages",
  description: "Fast, real-time 1-on-1 messaging.",
  keywords: ["Puzzle", "chat", "messaging", "Next.js", "real-time"],
  authors: [{ name: "Puzzle Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Puzzle",
    description: "Fast, real-time 1-on-1 messaging.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Puzzle",
    description: "Fast, real-time 1-on-1 messaging.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <LazyMotion features={domMax} strict>
          {children}
        </LazyMotion>
        <Toaster />
      </body>
    </html>
  );
}
