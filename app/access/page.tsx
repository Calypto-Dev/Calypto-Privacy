import { AccessPage } from "@/components/edge-pages";
import { runtime } from "@/lib/server";
import { isAddress } from "viem";

export const metadata = { title: "$CALYPTO — Calypto" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <AccessPage tokenConfigured={isAddress(runtime().CALYPTO_TOKEN_ADDRESS || "")} />;
}
