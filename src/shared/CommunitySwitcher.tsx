import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Plus, Check } from 'lucide-react';
import { useCommunity } from '../core/contexts/CommunityContext';
import { useAuth } from '../core/contexts/AuthContext';

interface CommunitySwitcherProps {
  onBrowseMore: () => void;
  onCreateCommunity?: () => void;
}

const CommunitySwitcher: React.FC<CommunitySwitcherProps> = ({ onBrowseMore, onCreateCommunity }) => {
  const { communities, selectedCommunity, setSelectedCommunity, isLoading } = useCommunity();
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCreator = role === 'creator' || role === 'superadmin';

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  if (isLoading) {
    return <div className="h-10 bg-[var(--fc-surface-hover,#151515)] rounded-lg animate-pulse" />;
  }

  // Empty state: show create or browse action
  if (communities.length === 0) {
    return isCreator && onCreateCommunity ? (
      <button
        onClick={onCreateCommunity}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--fc-surface-hover,#151515)] hover:bg-[#1A1A1A] transition-colors text-sm text-[var(--fc-surface-text,#FAFAFA)]"
      >
        <Plus size={18} />
        <span>New Community</span>
      </button>
    ) : (
      <button
        onClick={onBrowseMore}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--fc-surface-hover,#151515)] hover:bg-[#1A1A1A] transition-colors text-sm text-[var(--fc-surface-muted,#A0A0A0)]"
      >
        <Search size={18} />
        <span>Browse Communities</span>
      </button>
    );
  }

  const handleSelect = (community: typeof communities[0]) => {
    setSelectedCommunity(community);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left
          ${isOpen ? 'bg-[#1A1A1A]' : 'bg-[var(--fc-surface-hover,#151515)] hover:bg-[#1A1A1A]'}
        `}
      >
        {selectedCommunity?.thumbnail_url ? (
          <img
            src={selectedCommunity.thumbnail_url}
            alt=""
            className="w-7 h-7 rounded-md object-cover shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-md bg-[#333333] flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-[var(--fc-surface-text,#FAFAFA)]">
              {selectedCommunity?.name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
          </div>
        )}
        <span className="flex-1 text-sm font-medium text-[var(--fc-surface-text,#FAFAFA)] truncate">
          {selectedCommunity?.name || 'Select Community'}
        </span>
        <ChevronDown
          size={16}
          className={`text-[var(--fc-surface-muted,#A0A0A0)] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[var(--fc-surface,#0A0A0A)] border border-[var(--fc-border,#1F1F1F)] rounded-lg overflow-hidden">
          {/* Community list */}
          <div className="max-h-52 overflow-y-auto py-1">
            {communities.map((community) => {
              const isSelected = selectedCommunity?.id === community.id;
              return (
                <button
                  key={community.id}
                  onClick={() => handleSelect(community)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors
                    ${isSelected
                      ? 'bg-[var(--fc-surface-hover,#151515)] text-[var(--fc-surface-text,#FAFAFA)]'
                      : 'text-[var(--fc-surface-muted,#A0A0A0)] hover:bg-[var(--fc-surface-hover,#151515)] hover:text-[var(--fc-surface-text,#FAFAFA)]'}
                  `}
                >
                  {community.thumbnail_url ? (
                    <img
                      src={community.thumbnail_url}
                      alt=""
                      className="w-6 h-6 rounded-md object-cover shrink-0"
                    />
                  ) : (
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#333333]' : 'bg-[#1F1F1F]'
                    }`}>
                      <span className="text-[10px] font-bold">
                        {community.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="flex-1 text-left truncate">{community.name}</span>
                  {isSelected && <Check size={14} className="text-[var(--fc-surface-text,#FAFAFA)] shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="border-t border-[var(--fc-border,#1F1F1F)] py-1">
            {isCreator && onCreateCommunity && (
              <button
                onClick={() => { onCreateCommunity(); setIsOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--fc-surface-text,#FAFAFA)] hover:bg-[var(--fc-surface-hover,#151515)] transition-colors"
              >
                <Plus size={16} />
                <span>New Community</span>
              </button>
            )}
            <button
              onClick={() => { onBrowseMore(); setIsOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--fc-surface-muted,#A0A0A0)] hover:bg-[var(--fc-surface-hover,#151515)] transition-colors"
            >
              <Search size={16} />
              <span>Browse More</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitySwitcher;
