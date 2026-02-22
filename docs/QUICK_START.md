# Creator Club - Quick Start Guide

## Get Running in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase
1. Go to [supabase.com](https://supabase.com) and create a project
2. Copy your project URL and anon key from Settings > API
3. Create `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
4. Add your credentials to `.env.local`:
   ```env
   VITE_SUPABASE_URL=your-url-here
   VITE_SUPABASE_ANON_KEY=your-key-here
   ```

### 3. Run Database Migration
1. Open Supabase Dashboard > SQL Editor
2. Copy contents from `supabase/migrations/001_profiles.sql`
3. Paste and click "Run"

### 4. Start the App
```bash
npm run dev
```

### 5. Create Your First User
1. Open http://localhost:5173
2. Click "Sign Up"
3. Fill in the form and select your role
4. Done! You're logged in.

## What You Can Do Now

- Sign up new users with different roles (Creator/Student)
- Log in and log out
- See your profile in the sidebar
- Access the main dashboard (protected route)

## What's Next

Phase 2 will add:
- Real database tables for courses, posts, events
- Wire existing UI to real data
- Student progress tracking
- Real-time updates

## Need Help?

- Full setup guide: `AUTH_SETUP.md`
- Implementation details: `PHASE_1_COMPLETE.md`
- Architecture docs: `docs/plans/2025-12-09-architecture.md`

## Troubleshooting

**App won't start?**
- Check that `.env.local` exists and has valid values
- Run `npm install` again

**Can't sign up?**
- Make sure you ran the migration SQL
- Check Supabase logs in Dashboard > Logs

**Email not sending?**
- In dev: Disable email confirmation in Auth > Settings
- In prod: Set up SMTP in Supabase settings
