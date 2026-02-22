// ============================================================================
// REPORT SERVICE
// Generates comprehensive reports for creators
// ============================================================================

import { getDashboardStats, getAtRiskStudents, getCommunityStats, DashboardStats, AtRiskStudent } from './dashboardService';
import { supabase } from '../../core/supabase/client';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';

export interface DashboardReportData {
  generatedAt: string;
  communityName: string | null; // null = all communities
  stats: DashboardStats;
  atRiskStudents: AtRiskStudent[];
  communityStats: {
    totalMembers: number;
    totalPosts: number;
    totalComments: number;
  };
  courses: {
    id: string;
    title: string;
    enrollmentCount: number;
  }[];
}

export interface GeneratedReport {
  title: string;
  generatedAt: string;
  summary: string;
  sections: {
    title: string;
    content: string;
  }[];
  aiInsights: string;
}

/**
 * Gather all data needed for a dashboard report
 */
export async function gatherReportData(
  creatorId: string,
  communityId: string | null = null
): Promise<DashboardReportData> {
  // Get community name if specific community selected
  let communityName: string | null = null;
  if (communityId) {
    const { data: community } = await supabase
      .from('communities')
      .select('name')
      .eq('id', communityId)
      .single();
    communityName = community?.name || null;
  }

  // Get all the dashboard stats
  const [stats, atRiskStudents, communityStats] = await Promise.all([
    getDashboardStats(creatorId, communityId),
    getAtRiskStudents(creatorId, communityId),
    getCommunityStats(creatorId, communityId),
  ]);

  // Get courses info
  let courseQuery = supabase
    .from('courses')
    .select('id, title')
    .eq('creator_id', creatorId);

  if (communityId) {
    courseQuery = courseQuery.eq('community_id', communityId);
  }

  const { data: courses } = await courseQuery;

  // Get enrollment counts for each course
  const coursesWithEnrollments = await Promise.all(
    (courses || []).map(async (course) => {
      const { count } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', course.id);

      return {
        id: course.id,
        title: course.title,
        enrollmentCount: count || 0,
      };
    })
  );

  return {
    generatedAt: new Date().toISOString(),
    communityName,
    stats,
    atRiskStudents,
    communityStats,
    courses: coursesWithEnrollments,
  };
}

/**
 * Generate AI insights based on report data
 */
async function generateAIInsights(data: DashboardReportData): Promise<string> {
  if (!apiKey) {
    return 'AI insights unavailable - API key not configured.';
  }

  const prompt = `You are an expert business analyst for online course creators. Analyze this dashboard data and provide 3-4 actionable insights with specific recommendations.

DATA SUMMARY:
- Report Date: ${new Date(data.generatedAt).toLocaleDateString()}
- Scope: ${data.communityName ? `Community: ${data.communityName}` : 'All Communities'}

COMMUNITY METRICS:
- Total Members: ${data.stats.totalCommunityMembers}
- Total Posts: ${data.stats.totalPosts}
- Member Change: ${data.stats.communityMembersChange !== null ? `${data.stats.communityMembersChange}%` : 'No previous data'}

COURSE METRICS:
- Total Enrollments: ${data.stats.totalStudents}
- Active Students: ${data.stats.activeStudents}
- Completion Rate: ${data.stats.completionRate}%
- Enrollment Change: ${data.stats.totalStudentsChange !== null ? `${data.stats.totalStudentsChange}%` : 'No previous data'}

STUDENT HEALTH:
- At-Risk Students: ${data.stats.atRiskCount}
- Inactive (7+ days): ${data.stats.inactiveCount}

${data.atRiskStudents.length > 0 ? `
TOP AT-RISK STUDENTS:
${data.atRiskStudents.slice(0, 5).map(s => `- ${s.name}: Risk Score ${s.risk_score}/100 - ${s.reason}`).join('\n')}
` : ''}

COURSES:
${data.courses.map(c => `- ${c.title}: ${c.enrollmentCount} enrollments`).join('\n')}

Provide insights in this format:
1. **[Insight Title]**: [Specific insight with numbers] → [Actionable recommendation]

Keep each insight to 2-3 sentences maximum. Focus on growth opportunities and risk mitigation.`;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        systemInstruction: 'You are a business analytics assistant. Provide clear, actionable insights. Be concise and data-driven.',
        apiKey: apiKey
      })
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const result = await response.json();
    return result.content || 'Unable to generate insights.';
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return 'AI insights temporarily unavailable. Please try again later.';
  }
}

/**
 * Generate a complete dashboard report
 */
export async function generateDashboardReport(
  creatorId: string,
  communityId: string | null = null
): Promise<GeneratedReport> {
  // Gather all data
  const data = await gatherReportData(creatorId, communityId);

  // Generate AI insights
  const aiInsights = await generateAIInsights(data);

  // Build the report
  const report: GeneratedReport = {
    title: data.communityName
      ? `Dashboard Report: ${data.communityName}`
      : 'Dashboard Report: All Communities',
    generatedAt: data.generatedAt,
    summary: buildSummary(data),
    sections: [
      {
        title: 'Community Overview',
        content: buildCommunitySection(data),
      },
      {
        title: 'Course Performance',
        content: buildCourseSection(data),
      },
      {
        title: 'Student Health',
        content: buildStudentHealthSection(data),
      },
    ],
    aiInsights,
  };

  return report;
}

