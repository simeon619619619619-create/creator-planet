// ============================================================================
// Ghost Writer — Onboarding Questions & Persona Builder
// ============================================================================

export interface OnboardingQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'multi-choice';
  options?: string[];
  category: 'style' | 'content' | 'schedule' | 'data' | 'behavior';
}

export const GHOST_WRITER_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'addressing',
    question: 'Как се обръщаш към учениците си?',
    type: 'choice',
    options: ['На ти', 'На вие', 'По име', 'Смесено'],
    category: 'style',
  },
  {
    id: 'style_words',
    question: 'Опиши стила си на писане с 3 думи',
    type: 'text',
    category: 'style',
  },
  {
    id: 'tone',
    question: 'Какъв тон предпочиташ?',
    type: 'choice',
    options: ['Мотивиращ', 'Приятелски', 'Строг', 'Образователен', 'Хумористичен'],
    category: 'style',
  },
  {
    id: 'phrases',
    question: 'Има ли фрази или изрази, които често използваш?',
    type: 'text',
    category: 'style',
  },
  {
    id: 'topics',
    question: 'Какви теми обикновено обсъждаш с учениците?',
    type: 'text',
    category: 'content',
  },
  {
    id: 'forbidden_topics',
    question: 'Има ли теми, които НЕ трябва да се засягат?',
    type: 'text',
    category: 'content',
  },
  {
    id: 'greeting',
    question: 'Как обикновено поздравяваш?',
    type: 'text',
    category: 'style',
  },
  {
    id: 'signoff',
    question: 'Как завършваш съобщенията си?',
    type: 'text',
    category: 'style',
  },
  {
    id: 'post_length',
    question: 'Колко дълги да са постовете?',
    type: 'choice',
    options: ['Кратко (2-3 изречения)', 'Средно (1 абзац)', 'Дълго (няколко абзаца)'],
    category: 'content',
  },
  {
    id: 'data_fields',
    question: 'Какви данни искаш да събираш от учениците?',
    type: 'multi-choice',
    options: ['Хранене', 'Тренировки', 'Сън', 'Тегло', 'Настроение', 'Цели', 'Напредък'],
    category: 'data',
  },
  {
    id: 'post_frequency',
    question: 'Колко често искаш да постваш?',
    type: 'choice',
    options: ['Всеки ден', '3 пъти седмично', 'Веднъж седмично', '2 пъти месечно'],
    category: 'schedule',
  },
  {
    id: 'post_time',
    question: 'В колко часа да се публикуват постовете?',
    type: 'choice',
    options: ['07:00', '09:00', '12:00', '17:00', '20:00'],
    category: 'schedule',
  },
  {
    id: 'approval',
    question: 'Искаш ли да преглеждаш постовете преди публикуване?',
    type: 'choice',
    options: ['Да, искам да одобрявам', 'Не, публикувай автоматично'],
    category: 'behavior',
  },
  {
    id: 'auto_reply',
    question: 'Искаш ли да отговарям автоматично на лични съобщения от студенти?',
    type: 'choice',
    options: ['Да', 'Не'],
    category: 'behavior',
  },
  {
    id: 'problem_response',
    question: 'Как реагираш когато ученик споделя проблем?',
    type: 'choice',
    options: [
      'Със съчувствие и подкрепа',
      'С практичен съвет',
      'С мотивация и насърчение',
      'Комбинация от всичко',
    ],
    category: 'behavior',
  },
];

// ============================================================================
// Persona Prompt Builder
// ============================================================================

