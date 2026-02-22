# Creator Club™ Translation Checklist

This document tracks all screens, components, and UI elements that need internationalization (i18n) support for English and Bulgarian.

## Status Legend
- ✅ = Fully translated (keys exist in en.json & bg.json, component wired)
- 🟡 = Partially translated (some keys exist)
- ❌ = Not translated (hardcoded English)

---

## 1. PUBLIC PAGES (Unauthenticated)

### Landing Pages
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Marketing Landing | `public-pages/MarketingLandingPage.tsx` | ✅ | `marketingLanding.*` keys |
| Whop-style Landing | `public-pages/WhopLandingPage.tsx` | ✅ | `whopLanding.*` keys |
| Course Catalog (Explore) | `features/landing/LandingPage.tsx` | ✅ | `exploreLanding.*` keys |
| Original Landing | `public-pages/LandingPage.tsx` | 🟡 | Uses `hero.*`, `painPoints.*` |
| Hero Section | `public-pages/landing/HeroSection.tsx` | ❌ | |
| Pain Section | `public-pages/landing/PainSection.tsx` | ❌ | |
| Promise Section | `public-pages/landing/PromiseSection.tsx` | ❌ | |
| Features Section | `public-pages/landing/FeaturesSection.tsx` | ❌ | |
| VSL Section | `public-pages/landing/VSLSection.tsx` | ❌ | |
| Waitlist Section | `public-pages/landing/WaitlistSection.tsx` | ❌ | |

### Communities (Public)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Communities Directory | `public-pages/communities/CommunitiesDirectory.tsx` | ✅ | Uses `publicCommunities.directory.*` keys |
| Community Landing Page | `public-pages/communities/CommunityLandingPage.tsx` | ✅ | Uses `publicCommunities.landing.*` keys |
| Community Card | `public-pages/communities/CommunityCard.tsx` | ✅ | Uses `publicCommunities.card.*` keys |
| Join Button | `public-pages/communities/JoinButton.tsx` | ✅ | Uses `publicCommunities.join.*` keys |
| Public Navigation | `public-pages/communities/PublicNavigation.tsx` | ✅ | Uses `publicCommunities.nav.*` keys |
| Public Layout | `public-pages/communities/PublicLayout.tsx` | ✅ | Uses `publicCommunities.footer.*` keys |

### Pricing
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Pricing Page | `features/billing/pages/PricingPage.tsx` | ✅ | Uses `billing.pricing.*` keys |

---

## 2. AUTHENTICATION

| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Login Page | `features/auth/LoginPage.tsx` | ✅ | Uses `auth.*` keys |
| Signup Page | `features/auth/SignupPage.tsx` | ✅ | Uses `auth.*` keys |
| Login Form | `public-pages/auth/LoginForm.tsx` | 🟡 | |
| Signup Form | `public-pages/auth/SignupForm.tsx` | 🟡 | |
| Protected Route | `public-pages/auth/ProtectedRoute.tsx` | ❌ | Error messages |

---

## 3. CREATOR ONBOARDING

| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Creator Onboarding Page | `features/creator-onboarding/pages/CreatorOnboardingPage.tsx` | ✅ | Uses `onboarding.*` keys |
| Onboarding Question | `features/creator-onboarding/components/OnboardingQuestion.tsx` | ✅ | |
| Onboarding Progress | `features/creator-onboarding/components/OnboardingProgress.tsx` | ❌ | |
| Preview Screen | `features/creator-onboarding/components/PreviewScreen.tsx` | ✅ | Uses `onboarding.preview.*` |
| Summary Screen | `features/creator-onboarding/components/SummaryScreen.tsx` | ✅ | Uses `onboarding.summary.*` |
| Inline Signup Form | `features/creator-onboarding/components/InlineSignupForm.tsx` | ✅ | Uses `onboarding.signup.*` |
| Post-signup Onboarding | `features/billing/pages/OnboardingPage.tsx` | ✅ | Uses `billing.onboarding.*` keys |

