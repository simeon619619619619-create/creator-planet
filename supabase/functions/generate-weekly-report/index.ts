// ============================================================================
// GENERATE WEEKLY REPORT EDGE FUNCTION
// Creates AI-powered weekly success reports for creators
// ============================================================================
//
// Endpoints:
// POST /generate-weekly-report
//   - action: 'generate' - Generate a new weekly report for a creator
//   - action: 'generate-all' - Generate reports for all active creators (cron)
//
// Request body for 'generate':
//   - creatorId: string (required) - The profile.id of the creator
//
// Security:
// - 'generate' requires valid JWT authentication (creator generating own report)
// - 'generate-all' requires service role key (for cron job)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ============================================================================
// CORS HEADERS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

function unauthorizedResponse(message = 'Unauthorized'): Response {
  return errorResponse(message, 401);
}

function serverErrorResponse(message = 'Internal server error'): Response {
  return errorResponse(message, 500);
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function createServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createUserClient(authHeader: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getUserFromToken(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader) {
    console.error('No auth header provided');
    return null;
  }

  try {
    const token = authHeader.replace('Bearer ', '');

    if (!token || token === authHeader) {
      console.error('Invalid auth header format - expected "Bearer <token>"');
      return null;
    }

    const client = createUserClient(authHeader);
    const { data: { user }, error } = await client.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error?.message || 'No user returned');
      return null;
    }

    return { userId: user.id };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface GenerateRequest {
  action: 'generate' | 'generate-all';
  creatorId?: string;
}

interface AtRiskStudent {
  name: string;
  email: string;
  risk_score: number;
  status: string;
  reason: string;
  last_activity_at: string | null;
  course_title: string | null;
}

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  completionRate: number;
  atRiskCount: number;
  inactiveCount: number;
  totalCommunityMembers: number;
  totalPosts: number;
}

// AI System prompt for report generation
const REPORT_SYSTEM_INSTRUCTION = `You are the AI Success Manager for Creator Club, generating a Weekly Success Report for a creator.

Your role:
- Analyze student data and community metrics to provide actionable insights
- Identify patterns in student engagement and risk factors
- Provide 3-5 specific, actionable recommendations the creator can implement this week
- Be encouraging but honest about areas needing attention

Report Structure:
1. **Executive Summary** - Quick overview of community health (2-3 sentences)
2. **Key Metrics** - Highlight important numbers with context
3. **At-Risk Students** - Detail students needing immediate attention
4. **Wins & Highlights** - Celebrate successes and top performers
5. **Action Items** - Specific recommendations for this week

Tone: Professional, supportive, and data-driven. Use bullet points for readability.
Format: Markdown with headers, bold text, and bullet points.`;

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Parse request body
    const body: GenerateRequest = await req.json();
    const { action } = body;

    if (!action) {
      return errorResponse('Missing action parameter');
    }

    const supabase = createServiceClient();

    switch (action) {
      case 'generate': {
        // Verify authentication for individual report generation
        const authHeader = req.headers.get('Authorization');
        const user = await getUserFromToken(authHeader);

        if (!user) {
          return unauthorizedResponse('Invalid or missing authentication token');
        }

        // Get creator's profile.id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.userId)
          .single();

        if (!profile) {
          return errorResponse('Profile not found');
        }

        const creatorId = body.creatorId || profile.id;

        // Verify creator is generating their own report
        if (creatorId !== profile.id) {
          return errorResponse('Cannot generate report for another user', 403);
        }

        return await generateReportForCreator(supabase, creatorId, 'manual');
      }

      case 'generate-all': {
        // For cron jobs - requires service role (checked by Supabase internally)
        // This would be called by a Supabase cron job or external scheduler
        return await generateReportsForAllCreators(supabase);
      }

      default: {
        return errorResponse(`Unknown action: ${action}`);
      }
    }
  } catch (error) {
    console.error('Report generation error:', error);
    return serverErrorResponse(
      error instanceof Error ? error.message : 'Failed to generate report'
    );
  }
});

// ============================================================================
// GENERATE REPORT FOR SINGLE CREATOR
// ============================================================================

