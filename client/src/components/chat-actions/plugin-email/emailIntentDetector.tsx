// client/src/components/chat-actions/plugin-email/EmailIntentDetector.tsx

export const EmailIntentDetector = {
  detectCheckEmail: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes('check email') ||
      lowerText.includes('check mail') ||
      lowerText.includes('new email') ||
      lowerText.includes('receive email') ||
      lowerText.includes('have i received') ||
      lowerText.includes('any email') ||
      lowerText.includes('inbox') ||
      lowerText.includes('mailbox') ||
      lowerText.includes('show email') ||
      lowerText.includes('read email')
    );
  },

  detectReplyEmail: (text: string): boolean => {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes('reply to emailid') ||
      lowerText.includes('respond to emailid') ||
      lowerText.includes('generate a reply') ||
      lowerText.includes('send reply') ||
      lowerText.includes('confirm reply') ||
      lowerText.includes('reply to email')
    );
  },

  extractEmailId: (text: string): string | undefined => {
    const emailIdMatch = text.match(/emailId:\s*([^\s]+)/i);
    if (emailIdMatch) return emailIdMatch[1].replace(/^[<]+|[>]+$/g, '').trim();
    const emailNumberMatch = text.match(/reply to email (\d+)/i);
    if (emailNumberMatch) return emailNumberMatch[1];
    return undefined;
  },

  extractReplyBody: (text: string): string | undefined => {
    const bodyMatch = text.match(/message:\s*([^\.]+)/i);
    return bodyMatch ? bodyMatch[1].trim() : undefined;
  },
};