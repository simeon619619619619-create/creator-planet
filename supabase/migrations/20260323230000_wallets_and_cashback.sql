-- Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  balance_cents INTEGER DEFAULT 0 NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, community_id)
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cashback', 'spend', 'topup', 'refund')),
  amount_cents INTEGER NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Cashback settings on communities
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS cashback_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS cashback_percent INTEGER DEFAULT 0;

-- RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = (SELECT id FROM profiles WHERE user_id = auth.uid())));

CREATE POLICY "Service can manage wallets" ON public.wallets
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Service can manage transactions" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS wallets_user_community ON public.wallets(user_id, community_id);
CREATE INDEX IF NOT EXISTS wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
