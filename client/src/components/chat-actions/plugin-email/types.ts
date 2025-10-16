// client/src/components/chat-actions/plugin-email/types.ts
export interface EmailMetadata {
  emailId: string;
  from?: string;
  fromName?: string;
  subject?: string;
  date?: string | Date;
  body?: string;
  originalEmailId?: string;
  pendingReply?: any;
}

export interface EmailActionProps {
  agentId: string;
  message: ContentWithUser;
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface EmailListDisplayProps {
  emails: EmailMetadata[];
  emailBodyMap: Map<string, string>;
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface EmailReplyFormProps {
  emailId: string;
  pendingReply: any;
  setInput: (input: string) => void;
  handleSendMessage: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ContentWithUser {
  text: string;
  user: string;
  createdAt: number;
  isLoading?: boolean;
  source?: string;
  metadata?: {
    emails?: EmailMetadata[];
    emailId?: string;
    pendingReply?: any;
    action?: string;
  };
}