---

## 4. CREATOR SIDE (Protected)

### Dashboard
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Dashboard | `features/dashboard/Dashboard.tsx` | ✅ | Uses `creatorDashboard.*` keys |
| Tasks Panel | `features/dashboard/TasksPanel.tsx` | ✅ | Uses `creatorDashboard.tasks.*` keys |

### Community Management
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Community Hub | `features/community/CommunityHub.tsx` | ✅ | Uses `communityHub.*` keys |
| User Profile Popup | `features/community/UserProfilePopup.tsx` | ✅ | Uses `communityHub.userProfile.*` keys |
| Community Pricing Settings | `features/community/components/CommunityPricingSettings.tsx` | ✅ | Uses `communityHub.pricing.*` keys |
| Group Manager | `features/community/components/GroupManager.tsx` | ✅ | Uses `communityHub.groups.*` keys |
| Group Folder Section | `features/community/components/GroupFolderSection.tsx` | ✅ | Uses `communityHub.folders.*` keys |
| Group Member Assigner | `features/community/components/GroupMemberAssigner.tsx` | ✅ | Uses `communityHub.memberAssigner.*` keys |

### Course Management (Creator View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Course LMS | `features/courses/CourseLMS.tsx` | ✅ | Uses `courseLms.*` keys |
| Course Edit Modal | `features/courses/components/CourseEditModal.tsx` | ❌ | |
| Module Edit Modal | `features/courses/components/ModuleEditModal.tsx` | ❌ | |
| Lesson Edit Modal | `features/courses/components/LessonEditModal.tsx` | ❌ | |
| Course Analytics Panel | `features/courses/components/CourseAnalyticsPanel.tsx` | ❌ | |
| Quiz Builder | `features/courses/components/QuizBuilder.tsx` | ❌ | |
| Course AI Helper | `features/courses/CourseAiHelper.tsx` | ❌ | |

### Homework Management (Creator View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Homework Management | `features/homework/HomeworkManagement.tsx` | ✅ | Uses `homeworkManagement.*` keys |
| Assignment Edit Modal | `features/homework/AssignmentEditModal.tsx` | ✅ | Uses `homeworkManagement.assignmentModal.*` keys |
| Grading Modal | `features/homework/GradingModal.tsx` | ✅ | Uses `homeworkManagement.gradingModal.*` keys |

### Calendar (Creator View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Calendar View | `features/calendar/CalendarView.tsx` | ✅ | Uses `calendar.*` keys |
| Calendar Header | `features/calendar/components/CalendarHeader.tsx` | ❌ | |
| Day Cell | `features/calendar/components/DayCell.tsx` | ❌ | |
| Expanded Month View | `features/calendar/components/ExpandedMonthView.tsx` | ❌ | |

### AI Manager (Creator Only)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| AI Success Manager | `features/ai-manager/AiSuccessManager.tsx` | ✅ | Uses `aiManager.*` keys |

### Student Manager (Creator Only)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Student Manager Page | `features/student-manager/StudentManagerPage.tsx` | ✅ | Uses `studentManager.*` keys |

### Chatbots (Creator View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Chatbots Page | `features/chatbots/ChatbotsPage.tsx` | ✅ | Uses `chatbots.page.*` keys |
| Chatbot Edit Modal | `features/chatbots/ChatbotEditModal.tsx` | ✅ | Uses `chatbots.editModal.*` keys |
| Chatbot Settings | `features/chatbots/ChatbotSettings.tsx` | ✅ | Uses `chatbots.settings.*` keys |
| Chat History Sidebar | `features/chatbots/ChatHistorySidebar.tsx` | ✅ | Uses `chatbots.history.*` keys |
| Chatbot Conversation | `features/chatbots/ChatbotConversation.tsx` | ✅ | Uses `chatbots.conversation.*` keys |

