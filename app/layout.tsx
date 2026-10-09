import type { Metadata } from "next";
import "./globals.css";
import "./entrance.css";
import "./readability.css";
import "./edge.css";
import "./chamber.css";
import Atmosphere from "@/components/atmosphere";

export const metadata: Metadata = {
  title: "Calypto — Ask what others won't answer",
  description:
    "Calypto is a private, uncensored AI. Ask anything, search the web, check a token before you buy and x-ray any wallet. Nothing kept unless you choose.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ background: "#151318", colorScheme: "dark" }}>
      <head>
        <meta name="theme-color" content="#151318" />
      </head>
      <body className="antialiased" style={{ background: "#151318" }}>
        <Atmosphere />
        {children}
      </body>
    </html>
  );
}
