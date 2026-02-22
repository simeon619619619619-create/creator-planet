# Done-With-You (DWY) Packages Architecture Design

**Date**: 2025-12-29
**Author**: Architect Agent
**Status**: 📋 DESIGNED (Not implemented in MVP - application-based premium service)
**Phase**: 3 - Premium Services

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Designed | dwy_packages, dwy_applications, dwy_engagements |
| Service Layer | ✅ Designed | dwyService.ts with full CRUD |
| UI Components | ✅ Designed | Application form, status tracking |
| Stripe Integration | ⏳ Not needed | Manual invoicing for high-ticket services |

**Note:** DWY Packages are high-ticket services (Launch System, Growth Partner) requiring manual application review. Not self-service purchases, so not part of automated Stripe integration.

## Overview

DWY Packages are premium "Done-With-You" services for creators who want professional help building their marketing infrastructure. This is an application-based system with two tiers:

1. **Launch System** - Quick start with proven sales systems and funnels
2. **Growth Partner** - Full execution + scaling with an in-house marketing team experience

These are high-ticket services requiring an application process, not self-service purchases.

---

## 1. Database Schema

### 1.1 New ENUM Types

```sql
-- Package tier types
CREATE TYPE dwy_package_tier AS ENUM (
  'launch_system',   -- Package 1: Launch System
  'growth_partner'   -- Package 2: Growth Partner
);

-- Application status workflow
CREATE TYPE dwy_application_status AS ENUM (
  'pending',         -- New application awaiting review
  'under_review',    -- Being evaluated by team
  'interview_scheduled', -- Discovery call scheduled
  'approved',        -- Accepted, awaiting payment
  'rejected',        -- Not a fit
  'withdrawn',       -- Creator withdrew application
  'converted'        -- Converted to active engagement
);

-- Engagement status (active service)
CREATE TYPE dwy_engagement_status AS ENUM (
  'onboarding',      -- Initial setup phase
  'active',          -- Service in progress
  'paused',          -- Temporarily paused
  'completed',       -- Service delivered successfully
  'cancelled'        -- Engagement terminated
);
```

### 1.2 Table: `dwy_packages`

Defines the available DWY packages.

