// /home/caveman/projects/bots/venv/elizaOS_env/agentVooc-prod/client/src/components/chat-actions/plugin-starknet/walletListDisplay.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { WalletListDisplayProps } from './types';

export function WalletListDisplay({ wallets, setInput, handleSendMessage }: WalletListDisplayProps) {
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());

  const toggleWalletExpansion = (walletId: string) => {
    setExpandedWallets((prev) => {
      const newSet = new Set(prev);
      newSet.has(walletId) ? newSet.delete(walletId) : newSet.add(walletId);
      return newSet;
    });
  };

  const handleWalletAction = (walletId: string, action: string) => {
    setInput(`${action} walletId: ${walletId}`);
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  return (
    <div className="mt-2 space-y-2 max-w-full">
      <div className="text-sm sm:text-base">
        <p>Your wallets:</p>
        <p className="mt-1 text-xs sm:text-sm">
          Perform actions using 'view walletId: &lt;id&gt;', 'approve walletId: &lt;id&gt;', or 'stake walletId: &lt;id&gt;'
        </p>
        <p className="text-xs sm:text-sm">
          Or click a wallet to perform an action.
        </p>
      </div>
      <div className="space-y-3 mt-4">
        {wallets.map((wallet, index) => {
          const isExpanded = expandedWallets.has(wallet.walletId);
          const displayDetails = wallet.details
            ? isExpanded
              ? wallet.details
              : `${wallet.details.substring(0, 100)}...`
            : 'No details available';

          return (
            <div key={wallet.walletId} className="flex items-start gap-2 sm:gap-3 w-full max-w-full">
              <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-agentvooc-accent/50 border border-agentvooc-accent/30 flex items-center justify-center text-xs sm:text-sm font-medium">
                {index + 1}
              </div>
              <div
                className="flex-1 min-w-0 max-w-full border border-agentvooc-accent/30 rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-agentvooc-accent/10 transition-colors overflow-hidden"
                style={{ wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%', width: '100%' }}
              >
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Address:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {wallet.address || 'Unknown'}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Balance:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {wallet.balance || '0'}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Status:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {wallet.status || 'Unknown'}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Details:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {displayDetails}
                  </div>
                </div>
                {wallet.details && wallet.details.length > 100 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs sm:text-sm text-agentvooc-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWalletExpansion(wallet.walletId);
                    }}
                  >
                    {isExpanded ? (
                      <>
                        Collapse <ChevronUp className="ml-1 size-3 sm:size-4" />
                      </>
                    ) : (
                      <>
                        Expand <ChevronDown className="ml-1 size-3 sm:size-4" />
                      </>
                    )}
                  </Button>
                )}
                <div className="mt-3 pt-2 border-t overflow-hidden">
                  <span className="text-xs sm:text-sm font-medium text-agentvooc-accent">Wallet ID:</span>
                  <div className="ml-2 text-xs sm:text-sm break-all flex items-center justify-center font-mono bg-agentvooc-accent/10 px-2 py-1 rounded mt-1 max-w-full overflow-hidden">
                    {wallet.walletId}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWalletAction(wallet.walletId, 'view')}
                  >
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWalletAction(wallet.walletId, 'approve')}
                  >
                    Approve USDC
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWalletAction(wallet.walletId, 'stake')}
                  >
                    Stake USDC
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}