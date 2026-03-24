/**
 * Color contrast utilities for automatic text color selection.
 * Uses WCAG relative luminance formula to determine if text should be light or dark.
 */

/** Parse a hex color string to RGB values */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

/** Calculate relative luminance per WCAG 2.0 */
function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [rs, gs, bs] = [rgb.r / 255, rgb.g / 255, rgb.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Returns true if the color is considered "light" (luminance > 0.4) */
export function isLightColor(hex: string): boolean {
  return getRelativeLuminance(hex) > 0.4;
}

/**
 * Returns a contrasting text color (white or dark) for the given background.
 * Uses a luminance threshold to ensure readability.
 */
export function getContrastText(bgHex: string): string {
  return isLightColor(bgHex) ? '#1A1A1A' : '#FAFAFA';
}

/**
 * Returns a contrasting muted text color for the given background.
 */
export function getContrastMuted(bgHex: string): string {
  return isLightColor(bgHex) ? '#555555' : '#A0A0A0';
}

/**
 * Returns a contrasting border color for the given background.
 */
export function getContrastBorder(bgHex: string): string {
  return isLightColor(bgHex) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)';
}

/**
 * Computes all themed CSS variables based on community colors.
 * Auto-detects contrast for text on surfaces and backgrounds.
 */
export function computeThemeVars(opts: {
  themeColor?: string | null;
  textColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  sectionColor?: string | null;
  buttonColor?: string | null;
}): Record<string, string> {
  const bg = opts.themeColor || '#0A0A0A';
  const surface = opts.accentColor || opts.themeColor || '#0A0A0A';
  const section = opts.sectionColor || bg;
  const button = opts.buttonColor || '#1A1A1A';

  // Auto-detect text colors based on backgrounds
  const autoTextOnBg = getContrastText(bg);
  const autoTextOnSurface = getContrastText(surface);
  const autoMutedOnBg = getContrastMuted(bg);
  const autoMutedOnSurface = getContrastMuted(surface);
  const autoTextOnSection = getContrastText(section);
  const autoMutedOnSection = getContrastMuted(section);

  // Use user-specified colors if set, otherwise auto-contrast
  const textColor = opts.textColor || autoTextOnBg;
  const mutedColor = opts.secondaryColor || autoMutedOnBg;

  // Surface hover/border computed from surface color
  const isLight = isLightColor(surface);
  const surfaceHover = isLight
    ? `color-mix(in srgb, ${surface} 85%, black)`
    : `color-mix(in srgb, ${surface} 85%, white)`;
  const borderColor = isLight
    ? `color-mix(in srgb, ${surface} 80%, black)`
    : `color-mix(in srgb, ${surface} 70%, white)`;

  // Section hover/border
  const isSectionLight = isLightColor(section);
  const sectionHover = isSectionLight
    ? `color-mix(in srgb, ${section} 85%, black)`
    : `color-mix(in srgb, ${section} 85%, white)`;
  const sectionBorder = isSectionLight
    ? `color-mix(in srgb, ${section} 80%, black)`
    : `color-mix(in srgb, ${section} 70%, white)`;

  return {
    '--fc-text': textColor,
    '--fc-muted': mutedColor,
    '--fc-surface': surface,
    '--fc-surface-hover': surfaceHover,
    '--fc-border': borderColor,
    // Auto-contrast text ON the surface (sidebar, cards, modals)
    '--fc-surface-text': autoTextOnSurface,
    '--fc-surface-muted': autoMutedOnSurface,
    // Auto-contrast text ON the background
    '--fc-bg-text': autoTextOnBg,
    '--fc-bg-muted': autoMutedOnBg,
    // Section colors (content panels, settings, cards in main area)
    '--fc-section': section,
    '--fc-section-hover': sectionHover,
    '--fc-section-border': sectionBorder,
    '--fc-section-text': autoTextOnSection,
    '--fc-section-muted': autoMutedOnSection,
    // Button colors
    '--fc-button': button,
    '--fc-button-hover': isLightColor(button)
      ? `color-mix(in srgb, ${button} 85%, black)`
      : `color-mix(in srgb, ${button} 85%, white)`,
    '--fc-button-text': getContrastText(button),
  };
}
