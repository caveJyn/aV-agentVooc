import { Button } from "@/components/ui/button";
import {
  ChatBubble,
  ChatBubbleMessage,
  ChatBubbleTimestamp,
} from "@/components/ui/chat/chat-bubble";
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useTransition, animated, type AnimatedProps, type SpringValues } from "@react-spring/web";
import { Paperclip, Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Content, UUID } from "@elizaos/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { cn, moment } from "@/lib/utils";
import { Avatar, AvatarImage } from "./ui/avatar";
import CopyButton from "./copy-button";
import ChatTtsButton from "./ui/chat/chat-tts-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { IAttachment } from "@/types";
import { AudioRecorder } from "./audio-recorder";
import { Badge } from "./ui/badge";

type EmailMetadata = {
  emailId: string;
  from?: string;
  fromName?: string;
  subject?: string;
  date?: string | Date;
  body?: string;
  originalEmailId?: string;
};

type ExtraContentFields = {
  user: string;
  createdAt: number;
  isLoading?: boolean;
  metadata?: {
    emails?: EmailMetadata[];
    emailId?: string;
    pendingReply?: any;
  };
};

type ContentWithUser = Content & ExtraContentFields;

type AnimatedDivProps = AnimatedProps<{ style: React.CSSProperties }> & {
  children?: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
};

