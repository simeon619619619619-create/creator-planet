import { Student } from "../../core/types";
import { supabase } from "../../core/supabase/client";
import { getDashboardStats, getCommunityStats } from "../dashboard/dashboardService";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

const MENTOR_SYSTEM_INSTRUCTION = `You are the "AI Success Manager" for Founders Club.

Your role:
- Help creators manage their community and improve student retention
- Provide actionable, data-driven advice based on real student metrics
- Keep answers concise (2-3 paragraphs max), encouraging, and specific
- Reference actual student data when available (names, risk scores, activity patterns)

Capabilities:
- Analyze student risk patterns and suggest interventions
- Recommend engagement strategies for at-risk students
- Provide community growth and course design advice
- Answer questions about platform metrics and trends

Tone: Professional but friendly, like a business advisor who cares about student success.`;

/**
 * Build enhanced system instruction with optional creator customization
 */
const buildSystemInstruction = (creatorPrompt: string | null): string => {
  if (creatorPrompt && creatorPrompt.trim()) {
    return `${MENTOR_SYSTEM_INSTRUCTION}

CREATOR-SPECIFIC INSTRUCTIONS:
${creatorPrompt}`;
  }

  return MENTOR_SYSTEM_INSTRUCTION;
};

/**
 * Fetch creator's custom AI prompt from creator_profiles table
 */
export const getCreatorPrompt = async (creatorId: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase
      .from('creator_profiles')
      .select('ai_prompt')
      .eq('creator_id', creatorId)
      .single();

    if (error) {
      console.error('Error fetching creator prompt:', error);
      return null;
    }

    return data?.ai_prompt || null;
  } catch (error) {
    console.error('Error fetching creator prompt:', error);
    return null;
  }
};

/**
 * Get the current user's JWT token for authenticated edge function calls
 */
const getAuthToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
};

/**
 * Inject platform stats context into user message
 */
const injectStatsContext = async (userMessage: string, creatorId: string): Promise<string> => {
  try {
    const dashboardStats = await getDashboardStats(creatorId);
    const communityStats = await getCommunityStats(creatorId);

    const statsContext = `
[CONTEXT: Platform Overview]
Students: ${dashboardStats.totalStudents} total, ${dashboardStats.activeStudents} active
Completion Rate: ${dashboardStats.completionRate}%
At-Risk Students: ${dashboardStats.atRiskCount}
Community: ${communityStats.totalMembers} members, ${communityStats.totalPosts} posts, ${communityStats.totalComments} comments`;

    return `${userMessage}${statsContext}`;
  } catch (error) {
    console.error('Error injecting stats context:', error);
    return userMessage;
  }
};

/**
 * Send a message to the AI Success Manager using Supabase Edge Function
 */
export const sendMentorMessage = async (
  message: string,
  history: {role: 'user' | 'model', text: string}[],
  creatorId?: string,
  includeStats?: boolean,
  userName?: string
) => {
  try {
    const token = await getAuthToken();

    // Fetch creator's custom prompt if creatorId provided
    let creatorPrompt: string | null = null;
    if (creatorId) {
      creatorPrompt = await getCreatorPrompt(creatorId);
    }

    const systemInstruction = buildSystemInstruction(creatorPrompt);

    // Inject stats context if requested
    let enhancedMessage = message;
    if (includeStats && creatorId) {
      enhancedMessage = await injectStatsContext(message, creatorId);
    }

    const messages = [
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text
      })),
      { role: 'user', content: enhancedMessage }
    ];

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages,
        systemInstruction,
        userName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function Error:', error);
      throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    return data.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "I'm having trouble connecting to the Success Engine right now. Please try again later.";
  }
};

export const analyzeStudentRisks = async (students: Student[]): Promise<string> => {
  const studentDataSummary = students.map(s =>
    `Name: ${s.name}, Last Login: ${s.lastLogin}, Progress: ${s.courseProgress}%, Engagement: ${s.communityEngagement}/100`
  ).join('\n');

  const prompt = `
    Analyze the following student data and provide a "Success Report" for the Creator.
    Identify patterns in engagement and suggest 3 specific actions the creator can take today to improve retention.

    Student Data:
    ${studentDataSummary}
  `;

  try {
    const token = await getAuthToken();

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        systemInstruction: MENTOR_SYSTEM_INSTRUCTION,
      })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.content || "Analysis complete, but no text returned.";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Could not generate risk analysis report.";
  }
};

