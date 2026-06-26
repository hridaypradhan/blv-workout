import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { Suspense } from "react";
import NavigationProgress from "@/components/layout/NavigationProgress";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "FitA11y - Assistive Playback Companion for BLV Users",
  description: "An assistive companion for blind and low vision users that provides supplementary guidance (form correction, motivation, haptics) alongside original YouTube workouts.",
};

import { LayoutProvider } from "@/components/layout/LayoutContext";
import { UserProfileProvider } from "@/components/layout/UserProfileContext";
import { HapticStatusProvider } from "@/lib/hooks/useHapticDeviceStatus";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-slate-950 text-slate-100 min-h-screen`}
      >
        {/* Skip to Content Link for Keyboard & Screen Reader Users */}
        <a
          href="#main-content"
          className="absolute left-4 top-[-100px] z-50 bg-yellow-400 text-slate-950 px-4 py-2 rounded-md font-bold transition-all duration-300 focus:top-4 focus:outline focus:outline-2 focus:outline-slate-950"
          id="skip-to-content-link"
        >
          Skip to main content
        </a>

        {/* Layout container wrapped in providers */}
        <UserProfileProvider>
          <LayoutProvider>
            <HapticStatusProvider>
              <div className="relative min-h-screen">
                {/* Global Sidebar */}
                <Sidebar id="global-sidebar" />

                <Suspense fallback={null}>
                  <NavigationProgress />
                </Suspense>

                {/* Children views */}
                {children}
              </div>
            </HapticStatusProvider>
          </LayoutProvider>
        </UserProfileProvider>
      </body>
    </html>
  );
}
