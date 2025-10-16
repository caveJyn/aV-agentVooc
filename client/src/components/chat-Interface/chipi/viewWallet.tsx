// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-Interface/chipi/viewWallet.tsx
import { useGetWallet, WalletData } from '@chipi-stack/chipi-react';
import { useEffect, useCallback, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@clerk/clerk-react';

interface ViewWalletProps {
  agentId: string;
  onClose: () => void;
}

const MAX_WALLET_FETCH_RETRIES = 3;

export function ViewWallet({ agentId, onClose }: ViewWalletProps) {
  const { fetchWallet, isLoading: walletLoading, error: walletError } = useGetWallet();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();
  const { getToken } = useAuth();

  const fetchWalletData = useCallback(async () => {
    if (retryCount >= MAX_WALLET_FETCH_RETRIES) return;

    if (!agentId) {
      setFetchError('No valid agent ID provided.');
      toast({
        variant: 'destructive',
        title: 'Invalid Agent ID',
      });
      return;
    }

    try {
      const accessToken = await getToken();
      if (!accessToken) throw new Error('No session token available');

      const fetchedWallet = await fetchWallet({
        params: { externalUserId: agentId },
        getBearerToken: async () => accessToken,
      });

      if (!fetchedWallet?.publicKey || !fetchedWallet?.encryptedPrivateKey) {
        throw new Error('Wallet missing publicKey or encryptedPrivateKey');
      }

      setWallet(fetchedWallet);
      setFetchError(null);
      toast({ title: 'Wallet Loaded', description: 'Successfully retrieved wallet.' });
    } catch (err: any) {
      setFetchError(err.message || 'Could not fetch wallet.');
      setWallet(null);
      setRetryCount((prev) => prev + 1);
      toast({ variant: 'destructive', title: 'Fetch Failed', description: err.message });
    }
  }, [agentId, fetchWallet, getToken, toast]);

  // Only fetch on mount or when agentId changes
  useEffect(() => {
    fetchWalletData();
  }, [agentId]); // removed retryCount to avoid infinite loop

  // Render logic remains the same
  if (walletLoading) return <CardContent>Loading...</CardContent>;
  if (walletError || !wallet || fetchError) return (
    <Card>
      <CardHeader><CardTitle>Wallet Setup Required</CardTitle></CardHeader>
      <CardContent>
        <p>{fetchError || 'No wallet found. Please set up or wait.'}</p>
        <Button onClick={fetchWalletData} disabled={retryCount >= MAX_WALLET_FETCH_RETRIES}>
          Retry ({MAX_WALLET_FETCH_RETRIES - retryCount} left)
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader><CardTitle>Wallet Info</CardTitle></CardHeader>
      <CardContent>
        <p>Public Key: {wallet.publicKey}</p>
        <p>Encrypted Key: {wallet.encryptedPrivateKey.substring(0, 20)}...</p>
        <Button onClick={onClose}>Close</Button>
      </CardContent>
    </Card>
  );
}
