// packages/plugin-chipi-client/src/ui/createWalletModal.tsx
"use client";
import { useState, useEffect, useRef } from "react";
import { ChipiPayClient } from "../client/chipiPayClient";
import { ChipiProvider } from "@chipi-stack/chipi-react";
import { useAuth } from "@clerk/clerk-react";

const logger = {
  info: (msg: string, meta?: any) => console.log(msg, meta),
  error: (msg: string, error?: any) => console.error(msg, error),
};

interface CreateWalletProps {
  agentId: string;
  onClose: (cancelled?: boolean) => void;
  apiPublicKey: string;
}

interface Wallet {
  publicKey: string;
  txHash?: string;
  createdAt: string;
}

export function CreateWalletModal({ agentId, onClose, apiPublicKey }: CreateWalletProps) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const chipiClientRef = useRef<ChipiPayClient | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    mountedRef.current = true;
    logger.info("[CreateWallet] Component mounted", { agentId });

    (async () => {
      try {
        if (!apiPublicKey) {
          throw new Error("VITE_CHIPI_PUBLIC_API_KEY not configured");
        }

        chipiClientRef.current = new ChipiPayClient({ apiPublicKey });
        await chipiClientRef.current.start();
        logger.info("[CreateWallet] ChipiPayClient initialized");
      } catch (err: any) {
        logger.error("[CreateWallet] Initialization failed", err);
        setError("Failed to initialize wallet client: " + err.message);
      }
    })();

    return () => {
      mountedRef.current = false;
      logger.info("[CreateWallet] Component unmounted");
    };
  }, [agentId, apiPublicKey]);

  const handleWalletCreation = async () => {
    if (submitting) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      if (!chipiClientRef.current) throw new Error("Chipi client not initialized");
      const token = await getToken();
      if (!token) throw new Error("Missing Clerk session token");

      const response = await chipiClientRef.current.createWallet(pin, agentId);
      if (!response) throw new Error("Wallet creation failed");

      if (mountedRef.current) {
        setWallet({
          publicKey: response.walletPublicKey,
          txHash: response.txHash,
          createdAt: new Date().toISOString(),
        });
        logger.info("[CreateWallet] Wallet created", {
          publicKey: response.walletPublicKey,
          txHash: response.txHash,
        });

        // Send success message to backend
        await fetch(`/api/${agentId}/message`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            message: `Your Chipi wallet was successfully created. Your txHash is "${response.txHash}" and your publicKey is "${response.walletPublicKey}".`,
            metadata: {
              action: "CREATE_CHIPI_WALLET",
              txHash: response.txHash,
              publicKey: response.walletPublicKey,
            },
          }),
        });

        onClose(false); // Close modal on success
      }
    } catch (err: any) {
      logger.error("[CreateWallet] Wallet creation failed", err);
      setError(err.message || "Unexpected error");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleCopy = (text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => alert("Copy failed"));
  };

  if (!apiPublicKey) {
    return <div>Error: VITE_CHIPI_PUBLIC_API_KEY not configured</div>;
  }

  return (
    <ChipiProvider config={{ apiPublicKey }}>
      <div style={{ padding: 20, border: "1px solid #ccc", borderRadius: 8, maxWidth: 400, background: "white" }}>
        <h3>Create Chipi Wallet</h3>
        {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}
        {wallet ? (
          <>
            <div><strong>Public Key:</strong> {wallet.publicKey}</div>
            {wallet.txHash && <div><strong>Tx Hash:</strong> {wallet.txHash}</div>}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => handleCopy(wallet.publicKey)}>Copy Public Key</button>
              {wallet.txHash && (
                <button onClick={() => handleCopy(wallet.txHash)} style={{ marginLeft: 5 }}>
                  Copy Tx Hash
                </button>
              )}
            </div>
            <button style={{ marginTop: 10 }} onClick={() => onClose(false)}>Done</button>
          </>
        ) : (
          <>
            <div>
              <label>PIN (4 digits)</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </div>
            <div>
              <label>Confirm PIN</label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                maxLength={4}
              />
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => onClose(true)} disabled={submitting}>Cancel</button>
              <button
                onClick={handleWalletCreation}
                disabled={submitting || pin.length < 4 || pin !== confirmPin}
                style={{ marginLeft: 5 }}
              >
                {submitting ? "Creating..." : "Create Wallet"}
              </button>
            </div>
          </>
        )}
      </div>
    </ChipiProvider>
  );
}