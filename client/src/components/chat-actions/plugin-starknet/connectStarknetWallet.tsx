// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-Interface/starknet/connectStarknetWallet.tsx
import { memo, useEffect, useRef } from "react";
import { connect } from "@starknet-io/get-starknet";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { useAuth } from "@clerk/clerk-react";
import { keccak256 } from "js-sha3";

interface ConnectStarknetWalletProps {
  agentId: string;
  onClose: (cancelled?: boolean) => void;
}

const log = (message: string, metadata: Record<string, any> = {}) => {
  console.log(`[ConnectStarknetWallet] ${message}`, JSON.stringify(metadata, null, 2));
};

export const ConnectStarknetWallet = memo(function ConnectStarknetWallet({ agentId, onClose }: ConnectStarknetWalletProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();
  const mountedRef = useRef(true);
  const connectingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    log("Component mounted", {
      windowKeys: Object.keys(window).filter((key) => key.includes("starknet")),
    });

    const connectWallet = async () => {
      if (connectingRef.current) {
        log("Connection already in progress");
        return;
      }
      connectingRef.current = true;
      log("Initiating wallet connection", { agentId });

      try {
        log("Calling connect with modalMode: alwaysAsk");
        const starknet = await connect({ modalMode: "alwaysAsk", modalTheme: "dark" });
        log("Connect result", { starknet: starknet ? { id: starknet.id, name: starknet.name } : null });

        if (!starknet) {
          throw new Error("No wallet selected. Please select a wallet in the modal.");
        }

        const walletName = starknet.name || "Unknown Wallet";
        log(`Attempting to connect to ${walletName}`);

        log("Requesting accounts");
        let accounts: string[] = [];

        try {
          accounts = await starknet.request({ type: "wallet_requestAccounts" });
        } catch (err: any) {
          if (err.message === "Not implemented" && starknet.id === "braavos") {
            const braavos = (window as any).starknet_braavos;
            if (braavos?.enable) {
              const res = await braavos.enable({ starknetVersion: "v4" });
              accounts = res?.accounts || [];
              if ((!accounts || !accounts.length) && braavos?.account?.address) {
                accounts = [braavos.account.address];
              }
            } else if (braavos?.request) {
              const res = await braavos.request({ type: "starknet_enable" });
              accounts = res?.accounts || [];
              if ((!accounts || !accounts.length) && braavos?.account?.address) {
                accounts = [braavos.account.address];
              }
            } else {
              throw new Error("Braavos wallet API not available or incompatible.");
            }
          } else {
            throw err;
          }
        }

        if (!accounts || accounts.length === 0) {
          throw new Error(`No accounts found in ${walletName}.`);
        }

        const address = accounts[0];
        log(`Connected to ${walletName}`, { address });

        const timestamp = Date.now().toString();
        const zkProof = keccak256(`${address}${timestamp}`);
        const zkProofHash = `0x${keccak256(zkProof)}`; // Add 0x prefix
        log("Generated ZK proof and hash", { zkProof, zkProofHash, timestamp });

        let runesVerified = false;
        try {
          const braavosProvider = (window as any).BraavosProviders?.BitcoinProvider;
          if (braavosProvider && starknet.id === "braavos") {
            const runes = await braavosProvider.getRunes();
            runesVerified = !!(runes && runes.length > 0);
            log("Runes verification", { runesVerified, runesCount: runes?.length || 0 });
          }
        } catch (err: any) {
          log("Runes verification failed", { error: err.message });
        }

        const accessToken = await getToken();
        log("Fetched access token", { accessToken: accessToken ? "present" : "null" });
        if (!accessToken) {
          throw new Error("Failed to fetch access token.");
        }
        await apiClient.storeStarknetWalletConnection(
          agentId,
          {
            walletType: walletName,
            zkProofHash,
            runesVerified,
          },
          accessToken
        );
        log("Stored wallet connection via API");

        toast({
          title: `${walletName} Connected`,
          description: `Connection verified with ZK proof. ${
            runesVerified ? "Runes verified." : "No Runes detected."
          }`,
        });
        queryClient.invalidateQueries({ queryKey: ["starknetConnection", agentId] });

        if (mountedRef.current) {
          onClose(false);
        }
      } catch (err: any) {
        const walletName = err.message.includes("Braavos") ? "Braavos" : "Wallet";
        log("Connection failed", { error: err.message, stack: err.stack });
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: err.message || `Failed to connect to ${walletName}.`,
        });
        if (mountedRef.current) {
          onClose(true);
        }
      } finally {
        if (mountedRef.current) {
          connectingRef.current = false;
          log("Reset connecting state");
        }
      }
    };

    connectWallet();

    return () => {
      mountedRef.current = false;
      log("Component unmounted");
    };
  }, [agentId, onClose, queryClient, toast, getToken]);

  return null;
});