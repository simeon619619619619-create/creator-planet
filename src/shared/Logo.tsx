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
  xs: { height: 28, textSize: 'text-sm', gap: 'gap-1.5' },
  sm: { height: 36, textSize: 'text-base', gap: 'gap-2' },
  md: { height: 44, textSize: 'text-lg', gap: 'gap-2' },
  lg: { height: 48, textSize: 'text-xl', gap: 'gap-3' },
  xl: { height: 80, textSize: 'text-2xl', gap: 'gap-3' },
};

export const Logo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  showText = true,
  showTagline = false,
  className = '',
}) => {
  const config = sizeConfig[size];

  const logoSrc = variant === 'light' ? '/logo-light.png' : '/logo-dark.png';

  return (
    <div className={`flex items-center ${config.gap} ${className}`}>
      <img
        src={logoSrc}
        alt="Founders Club"
        style={{
          height: config.height,
          width: 'auto',
        }}
        className="object-contain"
      />
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold ${config.textSize} ${variant === 'light' ? 'text-[var(--fc-section-text,#FAFAFA)]' : 'text-[#0A0A0A]'}`}>
            Founders Club
          </span>
          {showTagline && (
            <span className={`text-xs tracking-wider ${variant === 'light' ? 'text-[var(--fc-section-muted,#A0A0A0)]' : 'text-[var(--fc-section-muted,#666666)]'}`}>
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

  const logoSrc = variant === 'light' ? '/logo-light.png' : '/logo-dark.png';

  return (
    <img
      src={logoSrc}
      alt="Founders Club"
      style={{
        height: config.height,
        width: 'auto',
      }}
      className={`object-contain ${className}`}
    />
  );
};

export default Logo;
