import type { Metadata } from "next";
import TargetMode from "../components/target-mode/TargetMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "TikTok & Instagram Scraper & Transcript Tool",
  description: "Ferramenta local de pesquisa — extraia dados e transcrições de canais do TikTok e Instagram Reels",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <TargetMode />
      </body>
    </html>
  );
}
