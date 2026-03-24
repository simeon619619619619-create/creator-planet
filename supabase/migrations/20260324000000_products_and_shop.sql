ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS shop_enabled BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT true,
  stock INTEGER,
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.product_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Creators can manage own products" ON public.products
  FOR ALL TO authenticated
  USING (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
  WITH CHECK (creator_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view own purchases" ON public.product_purchases
  FOR SELECT TO authenticated
  USING (buyer_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Service can manage purchases" ON public.product_purchases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS products_community_id ON public.products(community_id);
CREATE INDEX IF NOT EXISTS product_purchases_buyer ON public.product_purchases(buyer_id);
