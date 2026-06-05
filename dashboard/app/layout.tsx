import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Software Company AI Factory",
  description: "Command center for the multi-agent software company."
};

import { Toaster } from 'sileo';
import { SolarProvider } from '@solar-icons/react';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('company_theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `
          }}
        />
      </head>
      <body>
        <SolarProvider value={{ weight: "LineDuotone", size: 20 }}>
          {children}
          <Toaster position="top-center" />
        </SolarProvider>
      </body>
    </html>
  );
}
