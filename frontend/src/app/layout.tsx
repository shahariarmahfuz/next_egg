import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = {
  title: {
    default: "Akota Poultry",
    template: "%s | Akota Poultry",
  },
  description:
    "Akota Poultry business, inventory, sales, farm production, and cash management portal.",
  keywords: ["Akota Poultry", "Poultry Management", "Egg Trading", "Inventory", "Cash Book"],
  authors: [{ name: "Akota Poultry" }],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@8..144,100..1000&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
