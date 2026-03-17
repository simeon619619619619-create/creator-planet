import { Student, RiskLevel, Course, Post, CalendarEvent, View } from './types';

export const MOCK_STUDENTS: Student[] = [
  {
    id: '1',
    name: 'Alex Johnson',
    avatar: 'https://picsum.photos/seed/alex/100/100',
    email: 'alex@example.com',
    joinDate: '2023-10-15',
    lastLogin: '2023-10-26',
    courseProgress: 85,
    communityEngagement: 90,
    riskLevel: RiskLevel.LOW,
  },
  {
    id: '2',
    name: 'Sarah Smith',
    avatar: 'https://picsum.photos/seed/sarah/100/100',
    email: 'sarah@example.com',
    joinDate: '2023-09-01',
    lastLogin: '2023-10-20',
    courseProgress: 12,
    communityEngagement: 10,
    riskLevel: RiskLevel.HIGH,
    riskReason: 'Stalled progress in Module 2, Low login frequency.',
  },
  {
    id: '3',
    name: 'Mike Brown',
    avatar: 'https://picsum.photos/seed/mike/100/100',
    email: 'mike@example.com',
    joinDate: '2023-11-01',
    lastLogin: '2023-11-05',
    courseProgress: 45,
    communityEngagement: 50,
    riskLevel: RiskLevel.MEDIUM,
    riskReason: 'Decreasing community activity.',
  },
  {
    id: '4',
    name: 'Emily Davis',
    avatar: 'https://picsum.photos/seed/emily/100/100',
    email: 'emily@example.com',
    joinDate: '2023-08-15',
    lastLogin: '2023-10-27',
    courseProgress: 98,
    communityEngagement: 95,
    riskLevel: RiskLevel.LOW,
  },
  {
    id: '5',
    name: 'David Wilson',
    avatar: 'https://picsum.photos/seed/david/100/100',
    email: 'david@example.com',
    joinDate: '2023-09-20',
    lastLogin: '2023-10-01',
    courseProgress: 5,
    communityEngagement: 0,
    riskLevel: RiskLevel.CRITICAL,
    riskReason: 'Ghosted: No login for 25+ days.',
  }
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'c1',
    title: 'Content Creator Masterclass',
    description: 'Go from 0 to 100k subscribers in 90 days.',
    thumbnail: 'https://picsum.photos/seed/course1/400/225',
    modules: [
      {
        id: 'm1',
        title: 'Module 1: Finding Your Niche',
        lessons: [
          { id: 'l1', title: 'The Niche Finder Framework', type: 'video', duration: '12:30', isCompleted: true },
          { id: 'l2', title: 'Competitor Analysis Worksheet', type: 'file', isCompleted: true },
        ]
      },
      {
        id: 'm2',
        title: 'Module 2: Content Strategy',
        lessons: [
          { id: 'l3', title: 'The Viral Hook Formula', type: 'video', duration: '15:45', isCompleted: false },
          { id: 'l4', title: 'Scripting Your First Video', type: 'text', duration: '10:00', isCompleted: false },
        ]
      }
    ]
  },
  {
    id: 'c2',
    title: 'Community Building 101',
    description: 'How to monetize your audience effectively.',
    thumbnail: 'https://picsum.photos/seed/course2/400/225',
    modules: [
      {
        id: 'm1',
        title: 'Welcome',
        lessons: [
          { id: 'l1', title: 'Start Here', type: 'video', duration: '05:00', isCompleted: false }
        ]
      }
    ]
  }
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    author: { name: 'Alex Johnson', avatar: 'https://picsum.photos/seed/alex/100/100', role: 'Student' },
    content: 'Just finished Module 1! The worksheet really helped me narrow down my niche to "Eco-friendly Tech Reviews". What do you guys think?',
    likes: 12,
    comments: 4,
    timestamp: '2 hours ago',
    tags: ['Win', 'Module 1']
  },
  {
    id: 'p2',
    author: { name: 'Sean (Creator)', avatar: 'https://picsum.photos/seed/sean/100/100', role: 'Creator' },
    content: '⚠️ New Live Call scheduled for Friday! We will be doing channel audits. Make sure to submit your links in the Calendar event.',
    likes: 45,
    comments: 12,
    timestamp: '5 hours ago',
    tags: ['Announcement']
  },
  {
    id: 'p3',
    author: { name: 'Mike Brown', avatar: 'https://picsum.photos/seed/mike/100/100', role: 'Student' },
    content: 'Is anyone else struggling with the audio setup for their videos? I feel like my mic quality is holding me back.',
    likes: 3,
    comments: 8,
    timestamp: '1 day ago',
    tags: ['Question', 'Tech']
  }
];

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Weekly Q&A Call',
    type: 'Live Call',
    date: 'Oct 28, 2023',
    time: '18:00 EST',
    attendees: 34
  },
  {
    id: 'e2',
    title: 'Content Sprint Workshop',
    type: 'Workshop',
    date: 'Nov 02, 2023',
    time: '12:00 EST',
    attendees: 12
  }
];

export const NAV_ITEMS = [
  { id: View.DASHBOARD, label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: View.COMMUNITY, label: 'Community', icon: 'Users' },
  { id: View.COURSES, label: 'Classroom', icon: 'GraduationCap' },
  { id: View.HOMEWORK, label: 'Homework', icon: 'ClipboardList' },
  { id: View.MESSAGES, label: 'Messages', icon: 'MessageSquare' },
  { id: View.AI_CHAT, label: 'AI Chat', icon: 'Bot' },
  { id: View.CALENDAR, label: 'Calendar', icon: 'Calendar' },
  { id: View.AI_MANAGER, label: 'AI Success Manager', icon: 'BrainCircuit' },
];

export const CREATOR_NAV_ITEMS = [
  { id: View.STUDENT_MANAGER, label: 'Student Manager', icon: 'UserCog' },
  { id: View.SURVEYS, label: 'Surveys', icon: 'ClipboardCheck' },
  { id: View.DISCOUNTS, label: 'Discounts', icon: 'Tag' },
];

// Navigation items for team members (lecturers, assistants, guest experts)
export const TEAM_MEMBER_NAV_ITEMS = [
  { id: View.DASHBOARD, label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: View.COMMUNITY, label: 'Community', icon: 'Users' },
  { id: View.COURSES, label: 'Classroom', icon: 'GraduationCap' },
  { id: View.HOMEWORK, label: 'Homework', icon: 'ClipboardList' },
  { id: View.CALENDAR, label: 'Calendar', icon: 'Calendar' },
  { id: View.AI_MANAGER, label: 'AI Success Manager', icon: 'BrainCircuit' },
  { id: View.MEMBERS, label: 'Members', icon: 'UserCircle' },
  { id: View.MESSAGES, label: 'Messages', icon: 'MessageSquare' },
];
