// Ghost Writer AI — Gemini generation functions
// Uses the same ai-chat edge function pattern as geminiService.ts

import { supabase } from '../../core/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

// ---------------------------------------------------------------------------
// Helper: call Gemini via the ai-chat edge function
// ---------------------------------------------------------------------------

async function callGemini(
  systemInstruction: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages, systemInstruction }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Ghost Writer AI error:', error);
    throw new Error(error.error || 'AI request failed');
  }

  const data = await response.json();
  return data.content || '';
}

// ---------------------------------------------------------------------------
// 1. Generate a community post
// ---------------------------------------------------------------------------

export interface GeneratePostParams {
  personaPrompt: string;
  postType: 'motivation' | 'tip' | 'question' | 'recap' | 'custom';
  topicHints?: string;
  recentPosts?: string[];      // Last 5 post contents to avoid repetition
  communityName: string;
}

export async function generateGhostPost(params: GeneratePostParams): Promise<string> {
  const { personaPrompt, postType, topicHints, recentPosts, communityName } = params;

  let systemInstruction = `${personaPrompt}

ИНСТРУКЦИИ ЗА ГЕНЕРИРАНЕ НА ПОСТ:
- Пиши от първо лице като създателя на общността.
- Постът трябва да е автентичен, ангажиращ и подходящ за общността.
- Дължина: 2-5 параграфа (не прекалено дълъг).
- Не използвай хаштагове, освен ако не е изрично поискано.
- Приключи с въпрос или call-to-action, за да стимулираш дискусия.`;

  if (recentPosts && recentPosts.length > 0) {
    systemInstruction += `

ПОСЛЕДНИ ПОСТОВЕ (избягвай повторение на теми и формулировки):
${recentPosts.map((p, i) => `${i + 1}. ${p.slice(0, 200)}`).join('\n')}`;
  }

  const userMessage = `Напиши нов ${postType} пост за общността "${communityName}".${topicHints ? ` ${topicHints}` : ''}`;

  return callGemini(systemInstruction, [{ role: 'user', content: userMessage }]);
}

// ---------------------------------------------------------------------------
// 2. Generate a reply to a student message
// ---------------------------------------------------------------------------

export interface GenerateReplyParams {
  personaPrompt: string;
  studentName: string;
  studentMessage: string;
  messageHistory: { role: 'user' | 'model'; text: string }[];
  studentDataSummary?: string;   // "Хранене: салата, Тегло: 85кг"
  studentHealthStatus?: string;  // "at_risk" | "stable" | "top_member"
}

export async function generateGhostReply(params: GenerateReplyParams): Promise<string> {
  const {
    personaPrompt,
    studentName,
    studentMessage,
    messageHistory,
    studentDataSummary,
    studentHealthStatus,
  } = params;

  let systemInstruction = personaPrompt;

  if (studentDataSummary) {
    systemInstruction += `\n\nДАННИ ЗА УЧЕНИКА (${studentName}): ${studentDataSummary}`;
  }

  if (studentHealthStatus) {
    const statusLabels: Record<string, string> = {
      at_risk: 'В РИСК — бъди особено внимателен и подкрепящ',
      stable: 'Стабилен — продължавай да мотивираш',
      top_member: 'Топ член — поздрави за напредъка',
    };
    systemInstruction += `\nСТАТУС: ${statusLabels[studentHealthStatus] ?? studentHealthStatus}`;
  }

  const messages = [
    ...messageHistory.map((h) => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.text,
    })),
    { role: 'user', content: `[${studentName}]: ${studentMessage}` },
  ];

  return callGemini(systemInstruction, messages);
}

// ---------------------------------------------------------------------------
// 3. Generate a proactive outreach message
// ---------------------------------------------------------------------------

export interface ProactiveMessageParams {
  personaPrompt: string;
  studentName: string;
  triggerType: 'new_student' | 'inactive' | 'at_risk';
  studentDataSummary?: string;
  communityName: string;
  daysSinceLastActivity?: number;
}

export async function generateProactiveMessage(params: ProactiveMessageParams): Promise<string> {
  const {
    personaPrompt,
    studentName,
    triggerType,
    studentDataSummary,
    communityName,
    daysSinceLastActivity,
  } = params;

  const triggerInstructions: Record<string, string> = {
    new_student: `Напиши топло и приветливо добре дошъл съобщение за нов ученик на име ${studentName} в общността "${communityName}". Представи се кратко, попитай какви са целите му/й и предложи първа стъпка.`,
    inactive: `Напиши приятелско check-in съобщение за ${studentName} от общността "${communityName}". Ученикът не е бил активен от ${daysSinceLastActivity ?? 'няколко'} дни. Бъди загрижен, не натрапчив. Попитай дали има нужда от помощ.`,
    at_risk: `Напиши мотивиращо и подкрепящо съобщение за ${studentName} от общността "${communityName}". Ученикът е в риск от отпадане. Напомни му/й защо е започнал/а и предложи конкретна помощ.`,
  };

  let systemInstruction = `${personaPrompt}

ИНСТРУКЦИИ:
- Пиши лично съобщение (DM), не публичен пост.
- Бъди автентичен и загрижен.
- Дължина: 2-4 изречения (кратко и лично).`;

  if (studentDataSummary) {
    systemInstruction += `\n\nДАННИ ЗА УЧЕНИКА: ${studentDataSummary}`;
  }

  const userMessage = triggerInstructions[triggerType];

  return callGemini(systemInstruction, [{ role: 'user', content: userMessage }]);
}

// ---------------------------------------------------------------------------
// 4. Extract structured data points from a student message
// ---------------------------------------------------------------------------

export interface ExtractDataParams {
  dataCollectionFields: string[];  // ["Хранене", "Тренировки", "Сън"]
  studentMessage: string;
}

export interface ExtractedDataPoint {
  field_name: string;
  value: string;
}

export async function extractDataPoints(params: ExtractDataParams): Promise<ExtractedDataPoint[]> {
  const { dataCollectionFields, studentMessage } = params;

  if (dataCollectionFields.length === 0) return [];

  const systemInstruction = `Извлечи следните данни от съобщението, ако присъстват: ${dataCollectionFields.join(', ')}. Върни JSON масив с обекти {"field_name": "<име>", "value": "<стойност>"}. Ако няма данни, върни празен масив []. Върни САМО валиден JSON, без допълнителен текст.`;

  const raw = await callGemini(systemInstruction, [
    { role: 'user', content: studentMessage },
  ]);

  try {
    // Strip markdown code fences if Gemini wraps the response
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item: unknown): item is ExtractedDataPoint =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as ExtractedDataPoint).field_name === 'string' &&
        typeof (item as ExtractedDataPoint).value === 'string'
    );
  } catch (err) {
    console.error('Failed to parse data extraction response:', err, raw);
    return [];
  }
}
