import React, { useEffect, useState } from 'react';
import { Wallet } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { getWalletBalance } from './walletService';

const WalletBalance: React.FC = () => {
  const { profile } = useAuth();
  const { selectedCommunity } = useCommunity();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id || !selectedCommunity?.id) {
      setBalance(0);
      setIsLoading(false);
      return;
    }

    const fetchBalance = async () => {
      const bal = await getWalletBalance(profile.id, selectedCommunity.id);
      setBalance(bal);
      setIsLoading(false);
    };

    fetchBalance();
  }, [profile?.id, selectedCommunity?.id]);

  // Don't render if no balance
  if (balance === 0 && !isLoading) {
    return null;
  }

  const formatted = (balance / 100).toFixed(2);
  const currency = selectedCommunity?.currency || 'EUR';
  const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--fc-surface-hover,#151515)] rounded-lg border border-[var(--fc-border,#1F1F1F)]">
      <Wallet size={14} className="text-[#22C55E]" />
      <span className="text-sm font-medium text-[var(--fc-text,#FAFAFA)]">
        {isLoading ? '...' : `${symbol}${formatted}`}
      </span>
    </div>
  );
};

export default WalletBalance;
