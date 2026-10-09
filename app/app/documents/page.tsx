import Workspace from "@/components/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace — Calypto" };
export default function Page() {
  // Documents was retired; old links land in Ask.
  return <Workspace initialMode="chat" />;
}