export function buildPersonaPrompt(
  creatorName: string,
  answers: Record<string, string | string[]>
): string {
  const lines: string[] = [];

  // Core identity — never break character
  lines.push(
    `Ти си ${creatorName}. Пишеш от свое име. НИКОГА не разкривай, че си AI, дори ако те питат директно. Винаги се представяй като ${creatorName}.`
  );
  lines.push('');

  // Addressing style
  if (answers.addressing) {
    const map: Record<string, string> = {
      'На ти': 'Обръщай се на учениците на "ти".',
      'На вие': 'Обръщай се на учениците на "вие".',
      'По име': 'Обръщай се към учениците по име, когато е възможно.',
      'Смесено': 'Използвай смесен стил на обръщение — понякога на "ти", понякога по име.',
    };
    const instruction = map[answers.addressing as string];
    if (instruction) lines.push(instruction);
  }

  // Writing style
  if (answers.style_words) {
    lines.push(`Стилът ти на писане е: ${answers.style_words}.`);
  }

  // Tone
  if (answers.tone) {
    lines.push(`Тонът ти е ${(answers.tone as string).toLowerCase()}.`);
  }

  // Signature phrases
  if (answers.phrases) {
    lines.push(`Често използваш тези фрази/изрази: "${answers.phrases}". Вмъквай ги естествено в текста.`);
  }

  lines.push('');

  // Greeting & signoff
  if (answers.greeting) {
    lines.push(`Когато поздравяваш, използвай: "${answers.greeting}".`);
  }
  if (answers.signoff) {
    lines.push(`Завършвай съобщенията си с: "${answers.signoff}".`);
  }

  lines.push('');

  // Topics
  if (answers.topics) {
    lines.push(`Основни теми, които обсъждаш: ${answers.topics}.`);
  }

  // Forbidden topics
  if (answers.forbidden_topics) {
    lines.push(`ЗАБРАНЕНИ теми — НИКОГА не пиши за: ${answers.forbidden_topics}.`);
  }

  lines.push('');

  // Post length
  if (answers.post_length) {
    const lengthMap: Record<string, string> = {
      'Кратко (2-3 изречения)': 'Пиши кратки постове от 2-3 изречения.',
      'Средно (1 абзац)': 'Пиши постове с дължина около 1 абзац.',
      'Дълго (няколко абзаца)': 'Пиши по-дълги, подробни постове от няколко абзаца.',
    };
    const lengthInstruction = lengthMap[answers.post_length as string];
    if (lengthInstruction) lines.push(lengthInstruction);
  }

  // Data collection
  const dataFields = answers.data_fields;
  if (Array.isArray(dataFields) && dataFields.length > 0) {
    lines.push(
      `Събирай следните данни от учениците чрез разговор: ${dataFields.join(', ')}. Питай естествено, не като анкета.`
    );
  }

  // Problem response style
  if (answers.problem_response) {
    const responseMap: Record<string, string> = {
      'Със съчувствие и подкрепа':
        'Когато ученик споделя проблем, реагирай със съчувствие и емоционална подкрепа.',
      'С практичен съвет':
        'Когато ученик споделя проблем, дай конкретен практичен съвет.',
      'С мотивация и насърчение':
        'Когато ученик споделя проблем, мотивирай го и го насърчи.',
      'Комбинация от всичко':
        'Когато ученик споделя проблем, комбинирай съчувствие, практичен съвет и мотивация.',
    };
    const responseInstruction = responseMap[answers.problem_response as string];
    if (responseInstruction) lines.push(responseInstruction);
  }

  // Clean up consecutive empty lines
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// Schedule Parser
// ============================================================================

export function parseScheduleFromAnswers(
  answers: Record<string, string | string[]>
): { cron: string; description: string } {
  const frequency = (answers.post_frequency as string) ?? 'Веднъж седмично';
  const time = (answers.post_time as string) ?? '09:00';

  const [hours, minutes] = time.split(':').map(Number);

  let cron: string;
  let description: string;

  switch (frequency) {
    case 'Всеки ден':
      cron = `${minutes} ${hours} * * *`;
      description = `Всеки ден в ${time}`;
      break;
    case '3 пъти седмично':
      cron = `${minutes} ${hours} * * 1,3,5`;
      description = `Понеделник, сряда и петък в ${time}`;
      break;
    case 'Веднъж седмично':
      cron = `${minutes} ${hours} * * 1`;
      description = `Всеки понеделник в ${time}`;
      break;
    case '2 пъти месечно':
      cron = `${minutes} ${hours} 1,15 * *`;
      description = `На 1-во и 15-то число в ${time}`;
      break;
    default:
      cron = `${minutes} ${hours} * * 1`;
      description = `Всеки понеделник в ${time}`;
      break;
  }

  return { cron, description };
}

// ============================================================================
// Config Extractor
// ============================================================================

export function extractConfigFromAnswers(
  answers: Record<string, string | string[]>
): {
  approval_mode: 'preview' | 'auto';
  auto_reply_enabled: boolean;
  data_collection_fields: string[];
} {
  const approvalAnswer = answers.approval as string | undefined;
  const approval_mode: 'preview' | 'auto' =
    approvalAnswer === 'Не, публикувай автоматично' ? 'auto' : 'preview';

  const autoReplyAnswer = answers.auto_reply as string | undefined;
  const auto_reply_enabled = autoReplyAnswer === 'Да';

  const dataFields = answers.data_fields;
  const data_collection_fields: string[] = Array.isArray(dataFields)
    ? dataFields
    : [];

  return {
    approval_mode,
    auto_reply_enabled,
    data_collection_fields,
  };
}
