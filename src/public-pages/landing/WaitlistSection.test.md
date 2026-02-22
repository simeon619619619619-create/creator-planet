# WaitlistSection Testing Guide

## Manual Testing Checklist

### 1. Visual Verification

#### Layout & Design
- [ ] Section has gradient background (indigo to purple)
- [ ] Content is centered with max-width constraint
- [ ] Heading and subtitle are visible and properly styled
- [ ] All form fields are properly aligned
- [ ] Icons appear in correct positions (left side of inputs)
- [ ] Dropdown has two chevron icons (left and right)
- [ ] Submit button spans full width
- [ ] Privacy text appears below form

#### Responsive Design
- [ ] Mobile view (< 768px): Heading size adjusts properly
- [ ] Mobile view: Form is usable on small screens
- [ ] Tablet view: All elements remain centered
- [ ] Desktop view: Max width constraint works
- [ ] Touch targets are at least 44px × 44px

### 2. Form Functionality

#### Email Field
- [ ] Shows mail icon on the left
- [ ] Placeholder text: "you@example.com"
- [ ] Accepts valid email formats
- [ ] Required field validation works
- [ ] HTML5 type="email" validation triggers
- [ ] Focus state shows ring effect

#### Name Field
- [ ] Shows user icon on the left
- [ ] Placeholder text: "Your name (optional)"
- [ ] Optional field (can submit without it)
- [ ] Accepts text input
- [ ] Focus state shows ring effect

#### Interest Dropdown
- [ ] Shows chevron icon on the left
- [ ] Shows second chevron icon on the right
- [ ] Has 5 options visible when opened
- [ ] Options: Creator, Coach, Mentor, Student, Other
- [ ] Default selection works
- [ ] Can change selection
- [ ] Focus state shows ring effect

#### Submit Button
- [ ] Shows "Join Waitlist" text with arrow icon
- [ ] Arrow moves right on hover
- [ ] Click triggers form submission
- [ ] Changes to loading state during submission
- [ ] Shows spinner and "Joining..." during loading
- [ ] Disabled during submission

### 3. State Management

#### Idle State (Initial)
- [ ] All fields are empty (except interest dropdown)
- [ ] No error messages visible
- [ ] No success message visible
- [ ] Submit button is enabled
- [ ] Form is interactive

#### Submitting State
- [ ] Triggered on form submit
- [ ] All fields become disabled
- [ ] Submit button shows spinner
- [ ] Submit button text changes to "Joining..."
- [ ] Submit button is disabled
- [ ] No form interaction possible

#### Success State
- [ ] Form disappears
- [ ] Green checkmark icon appears
- [ ] "You're on the list!" heading shows
- [ ] Success message shows
- [ ] After 3 seconds, form reappears
- [ ] Form is reset to initial state

#### Error State
- [ ] Red error banner appears
- [ ] Alert icon shows in banner
- [ ] Error message is displayed
- [ ] Form remains visible
- [ ] Fields remain enabled
- [ ] Can retry submission

### 4. Email Validation

#### Valid Emails (Should Accept)
- [ ] `user@example.com`
- [ ] `test.user@domain.co.uk`
- [ ] `user+tag@example.com`
- [ ] `user123@sub.domain.com`
- [ ] `u@d.io`

#### Invalid Emails (Should Reject)
- [ ] `invalidemail` (no @)
- [ ] `@example.com` (no local part)
- [ ] `user@` (no domain)
- [ ] `user @example.com` (space)
- [ ] `user@.com` (invalid domain)

### 5. Error Handling

#### Client-Side Errors
- [ ] Empty email: Shows HTML5 required message
- [ ] Invalid email format: Shows "Please enter a valid email address"
- [ ] Error banner appears with shake animation

#### Server-Side Errors
- [ ] Duplicate email: Shows "This email is already on the waitlist!"
- [ ] Database error: Shows generic error message
- [ ] Network error: Shows generic error message
- [ ] Error banner appears with alert icon

### 6. Callbacks

#### onSuccess Callback
```tsx
<WaitlistSection
  onSuccess={(result) => {
    console.log('Success called');
    console.log('Data:', result.data);
    console.log('Email:', result.data?.email);
  }}
/>
```
- [ ] Called after successful submission
- [ ] Receives WaitlistResult with data
- [ ] Data contains all submitted fields
- [ ] success flag is true

#### onError Callback
```tsx
<WaitlistSection
  onError={(error) => {
    console.error('Error called');
    console.error('Message:', error.message);
    console.error('Error code:', error.error);
  }}
/>
```
- [ ] Called after failed submission
- [ ] Receives WaitlistResult with error
- [ ] Error message is descriptive
- [ ] success flag is false

### 7. Database Integration

#### Before First Test
- [ ] Supabase project is created
- [ ] Environment variables are set
- [ ] Migration script has been run
- [ ] `waitlist` table exists
- [ ] RLS policies are enabled

#### Successful Submission
- [ ] New row appears in `waitlist` table
- [ ] Email is stored in lowercase
- [ ] Name is stored (or null if not provided)
- [ ] Interest is stored correctly
- [ ] Source is "landing_page"
- [ ] created_at timestamp is set
- [ ] UUID is generated for id

