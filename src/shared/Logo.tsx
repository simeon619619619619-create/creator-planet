import React from 'react';

interface LogoProps {
  /** 'light' for dark backgrounds (white logo), 'dark' for light backgrounds (black logo) */
  variant?: 'light' | 'dark';
  /** Size preset */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Show text alongside icon */
  showText?: boolean;
  /** Additional className */
  className?: string;
  /** Show tagline "COURSES & COMMUNITIES" */
  showTagline?: boolean;
}

const sizeConfig = {
  xs: { height: 24, textSize: 'text-sm', gap: 'gap-1.5' },
  sm: { height: 32, textSize: 'text-base', gap: 'gap-2' },
  md: { height: 40, textSize: 'text-lg', gap: 'gap-2' },
  lg: { height: 56, textSize: 'text-xl', gap: 'gap-3' },
  xl: { height: 72, textSize: 'text-2xl', gap: 'gap-3' },
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
}) => {
  const config = sizeConfig[size];

  // For light variant (used on dark backgrounds), invert the logo
  const filterStyle = variant === 'light'
    ? { filter: 'brightness(0) invert(1)' }
    : {};

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      <img
        src="/logo.png"
        alt="Creator Club"
        style={{
          height: config.height,
          width: 'auto',
          ...filterStyle
        }}
        className="object-contain"
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${config.textSize} ${variant === 'light' ? 'text-white' : 'text-slate-900'}`}>
            Creator Club
          </span>
          {showTagline && (
            <span className={`text-xs tracking-wider ${variant === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
              COURSES & COMMUNITIES
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/** Icon-only version for compact spaces */
export const LogoIcon: React.FC<Omit<LogoProps, 'showText' | 'showTagline'>> = ({
  variant = 'dark',
  size = 'md',
  className = '',
}) => {
  const config = sizeConfig[size];

  const filterStyle = variant === 'light'
    ? { filter: 'brightness(0) invert(1)' }
    : {};

  return (
    <img
      src="/logo.png"
      alt="Creator Club"
      style={{
        height: config.height,
        width: 'auto',
        ...filterStyle
      }}
      className={`object-contain ${className}`}
    />
  );
};

export default Logo;
