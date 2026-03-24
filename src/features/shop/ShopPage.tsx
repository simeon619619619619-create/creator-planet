import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Package, Trash2, Upload, Edit2, X, Check } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { getProducts, getAllProducts, createProduct, updateProduct, deleteProduct, uploadProductImage } from './productService';
import type { DbProduct } from '../../core/supabase/database.types';

const ShopPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, role } = useAuth();
  const { selectedCommunity } = useCommunity();
  const isCreator = role === 'creator' || role === 'superadmin';

  const [products, setProducts] = useState<DbProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newImage, setNewImage] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    if (!selectedCommunity?.id) return;
    const load = async () => {
      setIsLoading(true);
      const data = isCreator
        ? await getAllProducts(selectedCommunity.id)
        : await getProducts(selectedCommunity.id);
      setProducts(data);
      setIsLoading(false);
    };
    load();
  }, [selectedCommunity?.id, isCreator]);

  const handleCreate = async () => {
    if (!selectedCommunity?.id || !profile?.id || !newName.trim()) return;
    setIsCreating(true);
    const priceCents = Math.round(parseFloat(newPrice || '0') * 100);
    const product = await createProduct(selectedCommunity.id, profile.id, {
      name: newName,
      description: newDescription || undefined,
      price_cents: priceCents,
      image_url: newImage || undefined,
    });
    if (product) {
      setProducts(prev => [product, ...prev]);
      setNewName('');
      setNewDescription('');
      setNewPrice('');
      setNewImage('');
      setShowCreate(false);
    }
    setIsCreating(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCommunity?.id) return;
    setIsUploading(true);
    const url = await uploadProductImage(selectedCommunity.id, file);
    if (url) setNewImage(url);
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('shop.confirmDelete', { defaultValue: 'Сигурни ли сте?' }))) return;
    const success = await deleteProduct(id);
    if (success) setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleToggleActive = async (product: DbProduct) => {
    const updated = await updateProduct(product.id, { is_active: !product.is_active });
    if (updated) setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const startEdit = (product: DbProduct) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPrice((product.price_cents / 100).toFixed(2));
    setEditDescription(product.description || '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const updated = await updateProduct(editingId, {
      name: editName,
      price_cents: Math.round(parseFloat(editPrice || '0') * 100),
      description: editDescription || null,
    });
    if (updated) setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingId(null);
  };

  if (!selectedCommunity) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--fc-muted,#A0A0A0)]">{t('shop.selectCommunity', { defaultValue: 'Изберете общност' })}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--fc-text,#FAFAFA)]">
            {t('shop.title', { defaultValue: 'Магазин' })}
          </h1>
          <p className="text-sm text-[var(--fc-muted,#A0A0A0)] mt-1">
            {t('shop.subtitle', { defaultValue: 'Продукти на общността' })}
          </p>
        </div>
        {isCreator && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            {t('shop.addProduct', { defaultValue: 'Добави продукт' })}
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && isCreator && (
        <div className="bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-xl p-6 mb-6 space-y-4">
          <h3 className="text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">
            {t('shop.newProduct', { defaultValue: 'Нов продукт' })}
          </h3>

          <div>
            <label className="block text-sm text-[var(--fc-muted,#A0A0A0)] mb-1">{t('shop.name', { defaultValue: 'Име' })}</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] focus:outline-none focus:ring-1 focus:ring-white/10"
              placeholder={t('shop.namePlaceholder', { defaultValue: 'Име на продукта' })}
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--fc-muted,#A0A0A0)] mb-1">{t('shop.description', { defaultValue: 'Описание' })}</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] resize-none focus:outline-none focus:ring-1 focus:ring-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--fc-muted,#A0A0A0)] mb-1">{t('shop.price', { defaultValue: 'Цена (€)' })}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-text,#FAFAFA)] focus:outline-none focus:ring-1 focus:ring-white/10"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--fc-muted,#A0A0A0)] mb-1">{t('shop.image', { defaultValue: 'Снимка' })}</label>
              <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded-lg text-sm text-[var(--fc-muted,#A0A0A0)] hover:bg-[var(--fc-border,#1F1F1F)] transition-colors">
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {newImage ? t('shop.changeImage', { defaultValue: 'Смени' }) : t('shop.uploadImage', { defaultValue: 'Качи' })}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploading} />
              </label>
              {newImage && <img src={newImage} alt="" className="mt-2 w-16 h-16 rounded object-cover" />}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={isCreating || !newName.trim()}
              className="px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg font-medium disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : t('shop.create', { defaultValue: 'Създай' })}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-[var(--fc-border,#1F1F1F)] rounded-lg text-[var(--fc-muted,#A0A0A0)]"
            >
              {t('shop.cancel', { defaultValue: 'Откажи' })}
            </button>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--fc-muted,#A0A0A0)]" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto text-[var(--fc-muted,#333)]" />
          <h2 className="mt-4 text-lg font-semibold text-[var(--fc-text,#FAFAFA)]">
            {t('shop.empty', { defaultValue: 'Все още няма продукти' })}
          </h2>
          <p className="mt-2 text-sm text-[var(--fc-muted,#A0A0A0)]">
            {isCreator
              ? t('shop.emptyCreator', { defaultValue: 'Добавете първия си продукт.' })
              : t('shop.emptyMember', { defaultValue: 'Скоро ще има продукти тук.' })}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className={`bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-xl overflow-hidden ${
                !product.is_active ? 'opacity-50' : ''
              }`}
            >
              {/* Image */}
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-[var(--fc-surface-hover,#151515)] flex items-center justify-center">
                  <Package className="w-12 h-12 text-[var(--fc-muted,#333)]" />
                </div>
              )}

              <div className="p-4">
                {editingId === product.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-2 py-1 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded text-sm text-[var(--fc-text,#FAFAFA)]"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-full px-2 py-1 bg-[var(--fc-surface-hover,#151515)] border border-[var(--fc-border,#1F1F1F)] rounded text-sm text-[var(--fc-text,#FAFAFA)]"
                    />
                    <div className="flex gap-1">
                      <button onClick={saveEdit} className="p-1 text-[#22C55E]"><Check size={16} /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-[var(--fc-muted,#A0A0A0)]"><X size={16} /></button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <h3 className="font-semibold text-[var(--fc-text,#FAFAFA)] truncate">{product.name}</h3>
                    {product.description && (
                      <p className="text-sm text-[var(--fc-muted,#A0A0A0)] mt-1 line-clamp-2">{product.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-[var(--fc-text,#FAFAFA)]">
                        €{(product.price_cents / 100).toFixed(2)}
                      </span>

                      {isCreator && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(product)} className="p-1.5 text-[var(--fc-muted,#A0A0A0)] hover:text-[var(--fc-text,#FAFAFA)]">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleToggleActive(product)} className="p-1.5 text-[var(--fc-muted,#A0A0A0)] hover:text-[#EAB308]">
                            {product.is_active ? '👁' : '👁‍🗨'}
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="p-1.5 text-[var(--fc-muted,#A0A0A0)] hover:text-[#EF4444]">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShopPage;