#### Duplicate Prevention
- [ ] Submit same email twice
- [ ] Second submission shows error
- [ ] Only one row exists in database
- [ ] Error message is clear

### 8. Accessibility

#### Keyboard Navigation
- [ ] Tab through all fields in order
- [ ] Enter submits form from any field
- [ ] Escape does not clear form (expected)
- [ ] Arrow keys work in dropdown
- [ ] Focus visible on all elements

#### Screen Readers
- [ ] Form has implicit label from placeholder
- [ ] Required fields are announced
- [ ] Error messages are associated with fields
- [ ] Success message is announced
- [ ] Loading state is announced

#### Color Contrast
- [ ] White text on gradient background (WCAG AA)
- [ ] Placeholder text is readable
- [ ] Error text is readable
- [ ] All states have sufficient contrast

### 9. Performance

#### Load Time
- [ ] Component renders in < 100ms
- [ ] No layout shift during load
- [ ] Icons load quickly

#### Submission
- [ ] Form submits in < 2 seconds
- [ ] Loading spinner appears immediately
- [ ] No double submission possible
- [ ] No race conditions

#### Memory
- [ ] No memory leaks after multiple submissions
- [ ] Timeout is cleared on unmount
- [ ] Event listeners are cleaned up

### 10. Edge Cases

#### Empty Submission
- [ ] Empty form shows validation errors
- [ ] HTML5 required validation prevents submission

#### Long Inputs
- [ ] Email with 100+ characters
- [ ] Name with 100+ characters
- [ ] Input fields don't break layout

#### Special Characters
- [ ] Email with + symbol
- [ ] Name with accents (é, ñ, ü)
- [ ] Name with apostrophe (O'Brien)
- [ ] Name with hyphen (Mary-Jane)

#### Network Issues
- [ ] Offline: Shows error message
- [ ] Slow connection: Shows loading state
- [ ] Timeout: Shows error message
- [ ] Retry after error: Works correctly

#### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari
- [ ] Mobile Chrome

## Automated Testing (Future)

### Unit Tests (Jest/Vitest)
```typescript
describe('WaitlistSection', () => {
  test('renders form in idle state')
  test('validates email format')
  test('shows error for invalid email')
  test('disables form during submission')
  test('calls onSuccess callback on success')
  test('calls onError callback on error')
  test('shows success state after submission')
  test('resets form after 3 seconds')
  test('prevents duplicate submissions')
})
```

### Integration Tests (React Testing Library)
```typescript
describe('WaitlistSection integration', () => {
  test('full submission flow')
  test('error handling flow')
  test('keyboard navigation')
  test('accessibility checks')
})
```

### E2E Tests (Playwright/Cypress)
```typescript
describe('Waitlist E2E', () => {
  test('user can join waitlist')
  test('duplicate email shows error')
  test('invalid email shows error')
  test('success message appears')
  test('data saved to database')
})
```

## Performance Benchmarks

### Target Metrics
- **First Render:** < 100ms
- **Time to Interactive:** < 200ms
- **Submission Time:** < 2s (95th percentile)
- **Bundle Size:** < 10kb (component only)

### Load Testing
- [ ] 100 concurrent submissions
- [ ] 1000 submissions per minute
- [ ] Database query time < 50ms
- [ ] No rate limiting issues

## Security Checklist

### Input Validation
- [ ] Email sanitized on client
- [ ] Email sanitized on server
- [ ] SQL injection prevented (Supabase handles this)
- [ ] XSS prevented (React escapes by default)

### Data Protection
- [ ] Emails stored in lowercase
- [ ] No PII in URLs
- [ ] No sensitive data in console logs (production)
- [ ] HTTPS enforced (via Supabase)

### Rate Limiting
- [ ] Supabase RLS policies active
- [ ] Anonymous users can only INSERT
- [ ] Cannot query other entries
- [ ] Cannot delete or update

## Troubleshooting

### Form doesn't submit
1. Check browser console for errors
2. Verify Supabase env vars are set
3. Check network tab for API calls
4. Verify RLS policies allow INSERT

### Success state doesn't show
1. Check if submitWaitlist returns success:true
2. Verify onSuccess callback is called
3. Check console for errors

### Animations don't work
1. Verify index.css is loaded
2. Check if custom animations are defined
3. Inspect element for class names

### Styles look wrong
1. Verify Tailwind CDN is loaded
2. Check for CSS conflicts
3. Inspect computed styles

## Sign-off

### Developer Checklist
- [ ] All manual tests passed
- [ ] Callbacks tested
- [ ] Database integration verified
- [ ] Documentation reviewed
- [ ] Edge cases handled

### QA Checklist
- [ ] Visual design matches specs
- [ ] Responsive design works
- [ ] All browsers tested
- [ ] Accessibility verified
- [ ] Performance acceptable

### Product Checklist
- [ ] User flow is intuitive
- [ ] Error messages are helpful
- [ ] Success state is satisfying
- [ ] Analytics tracking ready
- [ ] Ready for production

---

**Test Date:** _______________
**Tested By:** _______________
**Environment:** _______________
**Result:** [ ] Pass [ ] Fail
**Notes:** _______________
