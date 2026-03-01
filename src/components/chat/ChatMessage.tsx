'use client';

import type { ChatMessage as ChatMessageType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, BarChart3 } from 'lucide-react';

// ── Minimal markdown renderer ───────────────────────────────────────────────

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(s: string): string {
  const links: [string, string][] = [];
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => {
    links.push([t, u]);
    return `\x00L${links.length - 1}\x00`;
  });
  s = escHtml(s);
  s = s.replace(/\x00L(\d+)\x00/g, (_, i) => {
    const [t, u] = links[+i];
    if (u.includes('book-advisor')) {
      return `<span class="text-ws-green underline font-medium cursor-default">${escHtml(t)}</span>`;
    }
    return `<a href="${u}" target="_blank" rel="noopener noreferrer" class="text-ws-green underline font-medium hover:opacity-70 transition-opacity">${escHtml(t)}</a>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return s;
}

function sanitizeDashes(s: string): string {
  return s.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ');
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:-]+\|/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

function renderTable(rows: string[]): string {
  // rows[0] = header, rows[1] = separator (skipped), rows[2..] = body
  const header = parseTableRow(rows[0]);
  const body = rows.slice(2).map(parseTableRow);

  let html = '<table class="w-full text-sm mt-1.5 mb-1.5">';
  html += '<thead><tr>';
  for (const cell of header) {
    html += `<th class="text-left font-semibold text-ws-text-secondary py-1 pr-4">${renderInline(cell)}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of body) {
    html += '<tr class="border-t border-ws-border/50">';
    for (const cell of row) {
      html += `<td class="py-1 pr-4">${renderInline(cell)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function renderMarkdown(md: string): string {
  md = sanitizeDashes(md);
  const lines = md.split('\n');
  const out: string[] = [];
  let olOpen = false;
  let ulOpen = false;
  let tableRows: string[] = [];

  const closeOl = () => { if (olOpen) { out.push('</ol>'); olOpen = false; } };
  const closeUl = () => { if (ulOpen) { out.push('</ul>'); ulOpen = false; } };
  const closeTable = () => {
    if (tableRows.length >= 2) {
      out.push(renderTable(tableRows));
    }
    tableRows = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table handling: collect consecutive pipe-rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      closeOl();
      closeUl();
      if (isTableSeparator(trimmed) && tableRows.length === 1) {
        // separator row after header - keep collecting
        tableRows.push(trimmed);
        continue;
      }
      if (tableRows.length >= 2 || tableRows.length === 0) {
        // body row or new header row
        tableRows.push(trimmed);
        continue;
      }
      // first row (header)
      tableRows.push(trimmed);
      continue;
    }

    // Non-table line: flush any pending table
    if (tableRows.length > 0) closeTable();

    const olM = line.match(/^(\d+)\.\s+(.+)/);
    const ulM = line.match(/^[-*]\s+(.+)/);
    const headingM = line.match(/^(#{1,3})\s+(.+)/);

    if (headingM) {
      closeOl();
      closeUl();
      const level = headingM[1].length;
      const cls = level === 1 ? 'text-sm font-semibold mt-3 mb-1' : level === 2 ? 'text-sm font-semibold mt-2.5 mb-1' : 'text-sm font-semibold mt-2 mb-0.5';
      out.push(`<p class="${cls}">${renderInline(headingM[2])}</p>`);
    } else if (olM) {
      closeUl();
      if (!olOpen) { out.push('<ol class="space-y-1.5 list-none pl-0 mt-1">'); olOpen = true; }
      out.push(`<li class="flex gap-2"><span class="text-ws-text-tertiary flex-shrink-0 text-xs mt-0.5">${olM[1]}.</span><span>${renderInline(olM[2])}</span></li>`);
    } else if (ulM) {
      closeOl();
      if (!ulOpen) { out.push('<ul class="space-y-1.5 list-none pl-0 mt-1">'); ulOpen = true; }
      out.push(`<li class="flex gap-2"><span class="text-ws-text-tertiary flex-shrink-0">-</span><span>${renderInline(ulM[1])}</span></li>`);
    } else {
      closeOl();
      closeUl();
      if (trimmed === '') {
        if (out.length && out[out.length - 1] !== '<div class="h-2"></div>') {
          out.push('<div class="h-2"></div>');
        }
      } else {
        out.push(`<p class="leading-relaxed">${renderInline(line)}</p>`);
      }
    }
  }
  if (tableRows.length > 0) closeTable();
  closeOl();
  closeUl();
  return out.join('');
}

// ── Analysis section renderer ───────────────────────────────────────────────

const SECTION_HEADERS = [
  'What the numbers show',
  'What this means for you',
  'What to explore next',
];

function renderAnalysisMarkdown(md: string): string {
  // Split by section headers and render each section with distinct styling
  const sections: { header: string; content: string }[] = [];
  let currentHeader = '';
  let currentLines: string[] = [];

  for (const line of md.split('\n')) {
    const headerMatch = SECTION_HEADERS.find(
      (h) => line.replace(/\*\*/g, '').trim().toLowerCase() === h.toLowerCase()
    );
    if (headerMatch) {
      if (currentHeader || currentLines.length > 0) {
        sections.push({ header: currentHeader, content: currentLines.join('\n').trim() });
      }
      currentHeader = headerMatch;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentHeader || currentLines.length > 0) {
    sections.push({ header: currentHeader, content: currentLines.join('\n').trim() });
  }

  // If no structured sections found, fall back to regular rendering
  if (sections.every((s) => !s.header)) {
    return renderMarkdown(md);
  }

  const out: string[] = [];
  for (const section of sections) {
    if (!section.content && !section.header) continue;

    if (section.header) {
      const iconClass =
        section.header === 'What the numbers show'
          ? 'bg-ws-green/10 text-ws-green'
          : section.header === 'What this means for you'
            ? 'bg-amber-50 text-amber-600'
            : 'bg-blue-50 text-blue-600';

      const label =
        section.header === 'What the numbers show'
          ? 'Simulation data'
          : section.header === 'What this means for you'
            ? 'AI interpretation'
            : 'Your next steps';

      out.push(
        `<div class="mt-3 first:mt-0">` +
          `<div class="flex items-center gap-1.5 mb-1.5">` +
            `<span class="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${iconClass}">${label}</span>` +
          `</div>` +
          `<div>${renderMarkdown(section.content)}</div>` +
        `</div>`
      );
    } else if (section.content) {
      out.push(renderMarkdown(section.content));
    }
  }

  return out.join('');
}

// ── Extract suggestions from "What to explore next" ─────────────────────────

function extractSuggestions(content: string): string[] {
  const suggestions: string[] = [];
  const exploreIdx = content.toLowerCase().indexOf('what to explore next');
  if (exploreIdx === -1) return suggestions;

  const afterExplore = content.slice(exploreIdx);
  // Match quoted questions or lines that end with ?
  const questionPattern = /[""]([^""]+\?)[""]/g;
  let match;
  while ((match = questionPattern.exec(afterExplore)) !== null) {
    suggestions.push(match[1]);
  }

  // Fallback: match lines ending with ?
  if (suggestions.length === 0) {
    const lines = afterExplore.split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[-*\d.)\s]+/, '').replace(/\*\*/g, '').trim();
      if (cleaned.endsWith('?') && cleaned.length > 10 && cleaned.length < 120) {
        suggestions.push(cleaned);
      }
    }
  }

  return suggestions.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────

interface ChatMessageProps {
  message: ChatMessageType;
  onSuggestionClick?: (text: string) => void;
}

export default function ChatMessage({ message, onSuggestionClick }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAnalysis = message.isAnalysis;
  const isSummary = isAnalysis && message.analysisDepth === 'summary';
  const suggestions = isAnalysis && !isSummary ? extractSuggestions(message.content) : [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 mt-0.5 flex-shrink-0 ${
          isAnalysis ? 'bg-ws-green/15' : 'bg-ws-green/10'
        }`}>
          {isAnalysis ? (
            <BarChart3 size={14} className="text-ws-green" />
          ) : (
            <Bot size={14} className="text-ws-green" />
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-[85%]">
        {isUser ? (
          <div className="px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed bg-ws-black text-white">
            {message.content}
          </div>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {message.toolCalls.map((tc, i) => {
                  const scenarioName = tc.toolName === 'run_simulation' && tc.input?.scenario_name
                    ? String(tc.input.scenario_name)
                    : null;
                  return (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="text-[10px] font-normal gap-1 bg-ws-green-light text-ws-green border-0"
                    >
                      <Sparkles size={10} />
                      {tc.toolName === 'run_simulation' && (scenarioName ? `Simulated: ${scenarioName}` : 'Ran simulation')}
                      {tc.toolName === 'compare_scenarios' && 'Compared scenarios'}
                      {tc.toolName === 'get_portfolio_summary' && 'Analyzed portfolio'}
                      {tc.toolName === 'add_goal' && 'Added goal'}
                      {tc.toolName === 'update_profile' && 'Updated profile'}
                      {tc.toolName === 'explain_tradeoff' && 'Tradeoff analysis'}
                    </Badge>
                  );
                })}
              </div>
            )}
            {isAnalysis && (
              <Badge
                variant="secondary"
                className="text-[10px] font-normal gap-1 bg-ws-green-light text-ws-green border-0 w-fit mb-1"
              >
                <BarChart3 size={10} />
                {isSummary
                  ? (message.scenarioName ? message.scenarioName : 'Summary')
                  : 'Analysis of simulation results'}
              </Badge>
            )}
            {message.content && (
              <div
                className={`px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm border ${
                  isAnalysis
                    ? 'bg-white text-ws-text border-ws-green/20'
                    : 'bg-white text-ws-text border-ws-border'
                }`}
                dangerouslySetInnerHTML={{
                  __html: isAnalysis && !isSummary
                    ? renderAnalysisMarkdown(message.content)
                    : renderMarkdown(message.content),
                }}
              />
            )}
            {/* Decision prompt pills */}
            {suggestions.length > 0 && onSuggestionClick && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => onSuggestionClick(suggestion)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-ws-green-light text-ws-green hover:bg-ws-green/20 transition-colors text-left leading-snug"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