### Discounts (Creator Only)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Discounts Page | `features/discounts/DiscountsPage.tsx` | ✅ | Uses `discounts.*` keys |
| Create Discount Modal | `features/discounts/components/CreateDiscountModal.tsx` | ✅ | Uses `discounts.modal.*` keys |
| Discount Code Input | `features/discounts/components/DiscountCodeInput.tsx` | ✅ | Uses `discounts.input.*` keys |

### Billing (Creator)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Billing Settings Page | `features/billing/pages/BillingSettingsPage.tsx` | ✅ | Uses `billing.settings.*` keys |
| Plan Card | `features/billing/components/PlanCard.tsx` | ✅ | Uses `billing.plans.*` keys |
| Plan Gate | `features/billing/components/PlanGate.tsx` | ✅ | Uses `billing.gate.*` keys |
| Upgrade Modal | `features/billing/components/UpgradeModal.tsx` | ✅ | Uses `billing.upgradeModal.*` keys |
| Upgrade Prompt | `features/billing/components/UpgradePrompt.tsx` | ✅ | Uses `billing.upgradePrompt.*` keys |

### Settings (Creator)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Settings | `features/settings/Settings.tsx` | ✅ | Uses `creatorSettings.tabs.*` keys |
| Profile Settings | `features/settings/ProfileSettings.tsx` | ✅ | Uses `creatorSettings.profile.*` keys |
| Account Settings | `features/settings/AccountSettings.tsx` | ✅ | Uses `creatorSettings.account.*` keys |
| Creator Settings | `features/settings/CreatorSettings.tsx` | ✅ | Uses `creatorSettings.creator.*` keys |
| Image Crop Modal | `features/settings/ImageCropModal.tsx` | ✅ | Uses `imageCrop.*` keys |

---

## 5. STUDENT SIDE (Protected)

### Student Home
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Student Home | `features/student/StudentHome.tsx` | ✅ | Uses `studentHome.*` keys |

### Courses (Student View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Course LMS (Student) | `features/courses/CourseLMS.tsx` | ✅ | Uses `courseLms.*` keys |
| Course Enroll Button | `features/courses/components/CourseEnrollButton.tsx` | ❌ | |
| Course Purchase Modal | `features/courses/components/CoursePurchaseModal.tsx` | ❌ | |
| Quiz Player | `features/courses/components/QuizPlayer.tsx` | ❌ | |
| Video Player | `features/courses/components/VideoPlayer.tsx` | ❌ | |

### Homework (Student View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Homework Page | `features/homework/HomeworkPage.tsx` | ✅ | Uses `homework.*` keys |
| Homework Submission Modal | `features/homework/HomeworkSubmissionModal.tsx` | ❌ | |

### Calendar (Student View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Calendar View | `features/calendar/CalendarView.tsx` | ✅ | Uses `calendar.*` keys |

### Chatbots (Student View)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Chatbots Page | `features/chatbots/ChatbotsPage.tsx` | ✅ | Uses `chatbots.page.*` keys |
| Chatbot Conversation | `features/chatbots/ChatbotConversation.tsx` | ✅ | Uses `chatbots.conversation.*` keys |

### Student Plus (Loyalty)
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Student Plus Page | `features/studentPlus/components/StudentPlusPage.tsx` | ✅ | Uses `studentPlus.page.*` keys |
| Rewards Page | `features/studentPlus/components/RewardsPage.tsx` | ✅ | Uses `studentPlus.rewards.*` keys |
| Loyalty Dashboard | `features/studentPlus/components/LoyaltyDashboard.tsx` | ✅ | Uses `studentPlus.dashboard.*` keys |
| Milestone Progress | `features/studentPlus/components/MilestoneProgress.tsx` | ✅ | Uses `studentPlus.milestones.*` keys |
| Points History | `features/studentPlus/components/PointsHistory.tsx` | ✅ | Uses `studentPlus.history.*` keys |
| Redemption Card | `features/studentPlus/components/RedemptionCard.tsx` | ✅ | Uses `studentPlus.redemption.*` keys |
| Reward Card | `features/studentPlus/components/RewardCard.tsx` | ✅ | Uses `studentPlus.rewardCard.*` keys |
| Subscription Status | `features/studentPlus/components/SubscriptionStatus.tsx` | ✅ | Uses `studentPlus.subscription.*` keys |

