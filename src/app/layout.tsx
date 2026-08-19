import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LazyMotion, domAnimation } from "framer-motion";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

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
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://njtdajospdunfbfgyymh.supabase.co"} />
        <link rel="preconnect" href="https://ws-ap2.pusher.com" />
        <link rel="preconnect" href="https://sockjs-ap2.pusher.com" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://njtdajospdunfbfgyymh.supabase.co"} />
        <link rel="dns-prefetch" href="https://ws-ap2.pusher.com" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <LazyMotion features={domAnimation} strict>
          {children}
        </LazyMotion>
        <Toaster />
      </body>
    </html>
  );
}