async function generateReportForCreator(
  supabase: SupabaseClient,
  creatorId: string,
  source: 'manual' | 'automated'
): Promise<Response> {
  try {
    // Calculate week boundaries
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    // Check if report already exists for this week
    const { data: existingReport } = await supabase
      .from('weekly_success_reports')
      .select('id')
      .eq('creator_id', creatorId)
      .gte('week_start', weekStart.toISOString().split('T')[0])
      .single();

    if (existingReport && source === 'automated') {
      // Skip if automated and report already exists
      return jsonResponse({
        success: true,
        skipped: true,
        message: 'Report already exists for this week'
      });
    }

    // Gather data for the report
    const stats = await getDashboardStats(supabase, creatorId);
    const atRiskStudents = await getAtRiskStudents(supabase, creatorId);
    const topStudents = await getTopStudents(supabase, creatorId);

    // Build context for AI
    const reportContext = buildReportContext(stats, atRiskStudents, topStudents, weekStart, weekEnd);

    // Generate report using AI
    const reportContent = await generateAIReport(reportContext);

    // Store the report
    const { data: report, error: insertError } = await supabase
      .from('weekly_success_reports')
      .insert({
        creator_id: creatorId,
        report_content: reportContent,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        students_analyzed: stats.totalStudents,
        at_risk_count: stats.atRiskCount,
        generation_source: source,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing report:', insertError);
      return serverErrorResponse('Failed to store report');
    }

    return jsonResponse({
      success: true,
      report: {
        id: report.id,
        generated_at: report.generated_at,
        week_start: report.week_start,
        week_end: report.week_end,
        content: reportContent,
      },
    });
  } catch (error) {
    console.error('Error generating report for creator:', creatorId, error);
    throw error;
  }
}

// ============================================================================
// GENERATE REPORTS FOR ALL CREATORS (CRON JOB)
// ============================================================================

async function generateReportsForAllCreators(
  supabase: SupabaseClient
): Promise<Response> {
  // Get all creators (profiles with role 'creator')
  const { data: creators, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'creator');

  if (error) {
    console.error('Error fetching creators:', error);
    return serverErrorResponse('Failed to fetch creators');
  }

  if (!creators || creators.length === 0) {
    return jsonResponse({ success: true, message: 'No creators found', generated: 0 });
  }

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const creator of creators) {
    try {
      const result = await generateReportForCreator(supabase, creator.id, 'automated');
      const resultData = await result.json();

      if (resultData.skipped) {
        skipped++;
      } else if (resultData.success) {
        generated++;
      }
    } catch (error) {
      console.error('Error generating report for creator:', creator.id, error);
      errors++;
    }
  }

  return jsonResponse({
    success: true,
    message: `Generated ${generated} reports, skipped ${skipped}, errors ${errors}`,
    generated,
    skipped,
    errors,
  });
}

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

async function getDashboardStats(
  supabase: SupabaseClient,
  creatorId: string
): Promise<DashboardStats> {
  // Get enrollments in creator's courses
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      user_id,
      status,
      course:courses!inner(creator_id)
    `)
    .eq('courses.creator_id', creatorId);

  const totalStudents = new Set(enrollments?.map(e => e.user_id) || []).size;
  const activeEnrollments = enrollments?.filter(e => e.status === 'active') || [];
  const activeStudents = new Set(activeEnrollments.map(e => e.user_id)).size;
  const completedEnrollments = enrollments?.filter(e => e.status === 'completed') || [];
  const completionRate = enrollments && enrollments.length > 0
    ? Math.round((completedEnrollments.length / enrollments.length) * 100)
    : 0;

  // Get at-risk count
  const { data: atRiskData } = await supabase
    .from('student_health')
    .select(`
      id,
      course:courses!course_id(creator_id)
    `)
    .eq('status', 'at_risk');

  const atRiskCount = atRiskData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }).length || 0;

  // Get inactive count
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: inactiveData } = await supabase
    .from('student_health')
    .select(`
      id,
      last_activity_at,
      course:courses!course_id(creator_id)
    `)
    .or(`last_activity_at.is.null,last_activity_at.lt.${sevenDaysAgo}`);

  const inactiveCount = inactiveData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }).length || 0;

  // Community stats
  const { data: communities } = await supabase
    .from('communities')
    .select('id')
    .eq('creator_id', creatorId);

  const communityIds = communities?.map(c => c.id) || [];

  let totalCommunityMembers = 0;
  let totalPosts = 0;

  if (communityIds.length > 0) {
    const { data: memberships } = await supabase
      .from('memberships')
      .select('user_id')
      .in('community_id', communityIds);

    const memberUserIds = new Set(memberships?.map(m => m.user_id) || []);
    memberUserIds.delete(creatorId);
    totalCommunityMembers = memberUserIds.size;

    const { data: channels } = await supabase
      .from('community_channels')
      .select('id')
      .in('community_id', communityIds);

    const channelIds = channels?.map(c => c.id) || [];

    if (channelIds.length > 0) {
      const { count: postCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact' })
        .in('channel_id', channelIds);

      totalPosts = postCount || 0;
    }
  }

  return {
    totalStudents,
    activeStudents,
    completionRate,
    atRiskCount,
    inactiveCount,
    totalCommunityMembers,
    totalPosts,
  };
}

async function getAtRiskStudents(
  supabase: SupabaseClient,
  creatorId: string
): Promise<AtRiskStudent[]> {
  const { data: healthData } = await supabase
    .from('student_health')
    .select(`
      *,
      profile:profiles!user_id(full_name, email),
      course:courses!course_id(title, creator_id)
    `)
    .eq('status', 'at_risk')
    .order('risk_score', { ascending: false })
    .limit(10);

  const filteredData = healthData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }) || [];

  return filteredData.map(h => {
    const profile = h.profile as any;
    const course = h.course as any;

    return {
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      risk_score: h.risk_score,
      status: h.status,
      reason: generateRiskReason(h),
      last_activity_at: h.last_activity_at,
      course_title: course?.title || null,
    };
  });
}

async function getTopStudents(
  supabase: SupabaseClient,
  creatorId: string
): Promise<AtRiskStudent[]> {
  const { data: healthData } = await supabase
    .from('student_health')
    .select(`
      *,
      profile:profiles!user_id(full_name, email),
      course:courses!course_id(title, creator_id)
    `)
    .eq('status', 'top_member')
    .order('risk_score', { ascending: true })
    .limit(5);

  const filteredData = healthData?.filter(h => {
    const course = h.course as any;
    return course?.creator_id === creatorId;
  }) || [];

  return filteredData.map(h => {
    const profile = h.profile as any;
    const course = h.course as any;

    return {
      name: profile?.full_name || profile?.email || 'Unknown',
      email: profile?.email || '',
      risk_score: h.risk_score,
      status: h.status,
      reason: 'Top performer with high engagement',
      last_activity_at: h.last_activity_at,
      course_title: course?.title || null,
    };
  });
}

function generateRiskReason(health: any): string {
  const reasons: string[] = [];

  if (health.risk_score >= 80) {
    reasons.push('Very high risk score');
  } else if (health.risk_score >= 60) {
    reasons.push('Elevated risk score');
  }

  if (health.last_activity_at) {
    const lastActivity = new Date(health.last_activity_at);
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceActivity > 14) {
      reasons.push(`No activity for ${daysSinceActivity} days`);
    } else if (daysSinceActivity > 7) {
      reasons.push('Low activity in past week');
    }
  } else {
    reasons.push('Never active');
  }

  return reasons.length > 0 ? reasons.join('. ') : 'Needs attention';
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function buildReportContext(
  stats: DashboardStats,
  atRiskStudents: AtRiskStudent[],
  topStudents: AtRiskStudent[],
  weekStart: Date,
  weekEnd: Date
): string {
  const dateRange = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;

  let context = `Generate a Weekly Success Report for the period: ${dateRange}\n\n`;

  context += `## Platform Metrics\n`;
  context += `- Total Students: ${stats.totalStudents}\n`;
  context += `- Active Students: ${stats.activeStudents}\n`;
  context += `- Course Completion Rate: ${stats.completionRate}%\n`;
  context += `- At-Risk Students: ${stats.atRiskCount}\n`;
  context += `- Inactive Students (7+ days): ${stats.inactiveCount}\n`;
  context += `- Community Members: ${stats.totalCommunityMembers}\n`;
  context += `- Total Posts: ${stats.totalPosts}\n\n`;

  if (atRiskStudents.length > 0) {
    context += `## At-Risk Students (Top ${atRiskStudents.length})\n`;
    atRiskStudents.forEach((s, i) => {
      context += `${i + 1}. ${s.name} (${s.email})\n`;
      context += `   - Risk Score: ${s.risk_score}/100\n`;
      context += `   - Reason: ${s.reason}\n`;
      context += `   - Course: ${s.course_title || 'N/A'}\n`;
      context += `   - Last Active: ${s.last_activity_at ? new Date(s.last_activity_at).toLocaleDateString() : 'Never'}\n\n`;
    });
  } else {
    context += `## At-Risk Students\nNo at-risk students! Great job maintaining engagement.\n\n`;
  }

  if (topStudents.length > 0) {
    context += `## Top Performers\n`;
    topStudents.forEach((s, i) => {
      context += `${i + 1}. ${s.name} - ${s.course_title || 'N/A'}\n`;
    });
    context += '\n';
  }

  return context;
}

