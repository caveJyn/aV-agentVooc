// client/src/components/chat-actions/plugin-email/EmailReplyForm.tsx
import { Button } from '@/components/ui/button';
import { EmailReplyFormProps } from './types';

export function EmailReplyForm({
  emailId,
  pendingReply,
  setInput,
  handleSendMessage,
}: EmailReplyFormProps) {
  const handleConfirmReply = () => {
    setInput('confirm reply');
    handleSendMessage({ preventDefault: () => {} } as any);
  };

  const handleEditReply = () => {
    const replyContent = pendingReply?.body || '';
    setInput(`reply to this emailId: ${emailId} message: ${replyContent}`);
  };

  return (
    <div className="mt-2 flex gap-2">
      <Button variant="default" onClick={handleConfirmReply}>
        Confirm Reply
      </Button>
      <Button variant="default" onClick={handleEditReply}>
        Modify Email
      </Button>
    </div>
  );
}