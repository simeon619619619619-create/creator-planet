# WaitlistSection Styling Guide

## Overview
Complete reference for Tailwind CSS classes used in the WaitlistSection component. Use this guide for customization or creating variants.

## Color Palette

### Background Gradient
```
bg-gradient-to-br from-indigo-600 to-purple-700
```
- Starts: Indigo 600 (`#4f46e5`)
- Ends: Purple 700 (`#7e22ce`)
- Direction: Bottom-right diagonal

### Text Colors
- **Primary (white):** `text-white`
- **Secondary (subtle):** `text-indigo-100` (#e0e7ff)
- **Tertiary (privacy):** `text-indigo-200` (#c7d2fe)

### Input Colors
- **Background:** `bg-white`
- **Text:** `text-slate-900`
- **Placeholder:** `placeholder-slate-400`
- **Focus Ring:** `focus:ring-white/50`

### State Colors
- **Success Background:** `bg-green-100`
- **Success Icon:** `text-green-600`
- **Error Background:** `bg-red-500/20`
- **Error Border:** `border-red-400/30`

## Layout & Spacing

### Section
```
py-20 px-4
```
- Vertical padding: 5rem (80px)
- Horizontal padding: 1rem (16px)

### Container
```
max-w-2xl mx-auto text-center
```
- Max width: 42rem (672px)
- Centered horizontally
- Text aligned center

### Form Spacing
```
space-y-4
```
- Gap between form elements: 1rem (16px)

## Typography

### Headings

**Main Title (Desktop)**
```
text-4xl md:text-5xl font-bold mb-4
```
- Mobile: 2.25rem (36px)
- Desktop: 3rem (48px)
- Weight: 700 (bold)
- Bottom margin: 1rem

**Success Title**
```
text-4xl font-bold
```
- Size: 2.25rem (36px)
- Weight: 700

### Body Text

**Subtitle**
```
text-xl text-indigo-100
```
- Size: 1.25rem (20px)
- Color: Indigo 100

**Privacy Text**
```
text-sm text-indigo-200
```
- Size: 0.875rem (14px)
- Color: Indigo 200

## Form Elements

### Input Fields
```
w-full pl-12 pr-4 py-4 rounded-xl
bg-white text-slate-900 placeholder-slate-400
focus:outline-none focus:ring-2 focus:ring-white/50
transition-all
disabled:opacity-50 disabled:cursor-not-allowed
```

**Breakdown:**
- Full width
- Left padding: 3rem (48px) for icon
- Right padding: 1rem (16px)
- Vertical padding: 1rem (16px)
- Border radius: 0.75rem (12px)
- Focus: 2px white ring at 50% opacity
- Smooth transitions
- Disabled: 50% opacity, no pointer cursor

### Select Dropdown
```
appearance-none cursor-pointer
```
- Remove default arrow
- Pointer cursor

### Icon Containers (Left)
```
absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none
```
- Positioned: 1rem from left
- Vertically centered
- No mouse events

### Icon Containers (Right - Dropdown)
```
absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none
```
- Positioned: 1rem from right
- Vertically centered
- No mouse events

### Icon Size
```
w-5 h-5
```
- Size: 1.25rem × 1.25rem (20px × 20px)

## Buttons

### Submit Button
```
w-full bg-white hover:bg-slate-50 text-indigo-600
px-8 py-4 rounded-xl font-semibold text-lg
transition-all
disabled:opacity-50 disabled:cursor-not-allowed
flex items-center justify-center gap-2 group
```

**Breakdown:**
- Full width
- White background, slate hover
- Indigo text color
- Horizontal padding: 2rem (32px)
- Vertical padding: 1rem (16px)
- Border radius: 0.75rem (12px)
- Font: semibold, 1.125rem (18px)
- Flex center with 0.5rem gap
- Group for hover effects

**Arrow Hover Effect:**
```
group-hover:translate-x-1 transition-transform
```
- Moves 0.25rem right on button hover

## State Indicators

### Loading Spinner
```
w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin
```
- Size: 1.25rem (20px)
- Border: 2px indigo, transparent top
- Full circle
- Spin animation

### Success Checkmark Container
```
w-16 h-16 bg-green-100 rounded-full flex items-center justify-center
```
- Size: 4rem × 4rem (64px)
- Green background
- Circle shape
- Flex center

### Success Icon
```
w-10 h-10 text-green-600
```
- Size: 2.5rem (40px)
- Green color

### Error Banner
```
p-4 bg-red-500/20 border border-red-400/30 rounded-lg
flex items-center gap-3 text-left animate-shake
```
- Padding: 1rem
- Red background at 20% opacity
- Red border at 30% opacity
- Border radius: 0.5rem (8px)
- Flex with 0.75rem gap
- Left-aligned text
- Shake animation (needs custom animation)

### Error Icon
```
w-5 h-5 flex-shrink-0
```
- Size: 1.25rem (20px)
- Doesn't shrink

## Animations

### Fade In (Success State)
```
animate-fade-in
```
**Custom CSS needed:**
```css
@keyframes fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}
```

### Shake (Error Banner)
```
animate-shake
```
**Custom CSS needed:**
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.animate-shake {
  animation: shake 0.5s ease-out;
}
```

### Spin (Loading)
```
animate-spin
```
- Built-in Tailwind animation
- Continuous 360° rotation

## Responsive Design

### Breakpoints Used

**Mobile First (default):**
- No prefix = mobile styles
- Full width components
- Smaller text sizes

**Medium (md: 768px+):**
```
md:text-5xl
```
- Larger heading on tablets+

### Padding Adjustments
```
py-20 px-4
```
- Vertical stays consistent
- Horizontal minimal on mobile

## Customization Examples

### Dark Theme Variant
```tsx
className="py-20 px-4 bg-gradient-to-br from-slate-800 to-slate-900 text-white"
```

### Brand Colors (Blue to Teal)
```tsx
className="py-20 px-4 bg-gradient-to-br from-blue-600 to-teal-600 text-white"
```

### Compact Version
```tsx
className="py-12 px-4 bg-gradient-to-br from-indigo-600 to-purple-700 text-white"
// and
className="max-w-lg mx-auto text-center"
```

### Light Background Variant
```tsx
className="py-20 px-4 bg-slate-50 text-slate-900"
// Update input classes:
className="bg-white border border-slate-200 text-slate-900"
// Update button:
className="bg-indigo-600 hover:bg-indigo-700 text-white"
```

## Accessibility Considerations

1. **Focus States:** Clear focus ring on all inputs
2. **Disabled States:** Visual feedback (opacity) + cursor change
3. **Color Contrast:** White text on dark gradient (WCAG AA+)
4. **Icon Labels:** Placeholder text provides context
5. **Error Messages:** Text + icon for clarity
6. **Loading State:** Visible spinner + text

## Browser Compatibility

All classes used are standard Tailwind v3+ and work in:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS 14+, Android 5+)

## Required Tailwind Config

Ensure these are in `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'shake': 'shake 0.5s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
    },
  },
}
```
