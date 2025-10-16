import { useApprove, useGetWallet, WalletData, ApproveParams } from "@chipi-stack/chipi-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";

const VESU_CONTRACT = "0x037ae3f583c8d644b7556c93a04b83b52fa96159b2b0cbd83c14d3122aef80a2";
const DECIMALS = 6;
const MAX_PIN_ATTEMPTS = 3;

export function ApproveUSDC({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { approveAsync, isLoading: approveLoading } = useApprove();
  const { fetchWallet } = useGetWallet();
  const { getToken } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ pin: "", amount: "" });
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [pinAttempts, setPinAttempts] = useState(0);

  // 🔹 Fetch wallet once
  useEffect(() => {
    (async () => {
      try {
        setWalletLoading(true);
        const token = await getToken();
        if (!token) throw new Error("No session token available");

        const fetched = await fetchWallet({
          params: { externalUserId: agentId },
          getBearerToken: async () => token,
        });

        if (!fetched?.publicKey || !fetched?.encryptedPrivateKey) {
          throw new Error("Wallet missing required fields");
        }

        setWallet(fetched);
      } catch (err: any) {
        toast({
          variant: "destructive",
          title: "Wallet Fetch Failed",
          description: err.message,
        });
      } finally {
        setWalletLoading(false);
      }
    })();
  }, [agentId, getToken, fetchWallet, toast]);

  const handleInputChange = (field: "pin" | "amount") => (e: any) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const isFormValid = useMemo(() => {
    const pinValid = /^\d{4}$/.test(form.pin);
    const amountValid = parseFloat(form.amount) > 0;
    return wallet && pinValid && amountValid && !approveLoading && !walletLoading;
  }, [wallet, form, approveLoading, walletLoading]);

  const handleApprove = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!wallet) {
        toast({ title: "No Wallet Found", variant: "destructive" });
        return;
      }

      if (pinAttempts >= MAX_PIN_ATTEMPTS) {
        toast({
          variant: "destructive",
          title: "Too Many Attempts",
          description: "Please reset your PIN.",
        });
        return;
      }

      try {
        const token = await getToken();
        if (!token) throw new Error("No session token available");

        const params: ApproveParams = {
          encryptKey: form.pin,
          wallet,
          contractAddress: VESU_CONTRACT,
          spender: VESU_CONTRACT,
          amount: form.amount,
          decimals: DECIMALS,
        };

        const txHash = await approveAsync({ params, bearerToken: token });

        toast({
          title: "Approval Successful",
          description: `Tx: ${txHash}`,
        });
        onClose();
      } catch (err: any) {
        const msg = err.message || "Unknown error";
        if (msg.includes("Decryption failed")) setPinAttempts((p) => p + 1);
        toast({
          variant: "destructive",
          title: "Approval Failed",
          description: msg,
        });
      }
    },
    [wallet, form, pinAttempts, approveAsync, getToken, toast, onClose]
  );

  // 🔹 UI States
  if (walletLoading)
    return (
      <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
        <CardContent>Loading wallet...</CardContent>
      </Card>
    );

  if (!wallet)
    return (
      <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
        <CardHeader>
          <CardTitle>Wallet Not Found</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please create or restore your wallet to approve USDC.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={() => (window.location.href = "/wallet/setup")}>
              Set Up Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );

  // 🔹 Main form
  return (
    <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
      <CardHeader>
        <CardTitle>Approve USDC for VESU</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleApprove} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">PIN</label>
            <Input
              type="password"
              maxLength={4}
              placeholder="4-digit PIN"
              value={form.pin}
              onChange={handleInputChange("pin")}
              required
            />
            {pinAttempts > 0 && (
              <p className="text-sm text-red-500 mt-1">
                {MAX_PIN_ATTEMPTS - pinAttempts} attempts left
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-1">Amount (USDC)</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Enter amount"
              value={form.amount}
              onChange={handleInputChange("amount")}
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid}>
              {approveLoading ? "Approving..." : "Approve"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