function buildSummary(data: DashboardReportData): string {
  const date = new Date(data.generatedAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Report generated on ${date}. ${
    data.communityName
      ? `This report covers the "${data.communityName}" community.`
      : 'This report covers all your communities.'
  } You have ${data.stats.totalCommunityMembers} community members and ${data.stats.totalStudents} course enrollments with a ${data.stats.completionRate}% completion rate.`;
}

function buildCommunitySection(data: DashboardReportData): string {
  const changeText = data.stats.communityMembersChange !== null
    ? `(${data.stats.communityMembersChange >= 0 ? '+' : ''}${data.stats.communityMembersChange}% vs last week)`
    : '';

  return `**Members:** ${data.stats.totalCommunityMembers} ${changeText}
**Posts:** ${data.stats.totalPosts}
**Comments:** ${data.communityStats.totalComments}

${data.stats.communityMembersChange !== null && data.stats.communityMembersChange > 0
  ? 'Your community is growing! Keep up the engagement.'
  : data.stats.communityMembersChange !== null && data.stats.communityMembersChange < 0
  ? 'Community growth has slowed. Consider running an engagement campaign.'
  : 'Track your community growth over time by checking back regularly.'}`;
}

function buildCourseSection(data: DashboardReportData): string {
  const enrollmentChange = data.stats.totalStudentsChange !== null
    ? `(${data.stats.totalStudentsChange >= 0 ? '+' : ''}${data.stats.totalStudentsChange}% vs last week)`
    : '';

  let courseList = '';
  if (data.courses.length > 0) {
    courseList = '\n\n**Courses:**\n' + data.courses
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .map(c => `• ${c.title}: ${c.enrollmentCount} students`)
      .join('\n');
  }

  return `**Total Enrollments:** ${data.stats.totalStudents} ${enrollmentChange}
**Active Students:** ${data.stats.activeStudents}
**Completion Rate:** ${data.stats.completionRate}%${courseList}`;
}

function buildStudentHealthSection(data: DashboardReportData): string {
  let atRiskList = '';
  if (data.atRiskStudents.length > 0) {
    atRiskList = '\n\n**Top At-Risk Students:**\n' + data.atRiskStudents
      .slice(0, 5)
      .map(s => `• **${s.name}** (Risk: ${s.risk_score}/100) - ${s.reason}`)
      .join('\n');

    if (data.atRiskStudents.length > 5) {
      atRiskList += `\n• ...and ${data.atRiskStudents.length - 5} more`;
    }
  }

  const healthStatus = data.stats.atRiskCount === 0 && data.stats.inactiveCount === 0
    ? 'All students are healthy and active!'
    : data.stats.atRiskCount > 0
    ? `${data.stats.atRiskCount} student${data.stats.atRiskCount > 1 ? 's need' : ' needs'} attention.`
    : `${data.stats.inactiveCount} student${data.stats.inactiveCount > 1 ? 's have' : ' has'} been inactive for 7+ days.`;

  return `**At-Risk Students:** ${data.stats.atRiskCount}
**Inactive (7+ days):** ${data.stats.inactiveCount}

${healthStatus}${atRiskList}`;
}

/**
 * Export report data as CSV
 */
export function exportReportAsCSV(data: DashboardReportData): string {
  const lines: string[] = [];

  // Header
  lines.push('Dashboard Report');
  lines.push(`Generated: ${new Date(data.generatedAt).toLocaleString()}`);
  lines.push(`Scope: ${data.communityName || 'All Communities'}`);
  lines.push('');

  // Stats
  lines.push('Metric,Value,Change');
  lines.push(`Community Members,${data.stats.totalCommunityMembers},${data.stats.communityMembersChange ?? 'N/A'}%`);
  lines.push(`Total Posts,${data.stats.totalPosts},`);
  lines.push(`Course Enrollments,${data.stats.totalStudents},${data.stats.totalStudentsChange ?? 'N/A'}%`);
  lines.push(`Active Students,${data.stats.activeStudents},`);
  lines.push(`Completion Rate,${data.stats.completionRate}%,${data.stats.completionRateChange ?? 'N/A'}%`);
  lines.push(`At-Risk Students,${data.stats.atRiskCount},`);
  lines.push(`Inactive (7d+),${data.stats.inactiveCount},`);
  lines.push('');

  // Courses
  if (data.courses.length > 0) {
    lines.push('Courses');
    lines.push('Title,Enrollments');
    data.courses.forEach(c => {
      lines.push(`"${c.title}",${c.enrollmentCount}`);
    });
    lines.push('');
  }

  // At-risk students
  if (data.atRiskStudents.length > 0) {
    lines.push('At-Risk Students');
    lines.push('Name,Email,Risk Score,Reason');
    data.atRiskStudents.forEach(s => {
      lines.push(`"${s.name}","${s.email}",${s.risk_score},"${s.reason}"`);
    });
  }

  return lines.join('\n');
}

/**
 * Download data as CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
