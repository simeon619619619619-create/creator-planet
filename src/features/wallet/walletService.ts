import { supabase } from '../../core/supabase/client';
import type { DbWallet, DbWalletTransaction } from '../../core/supabase/database.types';

/**
 * Get or create a wallet for a user in a community
 */
export async function getOrCreateWallet(
  userId: string,
  communityId: string
): Promise<DbWallet | null> {
  // Try to get existing wallet
  const { data: existing } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .single();

  if (existing) return existing;

  // Create new wallet
  const { data, error } = await supabase
    .from('wallets')
    .insert({ user_id: userId, community_id: communityId })
    .select()
    .single();

  if (error) {
    console.error('Error creating wallet:', error);
    return null;
  }
  return data;
}

/**
 * Get wallet balance for a user in a community
 */
export async function getWalletBalance(
  userId: string,
  communityId: string
): Promise<number> {
  const { data } = await supabase
    .from('wallets')
    .select('balance_cents')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .single();

  return data?.balance_cents ?? 0;
}

/**
 * Get all wallets for a user (across communities)
 */
export async function getUserWallets(userId: string): Promise<DbWallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .gt('balance_cents', 0);

  if (error) {
    console.error('Error fetching wallets:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Get total balance across all communities for a user
 */
export async function getTotalBalance(userId: string): Promise<number> {
  const wallets = await getUserWallets(userId);
  return wallets.reduce((sum, w) => sum + w.balance_cents, 0);
}

/**
 * Credit cashback to a wallet
 */
export async function creditCashback(
  userId: string,
  communityId: string,
  amountCents: number,
  description: string,
  referenceId?: string
): Promise<boolean> {
  const wallet = await getOrCreateWallet(userId, communityId);
  if (!wallet) return false;

  // Update balance
  const { error: updateError } = await supabase
    .from('wallets')
    .update({
      balance_cents: wallet.balance_cents + amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  if (updateError) {
    console.error('Error crediting wallet:', updateError);
    return false;
  }

  // Record transaction
  const { error: txError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'cashback',
      amount_cents: amountCents,
      description,
      reference_id: referenceId ?? null,
    });

  if (txError) {
    console.error('Error recording transaction:', txError);
  }

  return true;
}

/**
 * Spend from wallet (at checkout)
 */
export async function spendFromWallet(
  userId: string,
  communityId: string,
  amountCents: number,
  description: string,
  referenceId?: string
): Promise<boolean> {
  const wallet = await getOrCreateWallet(userId, communityId);
  if (!wallet || wallet.balance_cents < amountCents) return false;

  const { error: updateError } = await supabase
    .from('wallets')
    .update({
      balance_cents: wallet.balance_cents - amountCents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', wallet.id);

  if (updateError) {
    console.error('Error spending from wallet:', updateError);
    return false;
  }

  const { error: txError } = await supabase
    .from('wallet_transactions')
    .insert({
      wallet_id: wallet.id,
      type: 'spend',
      amount_cents: -amountCents,
      description,
      reference_id: referenceId ?? null,
    });

  if (txError) {
    console.error('Error recording spend transaction:', txError);
  }

  return true;
}

/**
 * Get transaction history for a wallet
 */
export async function getWalletTransactions(
  userId: string,
  communityId: string,
  limit = 20
): Promise<DbWalletTransaction[]> {
  const wallet = await getOrCreateWallet(userId, communityId);
  if (!wallet) return [];

  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return data ?? [];
}
