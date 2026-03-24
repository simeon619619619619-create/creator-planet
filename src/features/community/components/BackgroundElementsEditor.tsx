import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Trash2, Loader2, Plus, RotateCw } from 'lucide-react';
import type { BackgroundElement } from '../../../core/supabase/database.types';
import { uploadBackgroundElement, updateCommunity } from '../communityService';

interface BackgroundElementsEditorProps {
  communityId: string;
  elements: BackgroundElement[];
  onChange: (elements: BackgroundElement[]) => void;
}

const BackgroundElementsEditor: React.FC<BackgroundElementsEditorProps> = ({
  communityId,
  elements,
  onChange,
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const saveElements = async (updated: BackgroundElement[]) => {
    onChange(updated);
    await updateCommunity(communityId, { background_elements: updated });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return; // 10MB max

    setIsUploading(true);
    const url = await uploadBackgroundElement(communityId, file);
    if (url) {
      const newElement: BackgroundElement = {
        id: Date.now().toString(36),
        image_url: url,
        x: 50,
        y: 50,
        size: 200,
        opacity: 0.1,
        rotation: 0,
      };
      await saveElements([...elements, newElement]);
    }
    setIsUploading(false);
    e.target.value = '';
  };

  const updateElement = async (id: string, updates: Partial<BackgroundElement>) => {
    const updated = elements.map(el =>
      el.id === id ? { ...el, ...updates } : el
    );
    await saveElements(updated);
  };

  const removeElement = async (id: string) => {
    await saveElements(elements.filter(el => el.id !== id));
  };

  return (
    <div className="space-y-4">
      {/* Element list */}
      {elements.map((el) => (
        <div
          key={el.id}
          className="bg-[var(--fc-section-hover,#151515)] rounded-lg border border-[var(--fc-section-border,#1F1F1F)] p-3 space-y-3"
        >
          <div className="flex items-center gap-3">
            {/* Preview */}
            <div className="w-12 h-12 rounded bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src={el.image_url}
                alt=""
                className="w-full h-full object-contain"
                style={{ opacity: el.opacity }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--fc-section-muted,#A0A0A0)] truncate">{el.image_url.split('/').pop()}</p>
            </div>

            <button
              onClick={() => removeElement(el.id)}
              className="p-1.5 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[#EF4444] transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-2 gap-2">
            {/* Position X */}
            <div>
              <label className="text-[10px] text-[var(--fc-section-muted,#666666)] uppercase tracking-wider">X %</label>
              <input
                type="range"
                min="0"
                max="100"
                value={el.x}
                onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                className="w-full h-1 accent-white"
              />
            </div>
            {/* Position Y */}
            <div>
              <label className="text-[10px] text-[var(--fc-section-muted,#666666)] uppercase tracking-wider">Y %</label>
              <input
                type="range"
                min="0"
                max="100"
                value={el.y}
                onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                className="w-full h-1 accent-white"
              />
            </div>
            {/* Size */}
            <div>
              <label className="text-[10px] text-[var(--fc-section-muted,#666666)] uppercase tracking-wider flex items-center gap-1">
                {t('communityHub.pricing.bgElements.size')}
              </label>
              <input
                type="range"
                min="50"
                max="800"
                value={el.size}
                onChange={(e) => updateElement(el.id, { size: Number(e.target.value) })}
                className="w-full h-1 accent-white"
              />
            </div>
            {/* Opacity */}
            <div>
              <label className="text-[10px] text-[var(--fc-section-muted,#666666)] uppercase tracking-wider">
                {t('communityHub.pricing.bgElements.opacity')}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={Math.round(el.opacity * 100)}
                onChange={(e) => updateElement(el.id, { opacity: Number(e.target.value) / 100 })}
                className="w-full h-1 accent-white"
              />
            </div>
            {/* Rotation */}
            <div className="col-span-2">
              <label className="text-[10px] text-[var(--fc-section-muted,#666666)] uppercase tracking-wider flex items-center gap-1">
                <RotateCw size={10} />
                {t('communityHub.pricing.bgElements.rotation')}
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={el.rotation}
                onChange={(e) => updateElement(el.id, { rotation: Number(e.target.value) })}
                className="w-full h-1 accent-white"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add button */}
      <label className="cursor-pointer">
        <span className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--fc-section-hover,#151515)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] transition-colors border border-dashed border-[#333333]">
          {isUploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t('communityHub.pricing.bgElements.uploading')}
            </>
          ) : (
            <>
              <Plus size={14} />
              {t('communityHub.pricing.bgElements.add')}
            </>
          )}
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={isUploading}
        />
      </label>
      <p className="text-xs text-[var(--fc-section-muted,#A0A0A0)]">
        {t('communityHub.pricing.bgElements.hint')}
      </p>
    </div>
  );
};

export default BackgroundElementsEditor;