export default function Page({ agentId }: { agentId: UUID }) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const queryClient = useQueryClient();

  // Helper function to process email content
  const processEmailContent = (content: string) => {
    if (!content) return content;
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/gi;
    return content.replace(urlRegex, (url) => {
      return url
        .replace(/([/=&?])/g, '$1') // Zero-width space after delimiters
        .replace(/([.-])/g, '$1')    // Zero-width space after dots and dashes
        .replace(/(.{30})/g, '$1');  // Zero-width space every 30 characters
    });
  };

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.max(textarea.scrollHeight, 48);
      textarea.style.height = `${newHeight}px`;
    }
  }, [input]);

  const getMessageVariant = (role: string) =>
    role !== "user" ? "received" : "sent";

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const isAtBottom = true;
  const disableAutoScroll = useCallback(() => {}, []);

  const handleEmailClick = (emailId: string) => {
    setInput(`generate a reply for this emailId: ${emailId}`);
    inputRef.current?.focus();
  };

  const handleConfirmReply = () => {
    setInput("confirm reply");
    formRef.current?.requestSubmit();
  };

  const handleEditReply = (emailId: string, replyContent: string) => {
    const newInput = `reply to this emailId: ${emailId} message: ${replyContent}`;
    setInput(newInput);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    scrollToBottom();
    inputRef.current?.focus();
  }, [scrollToBottom]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (e.nativeEvent.isComposing) return;
      handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input) return;

    const attachments: IAttachment[] | undefined = selectedFile
      ? [
          {
            url: URL.createObjectURL(selectedFile),
            contentType: selectedFile.type,
            title: selectedFile.name,
          },
        ]
      : undefined;

    const newMessages = [
      {
        text: input,
        user: "user",
        createdAt: Date.now(),
        attachments,
      },
      {
        text: "",
        user: "system",
        isLoading: true,
        createdAt: Date.now(),
      },
    ];

    queryClient.setQueryData(
      ["messages", agentId],
      (old: ContentWithUser[] = []) => {
        return [...old, ...newMessages];
      }
    );

    sendMessageMutation.mutate({
      message: input,
      selectedFile: selectedFile || null,
    });

    setSelectedFile(null);
    setInput("");
    formRef.current?.reset();
    scrollToBottom();
  };

  const sendMessageMutation = useMutation({
    mutationKey: ["send_message", agentId],
    mutationFn: ({
      message,
      selectedFile,
    }: {
      message: string;
      selectedFile: File | null;
    }) => {
      return apiClient.sendMessage(agentId, message, selectedFile);
    },
    onSuccess: (data: ContentWithUser[] | { message: string }) => {
      const newMessages = Array.isArray(data)
        ? data.map((msg) => ({
            ...msg,
            createdAt: msg.createdAt || Date.now(),
          }))
        : [];
      queryClient.setQueryData(
        ["messages", agentId],
        (old: ContentWithUser[] = []) => {
          const updated = [
            ...old.filter((msg) => !msg.isLoading),
            ...newMessages,
          ];
          return updated;
        }
      );
      scrollToBottom();
    },
    onError: (e: any) => {
      console.error("Send message error:", e);
      queryClient.setQueryData(
        ["messages", agentId],
        (old: ContentWithUser[] = []) => old.filter((msg) => !msg.isLoading)
      );
      toast({
        variant: "destructive",
        title: "Unable to send message",
        description: e.message.includes("Character not found or access denied")
          ? "This character does not exist or you don't have access."
          : e.message || "Failed to send message",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const messages = queryClient.getQueryData<ContentWithUser[]>(["messages", agentId]) || [];

  // Fallback email body map for older messages
  const emailBodyMap = new Map<string, string>();
  messages.forEach((msg) => {
    if (msg.source === "CHECK_EMAIL" && !msg.metadata?.emails && msg.text) {
      const emailSections = msg.text.split(/\n\n(?=\d+\.\s+From:)/);
      emailSections.forEach((section: string) => {
        const emailIdMatch = section.match(/Email ID: ([^\n]+)/);
        const bodyMatch = section.match(/Body:([\s\S]*?)(?=\n\n|\n...and \d+ more email\(s\)|$)/);
        if (emailIdMatch && bodyMatch) {
          let body = bodyMatch[1].trim();
          body = body
            .replace(/https?:\/\/[^\s<>\[\]]+/g, "") // Remove URLs
            .replace(/\[image: [^\]]+\]/g, "") // Remove image placeholders
            .replace(/[\u200B-\u200F\uFEFF]+/g, "") // Remove zero-width spaces
            .replace(/\s*\n\s*/g, "\n") // Normalize newlines
            .replace(/\n{2,}/g, "\n\n") // Limit consecutive newlines
            .trim();
          if (body) {
            emailBodyMap.set(emailIdMatch[1].trim(), body);
          }
        }
      });
    }
  });

  const renderDate = (date: string | Date | undefined): string => {
    if (!date) return "Unknown";
    try {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) return "Invalid Date";
      return parsedDate.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "Invalid Date";
    }
  };

  const transitions = useTransition(messages, {
    keys: (message: ContentWithUser) => `${message.createdAt}-${message.user}-${message.text}`,
    from: { opacity: 0, transform: "translateY(50px)" },
    enter: { opacity: 1, transform: "translateY(0px)" },
    leave: { opacity: 0, transform: "translateY(10px)" },
  });

  const CustomAnimatedDiv = animated.div as React.ComponentType<
    AnimatedDivProps & React.RefAttributes<HTMLDivElement>
  >;

  return (
    <div className="flex flex-col w-full h-[calc(95dvh)] p-6 bg-agentvooc-secondary-bg">
      <div className="flex-1 overflow-y-auto h-[calc(100dvh-150px)]">
        <ChatMessageList
          scrollRef={scrollRef}
          isAtBottom={isAtBottom}
          scrollToBottom={scrollToBottom}
          disableAutoScroll={disableAutoScroll}
        >
          {transitions((style: SpringValues<{ opacity: number; transform: string }>, message: ContentWithUser) => {
            const variant = getMessageVariant(message?.user);
            return (
              <CustomAnimatedDiv
                style={{
                  ...style,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                  padding: "1rem",
                }}
              >
                <ChatBubble
                  variant={variant}
                  className="flex flex-row items-center gap-2 border-agentvooc-accent/30 rounded-lg"
                >
                  {message?.user !== "user" ? (
                    <Avatar className="size-8 p-1 border border-agentvooc-accent/30 rounded-full select-none">
                      <AvatarImage />
                    </Avatar>
                  ) : null}
                  <div className="flex flex-col w-full">
                    <ChatBubbleMessage isLoading={message?.isLoading}>
                      {/* Render all messages as plain text */}
                      <div className="whitespace-pre-wrap">{message.text}</div>

                      {(message?.metadata?.emails ?? []).length > 0 && (
                        <div className="mt-2 space-y-2 max-w-full">
                          <div className="text-sm sm:text-base">
                            <p>Here are your emails from the last 24 hours:</p>
                            <p className="mt-1 text-xs sm:text-sm">
                              Reply using 'reply to emailId: &lt;id&gt; message: &lt;text&gt;'
                            </p>
                            <p className="text-xs sm:text-sm">
                              Or simply click on the email to autofill the chat box and hit send to generate a reply.
                            </p>
                            <br /><br />
                          </div>

                          <div className="space-y-3 mt-4">
                            {message.metadata?.emails?.map((email: EmailMetadata, index: number) => {
                              let body = email.body || emailBodyMap.get(email.emailId) || "No content";
                              const isLongBody = body.length > 500;
                              const isExpanded = expandedEmails.has(email.emailId);
                              const rawDisplayBody = isLongBody && !isExpanded ? `${body.substring(0, 500)}...` : body;
                              const displayBody = processEmailContent(rawDisplayBody);

                              return (
                                <div key={email.emailId} className="flex items-start gap-2 sm:gap-3 w-full max-w-full">
                                  <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-agentvooc-accent/50 border border-agentvooc-accent/30 flex items-center justify-center text-xs sm:text-sm font-medium">
                                    {index + 1}
                                  </div>
                                  <div
                                    className="flex-1 min-w-0 max-w-full border border-agentvooc-accent/30 rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-agentvooc-accent/10 transition-colors overflow-hidden email-content"
                                    style={{
                                      wordBreak: 'break-all',
                                      overflowWrap: 'break-word',
                                      maxWidth: '100%',
                                      width: '100%',
                                    }}
                                    onClick={() => handleEmailClick(email.emailId)}
                                  >
                                    <div className="mb-2 overflow-hidden">
                                      <span className="text-sm sm:text-base font-medium text-agentvooc-accent">From:</span>
                                      <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                                        {processEmailContent(email.fromName || email.from || "Unknown")}
                                      </div>
                                    </div>
                                    <div className="mb-2 overflow-hidden">
                                      <span className="text-sm sm:text-base font-medium text-agentvooc-accent">Subject:</span>
                                      <div className="ml-2 text-sm sm:text-base break-all overflow-wrap-anywhere overflow-hidden max-w-full">
                                        {processEmailContent(email.subject || "No subject")}
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
                                        style={{
                                          wordBreak: 'break-all',
                                          overflowWrap: 'break-word',
                                          maxWidth: '100%',
                                        }}
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
                      )}
                      {message?.metadata?.pendingReply && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="default"
                            onClick={handleConfirmReply}
                          >
                            Confirm Reply
                          </Button>
                          <Button
                            variant="default"
                            onClick={() =>
                              handleEditReply(
                                message.metadata?.emailId || "",
                                message.metadata?.pendingReply?.body || message.text
                              )
                            }
                          >
                            Modify Email
                          </Button>
                        </div>
                      )}
                      <div>
                        {message?.attachments?.map((attachment: IAttachment) => (
                          <div
                            className="flex flex-col gap-1 mt-2"
                            key={`${attachment.url}-${attachment.title}`}
                          >
                            {(attachment.contentType?.startsWith("image/") ?? false) ? (
                              <img
                                alt={attachment.title || "attachment"}
                                src={attachment.url}
                                width="100%"
                                height="100%"
                                className="w-64 rounded-lg"
                              />
                            ) : (
                              <span>{attachment.title}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </ChatBubbleMessage>
                    <div className="flex items-center gap-4 justify-between w-full mt-1">
                      {message?.text && !message?.isLoading ? (
                        <div className="flex items-center gap-1">
                          <CopyButton text={message?.text} />
                          <ChatTtsButton agentId={agentId} text={message?.text} />
                        </div>
                      ) : null}
                      <div
                        className={cn([
                          message?.isLoading ? "mt-2" : "",
                          "flex items-center justify-between gap-4 select-none",
                        ])}
                      >
                        {message?.source ? (
                          <Badge variant="outline">
                            {message.source}
                          </Badge>
                        ) : null}
                        {message?.action ? (
                          <Badge variant="outline">
                            {message.action}
                          </Badge>
                        ) : null}
                        {message?.createdAt ? (
                          <ChatBubbleTimestamp
                            timestamp={moment(message?.createdAt).format("LT")}
                            className=""
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </ChatBubble>
              </CustomAnimatedDiv>
            );
          })}
        </ChatMessageList>
      </div>
      <div className="px-4 pb-4">
        <form
          ref={formRef}
          onSubmit={handleSendMessage}
          className="relative rounded-lg border border-agentvooc-accent/30"
        >
          {selectedFile ? (
            <div className="p-3 flex">
              <div className="relative rounded-lg border border-agentvooc-accent/30 p-2">
                <Button
                  onClick={() => setSelectedFile(null)}
                  className="absolute -right-2 -top-2 size-[22px] ring-2 ring-agentvooc-secondary-bg"
                  variant="outline"
                  size="icon"
                >
                  <X />
                </Button>
                {selectedFile.type.startsWith("image/") ? (
                  <img
                    alt="Selected file"
                    src={URL.createObjectURL(selectedFile)}
                    height="100%"
                    width="100%"
                    className="aspect-square object-contain w-16 rounded-lg"
                  />
                ) : (
                  <span>{selectedFile.name}</span>
                )}
              </div>
            </div>
          ) : null}
          <div className="px-3 py-2">
            <ChatInput
              ref={inputRef}
              onKeyDown={handleKeyDown}
              value={input}
              onChange={({ target }) => setInput(target.value)}
              placeholder="Type your message here..."
              className="focus"
            />
          </div>
          <div className="flex items-center p-3 pt-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.click();
                      }
                    }}
                  >
                    <Paperclip className="size-4" />
                    <span className="sr-only">Attach file</span>
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Attach file</p>
              </TooltipContent>
            </Tooltip>
            <AudioRecorder
              agentId={agentId}
              onChange={(newInput: string) => setInput(newInput)}
            />
            <Button
              disabled={!input || sendMessageMutation.isPending}
              type="submit"
              size="sm"
            >
              {sendMessageMutation.isPending ? "..." : "Send Message"}
              <Send className="size-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}