import { redirect } from "next/navigation";

// Vault-first: the private trading vault is the product. Swap/faucet live at /trade.
export default function Home() {
  redirect("/vault");
}
