// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-Interface/starknet/stakeVesuUSDC.tsx
import { useStakeVesuUsdc, useGetWallet, WalletData } from '@chipi-stack/chipi-react';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@clerk/clerk-react';

interface StakeVesuUSDCProps {
  agentId: string;
  onClose: () => void;
}

const MAX_WALLET_FETCH_RETRIES = 3;

export function StakeVesuUSDC({ agentId, onClose }: StakeVesuUSDCProps) {
  const { stakeVesuUsdcAsync, isLoading: stakeLoading, error: stakeError } = useStakeVesuUsdc();
  const { fetchWallet, isLoading: walletLoading, error: walletError } = useGetWallet();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [form, setForm] = useState({ pin: '', amount: '', receiverWallet: '' });
  const [retryCount, setRetryCount] = useState(0);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();
  const { getToken } = useAuth();

  const fetchWalletData = useCallback(async () => {
    if (retryCount >= MAX_WALLET_FETCH_RETRIES) {
      setFetchError('Maximum retry attempts reached. Please set up your wallet.');
      toast({
        variant: 'destructive',
        title: 'Wallet Fetch Failed',
        description: 'Maximum retry attempts reached. Please set up a wallet.',
      });
      return;
    }

    if (!agentId) {
      setFetchError('No valid agent ID provided.');
      toast({
        variant: 'destructive',
        title: 'Invalid Agent ID',
        description: 'No valid agent ID provided.',
      });
      return;
    }

    try {
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error('No session token available');
      }

      const fetchedWallet = await fetchWallet({ params: { externalUserId: agentId }, getBearerToken: async () => accessToken });
      if (!fetchedWallet?.publicKey || !fetchedWallet?.encryptedPrivateKey) {
        throw new Error('Wallet missing required fields: publicKey or encryptedPrivateKey');
      }

      setWallet(fetchedWallet);
      setFetchError(null);
    } catch (err: any) {
      setFetchError(err.message || 'Could not fetch wallet.');
      setWallet(null);
      setRetryCount((prev) => prev + 1);
      toast({
        variant: 'destructive',
        title: 'Wallet Fetch Failed',
        description: err.message || 'Could not fetch wallet.',
      });
    }
  }, [agentId, getToken, fetchWallet, toast, retryCount]);

  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      fetchWalletData();
    }

    return () => {
      isMounted = false;
    };
  }, [fetchWalletData]);

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!/^\d{4}$/.test(form.pin)) {
        throw new Error('PIN must be a 4-digit number');
      }
      if (!wallet) {
        throw new Error('No wallet found.');
      }
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number.');
      }
      if (!form.receiverWallet.match(/^0x[a-fA-F0-9]{64}$/)) {
        throw new Error('Invalid receiver wallet address.');
      }
      const accessToken = await getToken();
      if (!accessToken) {
        throw new Error('No session token available.');
      }

      const response = await stakeVesuUsdcAsync({
        params: {
          encryptKey: form.pin,
          wallet,
          amount,
          receiverWallet: form.receiverWallet,
        },
        bearerToken: accessToken,
      });

      toast({
        title: 'Staking Successful',
        description: `Transaction Hash: ${response}`,
      });
      setForm({ pin: '', amount: '', receiverWallet: '' });
      onClose();
    } catch (error: any) {
      console.error('[StakeUSDC] Staking failed:', error);
      toast({
        variant: 'destructive',
        title: 'Staking Failed',
        description: error.message || 'Failed to stake USDC.',
      });
    }
  };

  if (walletLoading) {
    return (
      <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
        <CardContent>Loading wallet...</CardContent>
      </Card>
    );
  }

  if (walletError || !wallet || fetchError) {
    return (
      <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
        <CardHeader>
          <CardTitle>Wallet Setup Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">
            {fetchError || 'No wallet is associated with this agent. Please set up a wallet to proceed with staking.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={fetchWalletData}
              disabled={retryCount >= MAX_WALLET_FETCH_RETRIES}
            >
              Retry ({MAX_WALLET_FETCH_RETRIES - retryCount} attempts left)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = '/wallet/setup';
              }}
            >
              Set Up Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md p-4 bg-agentvooc-secondary-bg border-agentvooc-accent/30">
      <CardHeader>
        <CardTitle>Stake USDC in VESU</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleStake} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Security PIN</label>
            <Input
              type="password"
              placeholder="Enter 4-digit PIN"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              maxLength={4}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount to Stake (USDC)</label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              step="0.01"
              min="0.01"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Receiver Wallet Address</label>
            <Input
              type="text"
              placeholder="0x..."
              value={form.receiverWallet}
              onChange={(e) => setForm({ ...form, receiverWallet: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={stakeLoading || walletLoading}>
              {stakeLoading ? 'Staking...' : 'Stake'}
            </Button>
          </div>
        </form>
        {(stakeError || walletError) && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md">
            Error: {(stakeError || walletError)?.message || 'An error occurred.'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}