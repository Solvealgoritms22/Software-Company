import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Software Company AI Factory",
  description: "Command center for the multi-agent software company."
};

import { Toaster } from 'sileo';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/splash_dark.png" as="image" />
        <link rel="preload" href="/splash_light.png" as="image" />
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
        <div id="initial-splash-screen">
          <style dangerouslySetInnerHTML={{ __html: `
            #initial-splash-screen {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              z-index: 99999;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #000000;
              transition: opacity 0.5s ease-in-out;
            }
            html:not(.dark) #initial-splash-screen {
              background-color: #ffffff;
            }
            #initial-splash-screen img {
              width: auto;
              height: auto;
              max-width: 30%;
              max-height: 30%;
              object-fit: contain;
            }
            .dark-splash { display: block; }
            .light-splash { display: none; }
            html:not(.dark) .dark-splash { display: none; }
            html:not(.dark) .light-splash { display: block; }
          `}} />
          <img src="/splash_dark.png" className="dark-splash" alt="Loading..." />
          <img src="/splash_light.png" className="light-splash" alt="Loading..." />
        </div>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