### DWY Packages
| Screen | File | Status | Notes |
|--------|------|--------|-------|
| DWY Packages Page | `features/dwyPackages/components/DwyPackagesPage.tsx` | ✅ | Uses `dwyPackages.page.*` keys |
| Package Card | `features/dwyPackages/components/PackageCard.tsx` | ✅ | Uses `dwyPackages.packageCard.*` keys |
| Application Form | `features/dwyPackages/components/ApplicationForm.tsx` | ✅ | Uses `dwyPackages.applicationForm.*` keys |
| Application Status | `features/dwyPackages/components/ApplicationStatus.tsx` | ✅ | Uses `dwyPackages.applicationStatus.*` keys |
| My Applications | `features/dwyPackages/components/MyApplications.tsx` | ✅ | Uses `dwyPackages.myApplications.*` keys |
| Engagement Dashboard | `features/dwyPackages/components/EngagementDashboard.tsx` | ✅ | Uses `dwyPackages.engagementDashboard.*` keys |
| Engagement Milestones | `features/dwyPackages/components/EngagementMilestones.tsx` | ✅ | Uses `dwyPackages.engagementMilestones.*` keys |

---

## 6. SHARED COMPONENTS

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Sidebar | `shared/Sidebar.tsx` | ✅ | Uses `sidebar.*` keys |
| Avatar | `shared/Avatar.tsx` | ❌ | Alt text, fallback |
| Community Switcher | `shared/CommunitySwitcher.tsx` | ❌ | |
| Language Switcher | `shared/LanguageSwitcher.tsx` | ✅ | Uses `languages.*` keys |
| Logo | `shared/Logo.tsx` | ❌ | Alt text only |

---

## 7. EXISTING TRANSLATION KEYS (en.json)

The following translation namespaces already exist and are working:

| Namespace | Used By | Status |
|-----------|---------|--------|
| `common.*` | Various | ✅ Complete |
| `nav.*` | Navigation | ✅ Complete |
| `hero.*` | Landing pages | ✅ Complete |
| `painPoints.*` | Landing pages | ✅ Complete |
| `solution.*` | Landing pages | ✅ Complete |
| `features.*` | Landing pages | ✅ Complete |
| `testimonials.*` | Landing pages | ✅ Complete |
| `pricing.*` | Pricing section | ✅ Complete |
| `cta.*` | Call to action | ✅ Complete |
| `footer.*` | Footer | ✅ Complete |
| `auth.*` | Login/Signup | ✅ Complete |
| `sidebar.*` | Sidebar nav | ✅ Complete |
| `dashboard.*` | Dashboard | 🟡 Partial |
| `creatorDashboard.*` | Creator Dashboard | ✅ Complete |
| `homeworkManagement.*` | Homework Management | ✅ Complete |
| `courses.*` | Courses | 🟡 Partial |
| `community.*` | Community | 🟡 Partial |
| `communityHub.*` | Community Hub | ✅ Complete |
| `chatbots.*` | AI Chatbots | ✅ Complete |
| `publicCommunities.*` | Public Communities | ✅ Complete |
| `calendar.*` | Calendar | ✅ Complete |
| `settings.*` | Settings | ✅ Complete |
| `creatorSettings.*` | Creator Settings | ✅ Complete |
| `imageCrop.*` | Image Crop Modal | ✅ Complete |
| `billing.*` | Billing | ✅ Complete |
| `discounts.*` | Discounts | ✅ Complete |
| `aiManager.*` | AI Manager | ✅ Complete |
| `studentHome.*` | Student Home | ✅ Complete |
| `courseLms.*` | Course LMS | ✅ Complete |
| `homework.*` | Homework | ✅ Complete |
| `languages.*` | Language switcher | ✅ Complete |
| `loading.*` | Loading states | ✅ Complete |
| `errors.*` | Error messages | 🟡 Partial |
| `onboarding.*` | Creator onboarding | ✅ Complete |
| `whopLanding.*` | Whop landing | ✅ Complete |
| `marketingLanding.*` | Marketing landing | ✅ Complete |
| `exploreLanding.*` | Explore/Catalog | ✅ Complete |
| `studentPlus.*` | Student Plus loyalty | ✅ Complete |
| `dwyPackages.*` | DWY Packages | ✅ Complete |
| `studentManager.*` | Student Manager | ✅ Complete |

