import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session";
import { ProjectProvider } from "@/lib/project";

export const metadata: Metadata = {
  title: "nandex",
  description: "Connect your apps, import their data, and query it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <ProjectProvider>{children}</ProjectProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
