# Code Reference - Phase 1 Auth Implementation

## How to Use Auth in Components

### Using the Auth Hook
```typescript
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { user, profile, role, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>Welcome, {profile?.full_name}!</p>
      <p>Your role: {role}</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};
```

### Protecting Routes by Role
```typescript
import ProtectedRoute from '../components/auth/ProtectedRoute';

// Only creators and superadmins can access
<ProtectedRoute allowedRoles={['creator', 'superadmin']}>
  <CreatorDashboard />
</ProtectedRoute>

// All authenticated users can access
<ProtectedRoute>
  <StudentDashboard />
</ProtectedRoute>
```

### Checking User Role in Component Logic
```typescript
const { role } = useAuth();

// Show different UI based on role
{role === 'creator' && <CreatorTools />}
{role === 'student' && <StudentProgress />}
{(role === 'creator' || role === 'superadmin') && <AdminPanel />}
```

### Accessing User Data
```typescript
const { user, profile } = useAuth();

// From auth.users (Supabase Auth)
console.log(user?.id);        // User UUID
console.log(user?.email);     // User email

// From profiles table (our custom data)
console.log(profile?.full_name);   // Full name
console.log(profile?.role);        // User role
console.log(profile?.avatar_url);  // Avatar URL
console.log(profile?.created_at);  // Account creation date
console.log(profile?.last_login_at); // Last login timestamp
```

## Database Queries with Auth

### Query Data for Current User
```typescript
import { supabase } from '../lib/supabase/client';

// Get current user's courses
const { data, error } = await supabase
  .from('student_enrollments')
  .select('*, courses(*)')
  .eq('student_id', user.id);
```

### Query with RLS (Row Level Security)
```typescript
// RLS policies automatically filter data based on auth.uid()
// You don't need to add WHERE clauses for user_id if RLS is configured

// This automatically only returns current user's data (if RLS policy is set)
const { data } = await supabase
  .from('profiles')
  .select('*')
  .single();
```

### Insert Data with Current User
```typescript
// Create a post as current user
const { data, error } = await supabase
  .from('posts')
  .insert({
    author_id: user.id,
    content: 'Hello world!',
    created_at: new Date().toISOString()
  });
```

## Auth State Management

### AuthContext Provides:
```typescript
interface AuthContextType {
  user: User | null;              // Supabase auth user
  profile: Profile | null;        // Our custom profile data
  role: UserRole | null;          // User's role
  session: Session | null;        // Current session
  isLoading: boolean;             // Loading state
  signIn: (email, password) => Promise<{error}>;
  signUp: (email, password, fullName, role) => Promise<{error}>;
  signOut: () => Promise<void>;
}
```

### Auth State Changes are Automatic
The AuthContext automatically:
- Listens for auth state changes
- Fetches user profile when user logs in
- Updates last_login_at timestamp
- Clears state when user logs out
- Handles session refresh

## Common Patterns

### Show Content Only for Certain Roles
```typescript
const { role } = useAuth();

return (
  <div>
    {/* Everyone sees this */}
    <Dashboard />

    {/* Only creators see this */}
    {role === 'creator' && (
      <button>Create Course</button>
    )}

    {/* Only students see this */}
    {role === 'student' && (
      <EnrollmentButton />
    )}

    {/* Admins and creators see this */}
    {(role === 'superadmin' || role === 'creator') && (
      <Analytics />
    )}
  </div>
);
```

### Loading States
```typescript
const { isLoading, user } = useAuth();

if (isLoading) {
  return <LoadingSpinner />;
}

if (!user) {
  return <LoginPrompt />;
}

return <MainApp />;
```

### Error Handling in Auth Forms
```typescript
const [error, setError] = useState<string | null>(null);

const handleSignIn = async (e) => {
  e.preventDefault();
  setError(null);

  const { error: signInError } = await signIn(email, password);

  if (signInError) {
    setError(signInError.message);
  }
};

// In JSX
{error && (
  <div className="error-message">
    {error}
  </div>
)}
```

## TypeScript Types

### Available Types
```typescript
import { UserRole, Profile } from './types';

// UserRole is a union type
type UserRole = 'superadmin' | 'creator' | 'student' | 'member';

// Profile interface
interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  created_at: string;
  last_login_at: string | null;
}
```

### Component Props with Auth
```typescript
interface DashboardProps {
  userRole: UserRole;
  userName: string;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole, userName }) => {
  // ...
};

// Usage
const { role, profile } = useAuth();
<Dashboard userRole={role!} userName={profile?.full_name || 'User'} />
```

## Supabase Client Usage

### Import the Client
```typescript
import { supabase } from '../lib/supabase/client';
```

### Common Operations
```typescript
// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Get current session
const { data: { session } } = await supabase.auth.getSession();

// Update user email
const { error } = await supabase.auth.updateUser({ email: newEmail });

// Update profile
const { error } = await supabase
  .from('profiles')
  .update({ full_name: 'New Name' })
  .eq('user_id', user.id);
```

## Environment Variables

### Available Variables
```typescript
// In any component or service
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// TypeScript: Add to vite-env.d.ts if you want types
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}
```

## Next Steps for Phase 2

### Add Real Data Fetching
```typescript
// Example: Fetch courses from database
const [courses, setCourses] = useState([]);

useEffect(() => {
  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('creator_id', user.id);

    setCourses(data || []);
  };

  fetchCourses();
}, [user]);
```

### Add Real-Time Subscriptions
```typescript
// Listen for new posts
useEffect(() => {
  const channel = supabase
    .channel('posts')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'posts' },
      (payload) => {
        setPosts(prev => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

## Tips and Best Practices

1. **Always check isLoading** before rendering auth-dependent UI
2. **Use ProtectedRoute** for entire page components
3. **Use role checks** for granular UI elements
4. **Handle errors** in all auth operations
5. **Update .env.local** but never commit it
6. **Test with different roles** to ensure proper access control
7. **Use RLS policies** instead of manual user_id filters when possible
8. **Keep auth logic in AuthContext** - don't duplicate it
9. **Profile data auto-updates** - no need to manually refresh
10. **Sign out clears all state** - redirect users appropriately

## Common Issues and Solutions

### Issue: "Missing Supabase environment variables"
**Solution**: Create `.env.local` with your Supabase credentials

### Issue: Can't fetch profile data
**Solution**: Make sure migration SQL ran and RLS policies are set correctly

### Issue: User sees "Access Denied"
**Solution**: Check the user's role in database matches required roles

### Issue: Auth state not updating
**Solution**: AuthContext listens automatically - make sure you're using `useAuth()` hook

### Issue: Can't query data
**Solution**: Check RLS policies - they might be blocking access