---

## 8. NAMESPACES NEEDED (To Be Created)

Based on the untranslated components, these namespaces need to be added:

### Creator-Specific
- [x] `creatorDashboard.*` - Creator dashboard stats, actions
- [x] `communityHub.*` - Community management, posts, channels
- [ ] `courseManagement.*` - Course creation, editing
- [x] `homeworkManagement.*` - Assignment creation, grading
- [x] `calendar.*` - Events, scheduling
- [x] `aiManager.*` - AI insights, risk scores
- [x] `studentManager.*` - Student management
- [x] `chatbots.*` - Chatbot creation, settings
- [x] `discounts.*` - Discount codes
- [x] `billing.*` - Plans, subscriptions
- [x] `creatorSettings.*` - Creator-specific settings

### Student-Specific
- [x] `studentHome.*` - Student dashboard
- [x] `courseLms.*` - Course viewing, progress
- [x] `homework.*` - Homework submission
- [x] `studentPlus.*` - Loyalty, rewards
- [x] `dwyPackages.*` - Done-with-you packages

### Shared
- [x] `publicCommunities.*` - Public community pages
- [ ] `modals.*` - Common modal strings
- [ ] `forms.*` - Form labels, validation
- [ ] `dates.*` - Date formatting strings
- [ ] `notifications.*` - Toast messages

---

## 9. IMPLEMENTATION ORDER (Recommended)

### Phase 1: Core Student Experience
1. [x] Student Home
2. [x] Course LMS (Student View)
3. [x] Homework Page (Student)
4. [x] Calendar View (Student)

### Phase 2: Core Creator Experience
1. [x] Dashboard (Creator)
2. [x] Course LMS (Creator View)
3. [x] Homework Management
4. [x] Calendar View (Creator)

### Phase 3: Community Features
1. [x] Community Hub
2. [x] Chatbots
3. [x] Public Community Pages

### Phase 4: Business Features
1. [x] Billing Pages
2. [x] Settings (All tabs)
3. [x] Discounts
4. [x] AI Manager

### Phase 5: Advanced Features
1. [x] Student Plus
2. [x] DWY Packages
3. [x] Student Manager

### Phase 6: Polish
1. [ ] All error messages
2. [ ] All loading states
3. [ ] All empty states
4. [ ] All confirmation dialogs

---

## 10. NOTES

### Best Practices
1. **Add keys first**: Always add translation keys to BOTH en.json and bg.json BEFORE modifying components
2. **Test both languages**: Switch to Bulgarian and verify all strings display correctly
3. **Use namespaces**: Keep related translations grouped (e.g., `calendar.events.title`)
4. **Avoid dynamic keys**: Don't construct keys like `t(\`status.${status}\`)` - use explicit mappings
5. **Include plurals**: Bulgarian has different plural rules - plan for this

### Common String Patterns
- Page titles
- Section headers
- Button labels
- Form labels & placeholders
- Error messages
- Success messages
- Empty state messages
- Confirmation dialogs
- Tooltips
- Loading states

### Files to Update Together
When translating a feature, update these files:
1. `src/i18n/locales/en.json` - English translations
2. `src/i18n/locales/bg.json` - Bulgarian translations
3. The component file(s) - Add `useTranslation()` and `t()` calls
