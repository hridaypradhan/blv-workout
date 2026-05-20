"use client";

import Header from "./Header";

interface PageWrapperProps {
  children: React.ReactNode;
  id?: string;
}

export default function PageWrapper({ children, id = "main-wrapper" }: PageWrapperProps) {
  return (
    <div id={id} className="min-h-screen pl-0 md:pl-64 bg-slate-950 text-slate-100 flex flex-col">
      {/* Header component */}
      <Header id="main-header" />

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 p-4 sm:p-6 md:p-8 outline-none focus:ring-0"
      >
        <div className="max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