```sql
CREATE TABLE public.dwy_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Package definition
  tier dwy_package_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,

  -- Features (stored as JSONB array)
  features JSONB NOT NULL DEFAULT '[]',
  -- Example: [
  --   {"title": "Proven Sales System", "description": "A-Z organized"},
  --   {"title": "3 Funnel Types", "description": "Quick Offer, VSL, High-Ticket"}
  -- ]

  -- Pricing info (display only, actual pricing handled manually)
  price_display TEXT, -- e.g., "Starting from €2,500"
  price_note TEXT,    -- e.g., "Custom pricing based on scope"

  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  slots_available INTEGER, -- NULL = unlimited, 0 = closed

  -- Display
  display_order INTEGER DEFAULT 0,
  highlight_text TEXT, -- e.g., "Most Popular"

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default packages
INSERT INTO public.dwy_packages (tier, name, tagline, description, features, display_order) VALUES
(
  'launch_system',
  'Launch System',
  'Quick start with proven sales systems',
  'For creators who want a fast start with a proven system, without dealing with technicalities and chaos.',
  '[
    {"title": "Proven Sales System", "description": "Organized A-Z for maximum results"},
    {"title": "3 Funnel Types", "description": "Quick Offer, VSL/Webinar, High-Ticket Application"},
    {"title": "Website & Landing Pages", "description": "UX + copy structure built for conversions"},
    {"title": "Domain & Email Setup", "description": "Complete technical infrastructure"},
    {"title": "Tracking & Optimization", "description": "Know what works with proper analytics"}
  ]',
  1
),
(
  'growth_partner',
  'Growth Partner',
  'Full execution + scaling like having an in-house team',
  'For creators who want full execution and scaling, as if they had their own internal marketing team.',
  '[
    {"title": "Everything in Launch System", "description": "Full foundation package included"},
    {"title": "Content Production", "description": "Filming, direction, and video editing"},
    {"title": "AI Automations", "description": "Lead capture, segmentation, nurture, sales"},
    {"title": "Script Optimization", "description": "Hooks, VSL, DM, upsells, follow-ups"},
    {"title": "Sales Process Work", "description": "Offer structure, objection handling, closing"},
    {"title": "Delivery Optimization", "description": "Onboarding, retention, upsells"},
    {"title": "Weekly Growth Review", "description": "KPI dashboard and strategy sessions"}
  ]',
  2
);

-- RLS
ALTER TABLE public.dwy_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages"
  ON public.dwy_packages FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Service role can manage packages"
  ON public.dwy_packages FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.3 Table: `dwy_applications`

Tracks creator applications for DWY packages.

```sql
CREATE TABLE public.dwy_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Applicant
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.dwy_packages(id) ON DELETE RESTRICT,

  -- Application details
  status dwy_application_status NOT NULL DEFAULT 'pending',

  -- Application form data
  business_name TEXT,
  business_type TEXT, -- e.g., 'course_creator', 'coach', 'consultant'
  current_revenue TEXT, -- e.g., '0-5k', '5k-20k', '20k-50k', '50k+'
  goals TEXT, -- What they want to achieve
  timeline TEXT, -- When they want to start
  website_url TEXT,
  social_links JSONB DEFAULT '{}', -- {"instagram": "...", "youtube": "..."}

  -- Additional context
  how_heard TEXT, -- How they found us
  additional_notes TEXT,

  -- Internal notes (admin only)
  internal_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Interview scheduling
  interview_scheduled_at TIMESTAMPTZ,
  interview_link TEXT,
  interview_notes TEXT,

  -- Decision
  decision_reason TEXT, -- Why approved/rejected

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Constraints
  CONSTRAINT dwy_applications_creator_package_unique UNIQUE (creator_id, package_id)
);

-- Indexes
CREATE INDEX idx_dwy_applications_creator ON public.dwy_applications(creator_id);
CREATE INDEX idx_dwy_applications_package ON public.dwy_applications(package_id);
CREATE INDEX idx_dwy_applications_status ON public.dwy_applications(status);
CREATE INDEX idx_dwy_applications_submitted ON public.dwy_applications(submitted_at DESC);

-- RLS
ALTER TABLE public.dwy_applications ENABLE ROW LEVEL SECURITY;

-- Creators can view their own applications
CREATE POLICY "Creators can view own applications"
  ON public.dwy_applications FOR SELECT
  USING (auth.uid() = creator_id);

-- Creators can submit new applications
CREATE POLICY "Creators can submit applications"
  ON public.dwy_applications FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Creators can update pending applications
CREATE POLICY "Creators can update pending applications"
  ON public.dwy_applications FOR UPDATE
  USING (auth.uid() = creator_id AND status = 'pending');

-- Service role can manage all applications
CREATE POLICY "Service role can manage applications"
  ON public.dwy_applications FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

### 1.4 Table: `dwy_engagements`

Tracks active DWY service engagements.

```sql
CREATE TABLE public.dwy_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.dwy_packages(id) ON DELETE RESTRICT,
  application_id UUID REFERENCES public.dwy_applications(id) ON DELETE SET NULL,

  -- Status
  status dwy_engagement_status NOT NULL DEFAULT 'onboarding',

  -- Timeline
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expected_end_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Service details
  scope_document_url TEXT, -- Link to scope/SOW document
  project_folder_url TEXT, -- Link to shared project folder
  slack_channel TEXT, -- Communication channel

  -- Assigned team
  account_manager_id UUID REFERENCES auth.users(id),

  -- Milestones/deliverables
  milestones JSONB DEFAULT '[]',
  -- Example: [
  --   {"name": "Discovery", "status": "completed", "completed_at": "..."},
  --   {"name": "Funnel Setup", "status": "in_progress", "due_at": "..."}
  -- ]

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_dwy_engagements_creator ON public.dwy_engagements(creator_id);
CREATE INDEX idx_dwy_engagements_status ON public.dwy_engagements(status);

-- RLS
ALTER TABLE public.dwy_engagements ENABLE ROW LEVEL SECURITY;

-- Creators can view their own engagements
CREATE POLICY "Creators can view own engagements"
  ON public.dwy_engagements FOR SELECT
  USING (auth.uid() = creator_id);

-- Service role can manage engagements
CREATE POLICY "Service role can manage engagements"
  ON public.dwy_engagements FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## 2. Application Flow

### 2.1 Creator Journey

```
1. Creator visits DWY Packages page
   ↓
