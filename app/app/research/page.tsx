import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Ask with web search — Calypto" };
export default function Page() {
  // Research is no longer its own mode: it opens Ask with web search switched on.
  return <Workspace initialMode="chat" initialWeb />;
}
