# WaitlistSection Component Usage

## Quick Start

```tsx
import { WaitlistSection } from './components/landing';

function App() {
  return (
    <div>
      {/* Basic usage */}
      <WaitlistSection />

      {/* With callbacks */}
      <WaitlistSection
        onSuccess={(result) => {
          console.log('Success!', result.data);
          // Track analytics, show notification, etc.
        }}
        onError={(error) => {
          console.error('Error:', error.message);
          // Log to error tracking service
        }}
      />
    </div>
  );
}
```

## Integration with LandingPage.tsx

```tsx
// In LandingPage.tsx, add the WaitlistSection before the footer

import { WaitlistSection } from './landing';

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* ... existing sections ... */}

      {/* Add before footer */}
      <WaitlistSection
        onSuccess={(result) => {
          console.log('New waitlist signup:', result.data?.email);
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        {/* ... footer content ... */}
      </footer>
    </div>
  );
};
```

## Database Setup

Make sure your Supabase database has a `waitlist` table:

```sql
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  interest TEXT NOT NULL CHECK (interest IN ('creator', 'coach', 'mentor', 'student', 'other')),
  source TEXT NOT NULL DEFAULT 'landing_page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for faster email lookups
CREATE INDEX idx_waitlist_email ON waitlist(email);

-- Add index for analytics
CREATE INDEX idx_waitlist_interest ON waitlist(interest);
CREATE INDEX idx_waitlist_created_at ON waitlist(created_at DESC);
```

## Environment Variables

Ensure you have these in your `.env` file:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Features

- **Email Validation**: Client-side regex validation before submission
- **Duplicate Check**: Prevents the same email from joining twice
- **States Management**: Idle → Submitting → Success/Error
- **Loading Indicator**: Spinning loader during submission
- **Success Animation**: Checkmark icon with fade-in animation
- **Error Handling**: Alert banner with clear error messages
- **Auto-reset**: Form resets 3 seconds after successful submission
- **Accessibility**: Proper disabled states and keyboard navigation
- **Responsive**: Mobile-friendly design

## Props

```typescript
interface WaitlistSectionProps {
  onSuccess?: (data: WaitlistResult) => void;  // Called on successful submission
  onError?: (error: WaitlistResult) => void;   // Called on error
}
```

## Service Functions

The `waitlistService.ts` provides these functions:

```typescript
// Submit a new waitlist entry
await submitWaitlist({
  email: 'user@example.com',
  name: 'John Doe',           // optional
  interest: 'creator',        // required
  source: 'landing_page'      // optional, defaults to 'landing_page'
});

// Get all entries (admin)
const entries = await getWaitlistEntries();

// Get total count
const count = await getWaitlistCount();
```

## Customization

The component uses Tailwind CSS classes. Key styling:

- **Background**: `bg-gradient-to-br from-indigo-600 to-purple-700`
- **Input Fields**: `rounded-xl` with white background
- **Submit Button**: White with indigo text on gradient background
- **Success State**: Green checkmark with fade-in animation

To customize, edit the className strings in `WaitlistSection.tsx`.