2. Views package details (Launch System / Growth Partner)
   ↓
3. Clicks "Apply Now" on desired package
   ↓
4. Fills out application form:
   - Business info
   - Current revenue
   - Goals
   - Timeline
   - Links
   ↓
5. Submits application (status: 'pending')
   ↓
6. Receives confirmation email
   ↓
7. Application reviewed by team (status: 'under_review')
   ↓
8a. If qualified: Interview scheduled (status: 'interview_scheduled')
    ↓
    Discovery call happens
    ↓
    If good fit: Approved (status: 'approved')
    ↓
    Custom proposal sent
    ↓
    Payment processed (external)
    ↓
    Engagement created (status: 'converted')

8b. If not qualified: Rejected (status: 'rejected')
    ↓
    Rejection email with reason
```

### 2.2 Admin/Team Journey

```
1. New application notification
   ↓
2. Review application in admin panel
   ↓
3. Add internal notes
   ↓
4. Decision:
   - Schedule interview
   - Approve directly
   - Reject with reason
   ↓
5. If approved:
   - Send custom proposal
   - Create engagement on payment
   - Assign account manager
   ↓
6. Track engagement progress
   - Update milestones
   - Add notes
   - Mark completed
```

---

## 3. Service Layer

### 3.1 DWY Service

```typescript
// src/features/dwyPackages/dwyService.ts

import { supabase } from '@/lib/supabaseClient';
import type {
  DwyPackage,
  DwyApplication,
  DwyApplicationFormData,
  DwyEngagement
} from './dwyTypes';

