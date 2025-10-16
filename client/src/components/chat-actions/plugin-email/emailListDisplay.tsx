// client/src/components/chat-actions/plugin-email/EmailListDisplay.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {  EmailListDisplayProps } from './types';

export function EmailListDisplay({
  emails,
  emailBodyMap,
  setInput,
  handleSendMessage,
}: EmailListDisplayProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const processEmailContent = (content: string) => {
    if (!content) return content;
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    return content.replace(urlRegex, (url) =>
      url
        .replace(/([/=&?])/g, '$1')
        .replace(/([.-])/g, '$1')
        .replace(/(.{30})/g, '$1')
    );
  };

  const renderDate = (date: string | Date | undefined): string => {
    if (!date) return 'Unknown';
    try {
      const parsedDate = new Date(date);
      return isNaN(parsedDate.getTime())
        ? 'Invalid Date'
        : parsedDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
    } catch {
      return 'Invalid Date';
    }
  };

  const handleEmailClick = (emailId: string) => {
    setInput(`generate a reply for this emailId: ${emailId}`);
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmails((prev) => {
      const newSet = new Set(prev);
      newSet.has(emailId) ? newSet.delete(emailId) : newSet.add(emailId);
      return newSet;
    });
  };

  return (
    <div className="mt-2 space-y-2 max-w-full">
      <div className="text-sm sm:text-base">
        <p>Here are your emails from the last 24 hours:</p>
        <p className="mt-1 text-xs sm:text-sm">
          Reply using 'reply to emailId: &lt;id&gt; message: &lt;text&gt;'
        </p>
        <p className="text-xs sm:text-sm">
          Or click an email to generate a reply.
        </p>
        <br /><br />
      </div>
      <div className="space-y-3 mt-4">
        {emails.map((email, index) => {
          const body = email.body || emailBodyMap.get(email.emailId) || 'No content';
          const isLongBody = body.length > 500;
          const isExpanded = expandedEmails.has(email.emailId);
          const displayBody = processEmailContent(
            isLongBody && !isExpanded ? `${body.substring(0, 500)}...` : body
          );

          return (
            <div key={email.emailId} className="flex items-start gap-2 sm:gap-3 w-full max-w-full">
              <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-agentvooc-accent/50 border border-agentvooc-accent/30 flex items-center justify-center text-xs sm:text-sm font-medium">
                {index + 1}
              </div>
              <div
                className="flex-1 min-w-0 max-w-full border border-agentvooc-accent/30 rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-agentvooc-accent/10 transition-colors overflow-hidden"
                style={{ wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%', width: '100%' }}
                onClick={() => handleEmailClick(email.emailId)}
              >
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">From:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {processEmailContent(email.fromName || email.from || 'Unknown')}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Subject:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {processEmailContent(email.subject || 'No subject')}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Date:</span>
                  <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                    {renderDate(email.date)}
                  </div>
                </div>
                <div className="mb-2 overflow-hidden">
                  <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Body:</span>
                  <div
                    className="ml-2 text-sm sm:text-base whitespace-pre-wrap break-all overflow-wrap-anywhere max-w-full overflow-hidden"
                    style={{ wordBreak: 'break-all', overflowWrap: 'break-word', maxWidth: '100%' }}
                  >
                    {displayBody}
                  </div>
                </div>
                {isLongBody && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs sm:text-sm text-agentvooc-accent"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEmailExpansion(email.emailId);
                    }}
                  >
                    {isExpanded ? (
                      <>
                        Collapse <ChevronUp className="ml-1 size-3 sm:size-4" />
                      </>
                    ) : (
                      <>
                        Expand <ChevronDown className="ml-1 size-3 sm:size-4" />
                      </>
                    )}
                  </Button>
                )}
                <div className="mt-3 pt-2 border-t overflow-hidden">
                  <span className="text-xs sm:text-sm font-medium text-agentvooc-accent">Email ID:</span>
                  <div className="ml-2 text-xs sm:text-sm break-all flex items-center justify-center font-mono bg-agentvooc-accent/10 px-2 py-1 rounded mt-1 max-w-full overflow-hidden">
                    {email.emailId}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}