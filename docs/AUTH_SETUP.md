# Supabase Authentication Setup Guide

## Overview
Phase 1 - Supabase Auth Integration has been successfully implemented for Creator Club. This guide will help you set up and configure authentication.

## What's Been Implemented

### 1. Authentication Components
- **LoginForm** (`/components/auth/LoginForm.tsx`): Email/password login with error handling
- **SignupForm** (`/components/auth/SignupForm.tsx`): Registration with role selection (creator/student)
- **ProtectedRoute** (`/components/auth/ProtectedRoute.tsx`): Route guard component for role-based access
- **AuthContext** (`/contexts/AuthContext.tsx`): Global auth state management

### 2. Database Schema
- **profiles table**: Extends auth.users with role, full_name, avatar_url, etc.
- **RLS Policies**: Row Level Security for data protection
- **Auto-trigger**: Automatically creates profile when user signs up

### 3. User Roles
- `superadmin`: Full system access
- `creator`: Can create courses, view all students
- `student`: Can enroll in courses, participate in community
- `member`: Basic access level

### 4. Auth Features
- Email/password authentication
- Role-based access control
- Profile management
- Last login tracking
- Automatic profile creation on signup
- Sign out functionality

## Setup Instructions

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new organization (if you don't have one)
4. Create a new project:
   - Enter a project name (e.g., "creator-club")
   - Enter a secure database password (save this!)
   - Select a region closest to your users
   - Click "Create new project"

### Step 2: Get Your API Keys
1. Once your project is created, go to Settings > API
2. Copy your project URL and anon/public key:
   - Project URL: `https://xxxxxxxxxxxxx.supabase.co`
   - Anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Step 3: Configure Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 4: Run the Database Migration
1. In your Supabase dashboard, go to the SQL Editor
2. Click "New query"
3. Copy the contents of `/supabase/migrations/001_profiles.sql`
4. Paste into the SQL editor
5. Click "Run" to execute the migration

This will create:
- `user_role` enum type
- `profiles` table
- Indexes for performance
- RLS policies for security
- Trigger function to auto-create profiles

### Step 5: Configure Email Settings (Optional)
By default, Supabase uses their email service. For production:
1. Go to Authentication > Email Templates
2. Customize your confirmation and password reset emails
3. For custom SMTP: Settings > Auth > SMTP Settings

### Step 6: Install Dependencies & Run
1. Install npm packages:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:5173](http://localhost:5173)

## Testing the Auth Flow

### Create a Test User
1. Open the app in your browser
2. Click "Sign Up"
3. Fill in the form:
   - Full Name: "Test Creator"
   - Email: "test@example.com"
   - Password: "password123"
   - Role: Select "Creator"
4. Click "Create Account"
5. Check your email for verification (in dev, you can disable this in Supabase settings)

### Verify User in Database
1. Go to Supabase Dashboard > Table Editor
2. Select the `profiles` table
3. You should see your new user with the role you selected

### Test Login
1. After verification, return to the app
2. Enter your email and password
3. Click "Sign In"
4. You should be logged in and see the dashboard

### Test Role-Based Access
The `ProtectedRoute` component supports role-based access:
```tsx
<ProtectedRoute allowedRoles={['creator', 'superadmin']}>
  <CreatorOnlyFeature />
</ProtectedRoute>
```

## Project Structure

```
/Users/bojodanchev/creator-club™/
├── components/
│   └── auth/
│       ├── LoginForm.tsx           # Login component
│       ├── SignupForm.tsx          # Signup component with role selection
│       └── ProtectedRoute.tsx      # Route guard for role-based access
├── contexts/
│   └── AuthContext.tsx             # Auth state management
├── lib/
│   └── supabase/
│       └── client.ts               # Supabase client configuration
├── supabase/
│   └── migrations/
│       └── 001_profiles.sql        # Database schema migration
├── types.ts                        # TypeScript types (includes Profile, UserRole)
├── .env.example                    # Environment variables template
└── .env.local                      # Your actual env vars (not in git)
```

## Next Steps

### Phase 2: Database Integration
- Wire up existing UI components to Supabase tables
- Implement courses, modules, lessons tables
- Add community posts and comments
- Create student progress tracking

### Phase 3: Stripe Payments
- Add subscription plans
- Implement 14-day trial
- Create webhook handlers
- Add payment UI

## Troubleshooting

### "Missing Supabase environment variables"
- Make sure `.env.local` exists and has the correct variables
- Restart your dev server after adding env vars

### Email not sending
- In development, disable email confirmation:
  - Go to Authentication > Settings
  - Turn off "Enable email confirmations"

### User can't sign in
- Check if email is confirmed in Supabase Auth > Users
- Click the user and confirm their email manually if needed

### RLS Policy errors
- Make sure you ran the migration SQL
- Check Supabase logs in Dashboard > Logs

## Security Notes

- Never commit `.env.local` to git (it's in `.gitignore`)
- The anon key is safe to use in the frontend
- RLS policies protect your data at the database level
- Passwords are hashed by Supabase automatically
- Use environment variables for all sensitive data

## Support

If you encounter issues:
1. Check the Supabase logs: Dashboard > Logs
2. Check browser console for errors
3. Verify your .env.local has correct values
4. Make sure the migration SQL ran successfully

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
