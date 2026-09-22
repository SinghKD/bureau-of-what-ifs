import type { Metadata, Viewport } from "next";
import { Journey } from "@/components/Journey";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bureau of What Ifs",
  description: "Out there in the multiverse, you're living all the lives you almost chose.",
};

export const viewport: Viewport = {
  themeColor: "#0b0a10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* above the routes, so answers and results survive a navigation */}
      <body>
        <Journey>{children}</Journey>
      </body>
    </html>
  );
}
