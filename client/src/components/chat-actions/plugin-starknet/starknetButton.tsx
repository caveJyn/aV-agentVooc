// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-Interface/starknet/starknetButton.tsx
import { useState, useEffect } from "react"; // Add useEffect
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { connect, disconnect } from "@starknet-io/get-starknet";
import { Button } from "@/components/ui/button";
import { ConnectStarknetWallet } from "./connectStarknetWallet";
import { Wallet } from "lucide-react";

interface StarknetButtonProps {
  agentId: string;
  onConnect?: (walletInfo: { id: string; name: string }) => void;
  onDisconnect?: () => void;
}

const log = (message: string, metadata: Record<string, any> = {}) => {
  console.log(`[StarknetButton] ${message}`, JSON.stringify(metadata, null, 2));
};

export function StarknetButton({
  agentId,
  onConnect,
  onDisconnect,
}: StarknetButtonProps) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    log("Modal state changed", { showModal });
  }, [showModal]);

  const { data: connected, isLoading } = useQuery<boolean>({
    queryKey: ["starknetConnection", agentId],
    queryFn: async () => {
      try {
        const starknet = await connect({ modalMode: "neverAsk" });
        if (!starknet) return false;

        let accounts: string[] = [];
        try {
          accounts = await starknet.request({ type: "wallet_requestAccounts" });
        } catch (err: any) {
          if (err.message === "Not implemented" && starknet.id === "braavos") {
            const braavos = (window as any).starknet_braavos;
            if (braavos?.enable) {
              const res = await braavos.enable({ starknetVersion: "v4" });
              accounts = res?.accounts || [];
            } else if (braavos?.request) {
              const res = await braavos.request({ type: "starknet_enable" });
              accounts = res?.accounts || [];
            }
          }
        }

        if (accounts?.length) {
          setWalletInfo({
            id: starknet.id,
            name: starknet.name,
          });
          onConnect?.({
            id: starknet.id,
            name: starknet.name,
          });
          return true;
        }

        return false;
      } catch {
        return false;
      }
    },
    enabled: !!agentId,
    staleTime: 5 * 60 * 1000,
  });

  const handleDisconnect = async () => {
    await disconnect({ clearLastWallet: true });
    setWalletInfo(null);
    onDisconnect?.();
    queryClient.invalidateQueries({ queryKey: ["starknetConnection", agentId] });
    log("Disconnected wallet");
  };

  return (
    <>
      {connected && walletInfo ? (
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{walletInfo.name} Connected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="ml-2"
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <Button
          onClick={() => {
            setShowModal(true);
            log("Opening modal");
          }}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? "Checking..." : "Connect Starknet Wallet"}
        </Button>
      )}

      {showModal && (
        <ConnectStarknetWallet
          agentId={agentId}
          onClose={(cancelled) => {
            setShowModal(false);
            log("Closing modal", { cancelled });
            if (!cancelled) {
              queryClient.invalidateQueries({
                queryKey: ["starknetConnection", agentId],
              });
            }
          }}
        />
      )}
    </>
  );
}