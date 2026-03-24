import { supabase } from '../../core/supabase/client';
import type { DbProduct } from '../../core/supabase/database.types';

export async function getProducts(communityId: string): Promise<DbProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('community_id', communityId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching products:', error);
    return [];
  }
  return data ?? [];
}

export async function getAllProducts(communityId: string): Promise<DbProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all products:', error);
    return [];
  }
  return data ?? [];
}

export async function createProduct(
  communityId: string,
  creatorId: string,
  product: { name: string; description?: string; price_cents: number; currency?: string; image_url?: string; stock?: number }
): Promise<DbProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      community_id: communityId,
      creator_id: creatorId,
      name: product.name,
      description: product.description ?? null,
      price_cents: product.price_cents,
      currency: product.currency ?? 'EUR',
      image_url: product.image_url ?? null,
      stock: product.stock ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error);
    return null;
  }
  return data;
}

export async function updateProduct(
  productId: string,
  updates: Partial<Pick<DbProduct, 'name' | 'description' | 'price_cents' | 'image_url' | 'is_active' | 'stock'>>
): Promise<DbProduct | null> {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    return null;
  }
  return data;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }
  return true;
}

export async function uploadProductImage(
  communityId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${communityId}/product-${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('community-thumbnails')
    .upload(fileName, file, { cacheControl: '3600', upsert: true });

  if (error) {
    console.error('Error uploading product image:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('community-thumbnails')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
