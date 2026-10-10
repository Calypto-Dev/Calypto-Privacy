import EdgeHome from "@/components/edge-home";
import { runtime } from "@/lib/server";
import { isAddress } from "viem";

export const dynamic = "force-dynamic";

export default function Page() {
  return <EdgeHome tokenConfigured={isAddress(runtime().CALYPTO_TOKEN_ADDRESS || "")} />;
}
