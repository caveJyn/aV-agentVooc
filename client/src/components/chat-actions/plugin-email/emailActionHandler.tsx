// client/src/components/chat-actions/plugin-email/EmailActionHandler.tsx
import { EmailListDisplay } from './emailListDisplay';
import { EmailReplyForm } from './emailReplyForm';
import { EmailActionProps } from './types';
import AIWriter from 'react-aiwriter';

export function EmailActionHandler({ message, setInput, handleSendMessage }: EmailActionProps) {
  const emailBodyMap = new Map<string, string>();
  if (message.source === 'CHECK_EMAIL' && !message.metadata?.emails && message.text) {
    const emailSections = message.text.split(/\n\n(?=\d+\.\s+From:)/);
    emailSections.forEach((section: string) => {
      const emailIdMatch = section.match(/Email ID: ([^\n]+)/);
      const bodyMatch = section.match(/Body:([\s\S]*?)(?=\n\n|\n...and \d+ more email\(s\)|$)/);
      if (emailIdMatch && bodyMatch) {
        let body = bodyMatch[1]
          .trim()
          .replace(/https?:\/\/[^\s<>\[\]]+/g, '')
          .replace(/\[image: [^\]]+\]/g, '')
          .replace(/[\u200B-\u200F\uFEFF]+/g, '')
          .replace(/\s*\n\s*/g, '\n')
          .replace(/\n{2,}/g, '\n\n')
          .trim();
        if (body) emailBodyMap.set(emailIdMatch[1].trim(), body);
      }
    });
  }

  if (message.source === 'CHECK_EMAIL' && message.metadata?.emails?.length) {
    return (
      <EmailListDisplay
        emails={message.metadata.emails}
        emailBodyMap={emailBodyMap}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
      />
    );
  }

  if (message.metadata?.pendingReply) {
    return (
      <div>
        <AIWriter>{message.text}</AIWriter>
        <EmailReplyForm
          emailId={message.metadata.emailId || ''}
          pendingReply={message.metadata.pendingReply}
          setInput={setInput}
          handleSendMessage={handleSendMessage}
        />
      </div>
    );
  }

  return <AIWriter>{message.text}</AIWriter>;
}