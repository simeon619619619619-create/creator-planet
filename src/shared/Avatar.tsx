import React from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
  onClick?: () => void;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const sizePixels: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

function getInitialsUrl(name: string, size: number): string {
  const encodedName = encodeURIComponent(name || 'User');
  return `https://ui-avatars.com/api/?name=${encodedName}&background=6366f1&color=fff&size=${size}&bold=true`;
}

export const Avatar = React.memo(function Avatar({ src, name, size = 'md', className = '', onClick }: AvatarProps) {
  const pixelSize = sizePixels[size];
  const fallbackUrl = getInitialsUrl(name || 'User', pixelSize);
  const imageUrl = src || fallbackUrl;

  const baseClasses = `${sizeClasses[size]} rounded-full object-cover`;
  const interactiveClasses = onClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all' : '';

  return (
    <img
      src={imageUrl}
      alt={name || 'User'}
      className={`${baseClasses} ${interactiveClasses} ${className}`.trim()}
      onClick={onClick}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        if (target.src !== fallbackUrl) {
          target.src = fallbackUrl;
        }
      }}
    />
  );
});

export default Avatar;