export const dwyService = {
  // Packages
  async getPackages(): Promise<DwyPackage[]> {
    const { data, error } = await supabase
      .from('dwy_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data || [];
  },

  async getPackageByTier(tier: string): Promise<DwyPackage | null> {
    const { data, error } = await supabase
      .from('dwy_packages')
      .select('*')
      .eq('tier', tier)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Applications
  async submitApplication(
    packageId: string,
    formData: DwyApplicationFormData
  ): Promise<DwyApplication> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_applications')
      .insert({
        creator_id: user.id,
        package_id: packageId,
        ...formData,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getMyApplications(): Promise<DwyApplication[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_applications')
      .select('*, package:dwy_packages(*)')
      .eq('creator_id', user.id)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getApplicationById(id: string): Promise<DwyApplication | null> {
    const { data, error } = await supabase
      .from('dwy_applications')
      .select('*, package:dwy_packages(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async withdrawApplication(id: string): Promise<void> {
    const { error } = await supabase
      .from('dwy_applications')
      .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // Engagements
  async getMyEngagements(): Promise<DwyEngagement[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('dwy_engagements')
      .select('*, package:dwy_packages(*)')
      .eq('creator_id', user.id)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getEngagementById(id: string): Promise<DwyEngagement | null> {
    const { data, error } = await supabase
      .from('dwy_engagements')
      .select('*, package:dwy_packages(*)')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Check if creator has pending application for a package
  async hasPendingApplication(packageId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('dwy_applications')
      .select('id')
      .eq('creator_id', user.id)
      .eq('package_id', packageId)
      .in('status', ['pending', 'under_review', 'interview_scheduled', 'approved'])
      .single();

    if (error) return false;
    return !!data;
  },
};
```

---

## 4. UI Components

### 4.1 Component Structure

```
src/features/dwyPackages/
├── components/
│   ├── DwyPackagesPage.tsx       # Main packages overview
│   ├── PackageCard.tsx           # Individual package display
│   ├── ApplicationForm.tsx       # Application form modal/page
│   ├── ApplicationStatus.tsx     # Application tracking
│   ├── MyApplications.tsx        # List of user's applications
│   ├── EngagementDashboard.tsx   # Active engagement view
│   └── EngagementMilestones.tsx  # Milestone tracker
├── hooks/
│   ├── usePackages.ts
│   ├── useApplications.ts
│   └── useEngagements.ts
├── dwyService.ts
├── dwyTypes.ts
└── index.ts
```

### 4.2 DwyPackagesPage

```tsx
// src/features/dwyPackages/components/DwyPackagesPage.tsx

export function DwyPackagesPage() {
  const { packages, isLoading } = usePackages();
  const { applications } = useApplications();

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          Done-With-You Packages
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          For creators who want professional help building their marketing
          infrastructure. We work with a limited number of creators.
        </p>
      </div>

      {/* Package Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-16">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            package={pkg}
            hasApplication={applications.some(
              a => a.package_id === pkg.id &&
              ['pending', 'under_review', 'interview_scheduled', 'approved'].includes(a.status)
            )}
          />
        ))}
      </div>

      {/* Trust Section */}
      <div className="text-center bg-gray-50 rounded-2xl p-8">
        <p className="text-lg text-gray-700">
          We work with a limited number of creators.
          <br />
          If you're serious and want a system that drives revenue, apply now.
        </p>
      </div>
    </div>
  );
}
```

### 4.3 ApplicationForm

```tsx
// src/features/dwyPackages/components/ApplicationForm.tsx

interface ApplicationFormProps {
  package: DwyPackage;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ApplicationForm({ package, onSubmit, onCancel }: ApplicationFormProps) {
  const [formData, setFormData] = useState<DwyApplicationFormData>({
    business_name: '',
    business_type: '',
    current_revenue: '',
    goals: '',
    timeline: '',
    website_url: '',
    social_links: {},
    how_heard: '',
    additional_notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await dwyService.submitApplication(package.id, formData);
      onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">
          Apply for {package.name}
        </h2>
        <p className="text-gray-600">{package.tagline}</p>
      </div>

      {/* Business Info */}
      <div className="grid md:grid-cols-2 gap-4">
        <FormField
          label="Business Name"
          value={formData.business_name}
          onChange={(v) => setFormData(prev => ({ ...prev, business_name: v }))}
          required
        />
        <FormSelect
          label="Business Type"
          value={formData.business_type}
          onChange={(v) => setFormData(prev => ({ ...prev, business_type: v }))}
          options={[
            { value: 'course_creator', label: 'Course Creator' },
            { value: 'coach', label: 'Coach / Consultant' },
            { value: 'service_provider', label: 'Service Provider' },
            { value: 'community_builder', label: 'Community Builder' },
            { value: 'other', label: 'Other' },
          ]}
          required
        />
      </div>

      <FormSelect
        label="Current Monthly Revenue"
        value={formData.current_revenue}
        onChange={(v) => setFormData(prev => ({ ...prev, current_revenue: v }))}
        options={[
          { value: '0-5k', label: '€0 - €5,000' },
          { value: '5k-20k', label: '€5,000 - €20,000' },
          { value: '20k-50k', label: '€20,000 - €50,000' },
          { value: '50k+', label: '€50,000+' },
        ]}
        required
      />

      <FormTextarea
        label="What are your main goals?"
        value={formData.goals}
        onChange={(v) => setFormData(prev => ({ ...prev, goals: v }))}
        placeholder="What do you want to achieve? What problems are you facing?"
        rows={4}
        required
      />

      <FormSelect
        label="When do you want to start?"
        value={formData.timeline}
        onChange={(v) => setFormData(prev => ({ ...prev, timeline: v }))}
        options={[
          { value: 'asap', label: 'As soon as possible' },
          { value: '1_month', label: 'Within 1 month' },
          { value: '1_3_months', label: '1-3 months' },
          { value: 'exploring', label: 'Just exploring options' },
        ]}
        required
      />

      <FormField
        label="Website URL (if any)"
        value={formData.website_url}
        onChange={(v) => setFormData(prev => ({ ...prev, website_url: v }))}
        type="url"
        placeholder="https://"
      />

      <FormTextarea
        label="Anything else we should know?"
        value={formData.additional_notes}
        onChange={(v) => setFormData(prev => ({ ...prev, additional_notes: v }))}
        rows={3}
      />

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-4 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </form>
  );
}
```

---

## 5. Types

```typescript
// src/features/dwyPackages/dwyTypes.ts

export type DwyPackageTier = 'launch_system' | 'growth_partner';

export type DwyApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'converted';

export type DwyEngagementStatus =
  | 'onboarding'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface DwyPackageFeature {
  title: string;
  description: string;
}

export interface DwyPackage {
  id: string;
  tier: DwyPackageTier;
  name: string;
  tagline: string | null;
  description: string | null;
  features: DwyPackageFeature[];
  price_display: string | null;
  price_note: string | null;
  is_active: boolean;
  slots_available: number | null;
  display_order: number;
  highlight_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface DwyApplicationFormData {
  business_name: string;
  business_type: string;
  current_revenue: string;
  goals: string;
  timeline: string;
  website_url?: string;
  social_links?: Record<string, string>;
  how_heard?: string;
  additional_notes?: string;
}

export interface DwyApplication {
  id: string;
  creator_id: string;
  package_id: string;
  status: DwyApplicationStatus;
  business_name: string | null;
  business_type: string | null;
  current_revenue: string | null;
  goals: string | null;
  timeline: string | null;
  website_url: string | null;
  social_links: Record<string, string>;
  how_heard: string | null;
  additional_notes: string | null;
  internal_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  interview_scheduled_at: string | null;
  interview_link: string | null;
  interview_notes: string | null;
  decision_reason: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  package?: DwyPackage;
}

export interface DwyEngagementMilestone {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  due_at?: string;
  completed_at?: string;
}

export interface DwyEngagement {
  id: string;
  creator_id: string;
  package_id: string;
  application_id: string | null;
  status: DwyEngagementStatus;
  started_at: string;
  expected_end_at: string | null;
  completed_at: string | null;
  scope_document_url: string | null;
  project_folder_url: string | null;
  slack_channel: string | null;
  account_manager_id: string | null;
  milestones: DwyEngagementMilestone[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  package?: DwyPackage;
}
```

---

## 6. Integration Points

### 6.1 Settings/Dashboard Integration

Add DWY section to creator settings:

```tsx
// In CreatorSettings.tsx or Dashboard.tsx
import { MyApplications } from '@/features/dwyPackages';

// Show applications and engagements status
<DwySection>
  <MyApplications />
  <MyEngagements />
</DwySection>
```

### 6.2 Navigation

Add route for DWY Packages page:

```tsx
// In App.tsx routes
<Route path="/dwy-packages" element={<DwyPackagesPage />} />
<Route path="/dwy-packages/apply/:tier" element={<ApplicationPage />} />
```

### 6.3 Notifications

Future: Send email notifications for:
- Application received
- Application status changes
- Interview scheduled
- Application approved/rejected

---

## 7. Summary

The DWY Packages system provides:

1. **Package Display**: Clear presentation of Launch System and Growth Partner packages
2. **Application Process**: Structured form for creators to apply
3. **Status Tracking**: Creators can track their application status
4. **Engagement Management**: Track active service engagements and milestones

This is an application-based premium service, not self-service, reflecting the high-touch nature of Done-With-You services.
