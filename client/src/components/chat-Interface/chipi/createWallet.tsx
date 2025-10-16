// client/src/components/chat-Interface/starknet/createWallet.tsx
import { useRef, useState, useEffect } from "react";
import { CreateWalletResponse, useCreateWallet } from "@chipi-stack/chipi-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuth } from "@clerk/clerk-react";
import { ContentWithUser, CreateWalletInput, CreateWalletProps } from "@/components/chat-actions/plugin-chipi/types";


const log = (message: string, metadata: Record<string, any> = {}) => {
  console.log(`[CreateWallet] ${message}`, JSON.stringify(metadata, null, 2));
};

export function CreateWallet({ agentId, onClose }: CreateWalletProps) {
  const { createWalletAsync, data: walletResp, isLoading: hookLoading, error: hookError } = useCreateWallet();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isTransientError = (err: unknown): boolean => {
    const msg = String((err as any)?.message ?? "").toLowerCase();
    return /(rpc|timeout|429|network|gateway)/.test(msg);
  };

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const extractWalletAddress = (resp?: CreateWalletResponse): string | undefined =>
    resp?.walletPublicKey ?? resp?.wallet?.publicKey;

  const handleWalletCreation = async () => {
    if (submitting) return;
    if (!/^\d{4}$/.test(pin)) return toast({ variant: "destructive", title: "PIN must be 4 digits." });
    if (pin !== confirmPin) return toast({ variant: "destructive", title: "PINs do not match." });

    setSubmitting(true);
    try {
      const existingWallet = await apiClient.getWallet(agentId);
      if (existingWallet?.wallet) {
        toast({
          variant: "destructive",
          title: "Chipi Wallet Already Exists",
        });
        if (mountedRef.current) onClose(false);
        return;
      }

      const bearerToken = await getToken();
      if (!bearerToken) throw new Error("No session token available. Sign in again.");

      const input: CreateWalletInput = { params: { encryptKey: pin, externalUserId: agentId }, bearerToken };
      let response: CreateWalletResponse | null = null;

      // Retry loop with exponential backoff
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await createWalletAsync(input);
          break;
        } catch (err) {
          if (isTransientError(err) && attempt < 2) await sleep(Math.min(2000 * 2 ** attempt, 15000));
          else throw err;
        }
      }

      if (!response?.wallet) throw new Error("Wallet creation failed: no response from Chipi.");

      const walletAddress = extractWalletAddress(response);
      await apiClient.storeWallet(agentId, {
        txHash: response.txHash,
        publicKey: walletAddress ?? response.wallet.publicKey,
      });

      // Update messages and queries
      queryClient.setQueryData<ContentWithUser[]>(["messages", agentId], (old = []) => [
        ...old.filter((msg) => !msg.isLoading),
        {
          text: `✅ Wallet created!\nTX Hash: ${response.txHash}\nAddress: ${walletAddress}`,
          user: "system",
          createdAt: Date.now(),
          source: "CREATE_CHIPI_WALLET",
          metadata: { txHash: response.txHash, publicKey: walletAddress },
        },
      ]);

      queryClient.invalidateQueries({ queryKey: ["wallet", agentId] });
      queryClient.invalidateQueries({ queryKey: ["walletExists", agentId] });

      toast({
        title: "Chipi Wallet Created Successfully",
        description: walletAddress ? `Address: ${walletAddress}\nTX: ${response.txHash}` : `TX: ${response.txHash}`,
      });
    } catch (err: any) {
      const message = err?.message ?? "Unexpected error";
      log("Wallet creation failed", { error: message });
      toast({
        variant: "destructive",
        title: "Chipi Wallet Creation Failed",
        description: message,
      });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied to clipboard" }); }
    catch { toast({ title: "Copy failed" }); }
  };

  const walletAddress = extractWalletAddress(walletResp);

  return (
    <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
      <CardHeader><CardTitle>Create Chipi Wallet</CardTitle></CardHeader>
      <CardContent>
        {!walletResp ? (
          <>
            <label>PIN</label>
            <Input type="password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} />
            <label>Confirm PIN</label>
            <Input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} />
            {hookError && <div className="text-red-700">{hookError.message}</div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onClose(true)} disabled={submitting || hookLoading}>Cancel</Button>
              <Button onClick={handleWalletCreation} disabled={submitting || hookLoading || pin.length < 4 || pin !== confirmPin}>
                {submitting || hookLoading ? "Creating..." : "Create Wallet"}
              </Button>
            </div>
          </>
        ) : (
          <div className="mb-4 p-3 rounded bg-white/5 border border-white/5">
            <div className="flex justify-between mb-2">
              <div className="text-xs font-mono break-all">{walletAddress ?? "N/A"}</div>
              <div className="flex flex-col items-end gap-2">
                <a href={walletAddress ? `https://starkscan.co/contract/${walletAddress}` : "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:text-green-800">View Contract</a>
                <button onClick={() => handleCopy(walletAddress)} className="text-xs underline">Copy</button>
              </div>
            </div>
            <div className="text-xs font-mono break-all">{walletResp.txHash}</div>
            <div className="flex justify-end mt-4"><Button onClick={() => onClose(false)}>Done</Button></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
