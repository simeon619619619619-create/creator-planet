<div align="center">
<img width="1200" height="475" alt="Creator Club Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Creator Club™

An all-in-one platform for mentors, coaches, and course creators. Replaces Discord, Kajabi, Calendly, Skool, Zapier, and Whop with a unified experience plus an AI Success Manager.

## Live URLs

- **Production**: https://creatorclub.bg
- **Vercel Deployment**: https://creator-club.vercel.app

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe (Checkout, Billing, Connect)
- **AI**: Gemini API
- **Hosting**: Vercel

## Run Locally

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables in `.env.local`:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_key
   VITE_GEMINI_API_KEY=your_gemini_key
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Features

- **Community Hub** - Forums, channels, posts, paid communities
- **Course LMS** - Courses, modules, lessons with progress tracking
- **AI Success Manager** - Risk scoring, student health monitoring
- **Calendar & Events** - Group events, 1:1 booking
- **Direct Messaging** - Team-to-student communication
- **Payments** - Stripe subscriptions, one-time payments, Connect payouts

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed project context and architecture.