/**
 * Get student progress details for AI context
 */
const getStudentProgress = async (studentId: string, courseId: string) => {
  try {
    const { getCourseWithDetails } = await import('../courses/courseService');
    const courseWithDetails = await getCourseWithDetails(courseId, studentId);

    if (!courseWithDetails) {
      return {
        percentComplete: 0,
        modulesCompleted: [],
        lessonsCompleted: 0,
        totalLessons: 0,
      };
    }

    const totalLessons = courseWithDetails.modules.reduce((acc, m) => acc + m.lessons.length, 0);
    const lessonsCompleted = courseWithDetails.modules.reduce(
      (acc, m) => acc + m.lessons.filter(l => l.is_completed).length,
      0
    );

    const modulesCompleted = courseWithDetails.modules
      .filter(m => m.lessons.length > 0 && m.lessons.every(l => l.is_completed))
      .map(m => m.title);

    return {
      percentComplete: courseWithDetails.progress_percent || 0,
      modulesCompleted,
      lessonsCompleted,
      totalLessons,
    };
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return {
      percentComplete: 0,
      modulesCompleted: [],
      lessonsCompleted: 0,
      totalLessons: 0,
    };
  }
};

/**
 * Build student-specific system instruction with course and progress context
 */
const buildStudentMentorInstruction = (
  courseTitle: string,
  courseDescription: string | null,
  communityDescription: string | null,
  percentComplete: number,
  modulesCompleted: string[],
  lessonsCompleted: number,
  totalLessons: number,
  creatorPrompt: string | null
): string => {
  return `You are an AI Learning Assistant for "${courseTitle}".

COURSE CONTEXT:
- Course: ${courseTitle}
- Description: ${courseDescription || 'No description available'}
- Community: ${communityDescription || 'No community description available'}

STUDENT PROGRESS:
- Overall: ${percentComplete}% complete
- Modules completed: ${modulesCompleted.length > 0 ? modulesCompleted.join(', ') : 'None yet'}
- Lessons completed: ${lessonsCompleted}/${totalLessons}

${creatorPrompt ? `CREATOR GUIDANCE:\n${creatorPrompt}\n` : ''}YOUR ROLE:
- Help the student understand course concepts
- Answer questions about lessons and modules
- Encourage progress and completion
- Be supportive, clear, and encouraging
- Keep answers focused on course content

DO NOT:
- Provide information outside the course scope
- Make up content not in the course
- Share other students' information`;
};

/**
 * Send a message to the AI Learning Assistant for students
 */
export const sendStudentMentorMessage = async (
  message: string,
  history: {role: 'user' | 'model', text: string}[],
  studentId: string,
  courseId: string,
  userName?: string
) => {
  try {
    const token = await getAuthToken();

    // Fetch course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('title, description, creator_id, community_id')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      console.error('Error fetching course:', courseError);
      return "I'm having trouble accessing the course information. Please try again later.";
    }

    let communityDescription: string | null = null;
    if (course.community_id) {
      const { data: community } = await supabase
        .from('communities')
        .select('description')
        .eq('id', course.community_id)
        .single();

      communityDescription = community?.description || null;
    }

    const creatorPrompt = await getCreatorPrompt(course.creator_id);
    const progress = await getStudentProgress(studentId, courseId);

    const systemInstruction = buildStudentMentorInstruction(
      course.title,
      course.description,
      communityDescription,
      progress.percentComplete,
      progress.modulesCompleted,
      progress.lessonsCompleted,
      progress.totalLessons,
      creatorPrompt
    );

    const messages = [
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.text
      })),
      { role: 'user', content: message }
    ];

    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        messages,
        systemInstruction,
        userName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Edge Function Error:', error);
      throw new Error(error.error || 'API request failed');
    }

    const data = await response.json();
    return data.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("AI Chat Error:", error);
    return "I'm having trouble connecting to the Learning Assistant right now. Please try again later.";
  }
};
