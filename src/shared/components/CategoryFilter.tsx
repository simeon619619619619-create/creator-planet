import React from 'react';
import { useTranslation } from 'react-i18next';
import { CONTENT_CATEGORIES } from '../constants/categories';
import type { ContentCategory } from '../constants/categories';

interface CategoryFilterProps {
  selectedCategory: ContentCategory | null;
  onCategoryChange: (category: ContentCategory | null) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  selectedCategory,
  onCategoryChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onCategoryChange(null)}
        className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          selectedCategory === null
            ? 'bg-[#22C55E] text-black'
            : 'bg-[#0A0A0A] text-[#A0A0A0] hover:bg-[#151515] border border-[#1F1F1F]'
        }`}
      >
        {t('categories.all')}
      </button>
      {CONTENT_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          onClick={() => onCategoryChange(cat.value)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === cat.value
              ? 'bg-[#22C55E] text-black'
              : 'bg-[#0A0A0A] text-[#A0A0A0] hover:bg-[#151515] border border-[#1F1F1F]'
          }`}
        >
          {t(cat.labelKey)}
        </button>
      ))}
    </div>
  );
};

export { CategoryFilter };
export default CategoryFilter;
