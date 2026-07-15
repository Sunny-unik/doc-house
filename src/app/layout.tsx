import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/layout/Footer";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { siteConfig } from "@/config/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-canvas text-text" suppressHydrationWarning>
        {/* Both providers are client components, but `children` arrives as a
            prop — so the pages underneath still render on the server. */}
        <ToastProvider>
          <ConfirmProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-fg"
            >
              Skip to content
            </a>
            <OfflineBanner />
            <div className="flex flex-1 flex-col">{children}</div>
            <Footer />
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