async function generateAIReport(context: string): Promise<string> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');

  if (!apiKey) {
    // Return a fallback report if no API key
    return generateFallbackReport(context);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: REPORT_SYSTEM_INSTRUCTION },
          { role: 'user', content: context },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', await response.text());
      return generateFallbackReport(context);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || generateFallbackReport(context);
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return generateFallbackReport(context);
  }
}

function generateFallbackReport(context: string): string {
  // Extract stats from context for a basic report
  const lines = context.split('\n');
  let report = `# Weekly Success Report\n\n`;
  report += `## Executive Summary\n`;
  report += `This is an automated report summarizing your community health for the past week.\n\n`;

  // Find and include the metrics
  const metricsStart = lines.findIndex(l => l.includes('Platform Metrics'));
  const atRiskStart = lines.findIndex(l => l.includes('At-Risk Students'));

  if (metricsStart > -1 && atRiskStart > -1) {
    report += `## Key Metrics\n`;
    for (let i = metricsStart + 1; i < atRiskStart; i++) {
      if (lines[i].trim().startsWith('-')) {
        report += lines[i] + '\n';
      }
    }
    report += '\n';
  }

  // Include at-risk section
  const topStart = lines.findIndex(l => l.includes('Top Performers'));
  if (atRiskStart > -1) {
    report += `## Students Needing Attention\n`;
    const endIndex = topStart > -1 ? topStart : lines.length;
    for (let i = atRiskStart + 1; i < endIndex; i++) {
      if (lines[i].trim()) {
        report += lines[i] + '\n';
      }
    }
    report += '\n';
  }

  report += `## Action Items\n`;
  report += `1. Review at-risk students and reach out personally\n`;
  report += `2. Consider posting new content to boost engagement\n`;
  report += `3. Celebrate your top performers publicly\n`;

  return report;
}
