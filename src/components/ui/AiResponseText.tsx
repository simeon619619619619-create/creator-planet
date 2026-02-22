import React from 'react';

interface AiResponseTextProps {
  text: string;
  className?: string;
}

/**
 * Renders AI response text with proper formatting:
 * - Splits paragraphs properly
 * - Handles numbered lists (1. 2. 3.) with styled cards
 * - Handles "1 -" style action items with enhanced styling
 * - Handles line breaks within paragraphs
 * - Renders clean, readable text without markdown artifacts
 */
const AiResponseText: React.FC<AiResponseTextProps> = ({ text, className = '' }) => {
  // Split text into paragraphs (double newline or single newline followed by number)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim());

  const renderParagraph = (paragraph: string, index: number) => {
    // Check for "1 - Title - Description" style action items (common in reports)
    const actionItemMatch = paragraph.match(/^(\d+)\s*[-–—]\s*(.+?)(?:\s*[-–—]\s*(.+))?$/s);
    if (actionItemMatch) {
      const [, number, titleOrContent, description] = actionItemMatch;

      // If there's a description, render as a card with title and description
      if (description) {
        return (
          <div key={index} className="bg-white border border-slate-200 rounded-lg p-4 my-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                {number}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-1">{titleOrContent.trim()}</h4>
                <p className="text-slate-600 text-sm">{description.trim()}</p>
              </div>
            </div>
          </div>
        );
      }

      // Single content without separate description
      return (
        <div key={index} className="bg-white border border-slate-200 rounded-lg p-4 my-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
              {number}
            </div>
            <div className="flex-1">
              <p className="text-slate-700">{titleOrContent.trim()}</p>
            </div>
          </div>
        </div>
      );
    }

    // Check if this looks like a standard numbered list item (1. content)
    const numberedMatch = paragraph.match(/^(\d+)\.\s*(.+)$/s);
    if (numberedMatch) {
      const [, number, content] = numberedMatch;
      return (
        <div key={index} className="flex gap-3 my-2">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-xs shrink-0">
            {number}
          </span>
          <span className="text-slate-700">{content.trim()}</span>
        </div>
      );
    }

    // Check if paragraph contains multiple numbered items on separate lines
    const lines = paragraph.split('\n').filter(l => l.trim());
    const hasNumberedLines = lines.some(l => /^\d+[\.\s\-]/.test(l.trim()));

    if (hasNumberedLines && lines.length > 1) {
      return (
        <div key={index} className="space-y-2 my-3">
          {lines.map((line, lineIdx) => {
            // Check for "1 - " or "1. " style
            const lineActionMatch = line.trim().match(/^(\d+)\s*[-–—]\s*(.+?)(?:\s*[-–—]\s*(.+))?$/);
            if (lineActionMatch) {
              const [, num, title, desc] = lineActionMatch;
              return (
                <div key={lineIdx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
                      {num}
                    </div>
                    <div className="flex-1">
                      {desc ? (
                        <>
                          <h4 className="font-semibold text-slate-900 text-sm">{title.trim()}</h4>
                          <p className="text-slate-600 text-sm">{desc.trim()}</p>
                        </>
                      ) : (
                        <p className="text-slate-700 text-sm">{title.trim()}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const lineMatch = line.trim().match(/^(\d+)\.\s*(.+)$/);
            if (lineMatch) {
              const [, num, content] = lineMatch;
              return (
                <div key={lineIdx} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-xs shrink-0">
                    {num}
                  </span>
                  <span className="text-slate-700">{content.trim()}</span>
                </div>
              );
            }
            return <p key={lineIdx} className="text-slate-700">{line.trim()}</p>;
          })}
        </div>
      );
    }

    // Check if this looks like a section header (short text ending with colon)
    if (paragraph.trim().endsWith(':') && paragraph.length < 100) {
      return (
        <h3 key={index} className="font-semibold text-slate-900 mt-4 mb-2 first:mt-0">
          {paragraph.trim()}
        </h3>
      );
    }

    // Regular paragraph - handle single line breaks as spaces or soft breaks
    const cleanedParagraph = paragraph
      .split('\n')
      .map(l => l.trim())
      .join(' ')
      .trim();

    return (
      <p key={index} className="my-2 text-slate-700 first:mt-0 last:mb-0">
        {cleanedParagraph}
      </p>
    );
  };

  return (
    <div className={`text-sm leading-relaxed ${className}`}>
      {paragraphs.map((para, idx) => renderParagraph(para, idx))}
    </div>
  );
};

export default AiResponseText;
