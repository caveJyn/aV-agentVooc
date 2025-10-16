// import { Button } from "@/components/ui/button";
// import {
//   ChatBubble,
//   ChatBubbleMessage,
//   ChatBubbleTimestamp,
// } from "@/components/ui/chat/chat-bubble";
// import { ChatInput } from "@/components/ui/chat/chat-input";
// import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
// import { useTransition, animated, type AnimatedProps } from "@react-spring/web";
// import { Paperclip, Send, X, Image as ImageIcon } from "lucide-react";
// import { useEffect, useRef, useState, useCallback } from "react";
// import type { Content, UUID } from "@elizaos/core";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { apiClient } from "@/lib/api";
// import { cn, moment } from "@/lib/utils";
// import { Avatar, AvatarImage } from "./ui/avatar";
// import CopyButton from "./copy-button";
// import ChatTtsButton from "./ui/chat/chat-tts-button";
// import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
// import { useToast } from "@/hooks/use-toast";
// // import AIWriter from "react-aiwriter";
// import type { IAttachment } from "@/types";
// import { AudioRecorder } from "./audio-recorder";
// import { Badge } from "./ui/badge";
// // New imports for wallet creation
// import { useChipiContext } from "@chipi-stack/chipi-react"; // Ensure useCreateWallet is imported
// import { CreateWallet } from "./chat-Interface/chipi/createWallet";
// import { ViewWallet } from "./chat-Interface/chipi/viewWallet";
// import { ApproveUSDC } from "./chat-Interface/chipi/approveUSDC";
// import { StakeVesuUSDC } from "./chat-Interface/chipi/stakeVesuUSDC";

// import { EmailActionHandler } from './chat-actions/plugin-email/emailActionHandler';
// // import { WalletIntentDetector } from "./chat-actions/plugin-starknet/walletIntentDetector";
// import { WalletActionHandler } from "./chat-actions/plugin-chipi/chipiWalletActionHandler";
// import AIWriter from "react-aiwriter";
// import { EmailIntentDetector } from "./chat-actions/plugin-email/emailIntentDetector";
// import { WalletIntentDetector } from "./chat-actions/plugin-chipi/chipiWalletIntentDetector";
// // import { StarknetButton } from "./chat-actions/plugin-starknet/starknetButton";




// interface ImageItem {
//   imageAssetId: string;
//   imageUrl: string;
//   caption: string;
//   createdAt: string;
// }

// type ExtraContentFields = {
//   user: string;
//   createdAt: number;
//   isLoading?: boolean;
//   metadata?: {
//     imageAssetId?: string;
//     emails?: any[];
//     emailId?: string;
//     pendingReply?: any; // Used for email replies
//     pendingChipiWalletConfirmation?: any; // Used for wallet creation confirmation
//     action?: string;
//     promptConfirmation?: boolean;
//     promptPin?: boolean;
//     publicKey?: string;
//     wallets?: Array<{
//       walletId: string;
//       address?: string;
//       balance?: string;
//       status?: string;
//       details?: string;
//     }>;
//   };
// };

// type ContentWithUser = Content & ExtraContentFields;

// type AnimatedDivProps = AnimatedProps<{ style: React.CSSProperties }> & {
//   children?: React.ReactNode;
//   ref?: React.Ref<HTMLDivElement>;
// };

// export default function Page({ agentId }: { agentId: UUID }) {


//   const { toast } = useToast();
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [input, setInput] = useState('');
//   const [selectedImageId, setSelectedImageId] = useState<string | null>(null);


//   const { chipiSDK, config } = useChipiContext();
//   const [showWalletModal, setShowWalletModal] = useState(false);
//   const [showViewPinModal, setShowViewPinModal] = useState(false);
//   const [showApproveModal, setShowApproveModal] = useState(false);
//   const [showStakeModal, setShowStakeModal] = useState(false);


//   const inputRef = useRef<HTMLTextAreaElement>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const formRef = useRef<HTMLFormElement>(null);
//   const scrollRef = useRef<HTMLDivElement>(null);
//   const queryClient = useQueryClient();
  


//   // Fetch wallet existence for button visibility
//   const { data: walletExists } = useQuery<boolean>({
//     queryKey: ["walletExists", agentId],
//     queryFn: async () => {
//       try {
//         const response = await apiClient.getWallet(agentId);
//         return !!response?.wallet;
//       } catch {
//         return false;
//       }
//     },
//     enabled: !!agentId,
//   });



//   const messages = queryClient.getQueryData<ContentWithUser[]>(["messages", agentId]) || [];



  

//   useEffect(() => {
//     console.log("[CHAT] Chipi SDK Context:", {
//       chipiSDK: chipiSDK ? "Initialized" : "Not initialized",
//       config,
//     });
//   }, [chipiSDK, config]);




//   // Auto-resize textarea based on content
//   useEffect(() => {
//     const textarea = inputRef.current;
//     if (textarea) {
//       textarea.style.height = 'auto';
//       const newHeight = Math.max(textarea.scrollHeight, 48); // 48px = min-h-12
//       textarea.style.height = `${newHeight}px`;
//     }
//   }, [input]);

//   const {
//     data: images = [],
//     isLoading: isLoadingImages,
//     error: imagesError,
//   } = useQuery({
//     queryKey: ["agent-images", agentId],
//     queryFn: async () => {
//       // console.log("Fetching agent images");
//       try {
//         const response = await apiClient.getKnowledge(agentId);
//         const imageCollection = response.knowledge?.find(
//           (k) => k.metadata?.type === "image-collection"
//         );
//         return (imageCollection?.metadata?.images || []) as ImageItem[];
//       } catch (error) {
//         console.error("Failed to fetch agent images:", error);
//         return [];
//       }
//     },
//     staleTime: 5 * 60 * 1000,
//     retry: 1,
//   });

//   const getMessageVariant = (role: string) =>
//     role !== "user" ? "received" : "sent";

//   const scrollToBottom = useCallback(() => {
//     // console.log("scrollToBottom called");
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, []);

//   const isAtBottom = true;
//   const disableAutoScroll = useCallback(() => {
//     // console.log("disableAutoScroll called (no-op)");
//   }, []);

//   const handleImageSelect = (imageAssetId: string) => {
//     setSelectedImageId((prev) => {
//       const newId = prev === imageAssetId ? null : imageAssetId;
//       // console.log("Selected image ID:", newId);
//       return newId;
//     });
//   };

  
//   useEffect(() => {
//     // console.log("Initial mount, scrolling to bottom");
//     scrollToBottom();
//     inputRef.current?.focus();
//   }, [scrollToBottom]);

//   useEffect(() => {
//     if (!isLoadingImages && images.length > 0) {
//       // console.log("Images loaded, scrolling to bottom");
//       scrollToBottom();
//     }
//   }, [isLoadingImages, images.length, scrollToBottom]);

//   const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       if (e.nativeEvent.isComposing) return;
//       handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
//     }
//   };

//   const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     if (!input) return;

//     const attachments: IAttachment[] | undefined = selectedFile
//       ? [
//           {
//             url: URL.createObjectURL(selectedFile),
//             contentType: selectedFile.type,
//             title: selectedFile.name,
//           },
//         ]
//       : undefined;

//     const newMessages = [
//       {
//         text: input,
//         user: "user",
//         createdAt: Date.now(),
//         attachments,
//         metadata: selectedImageId ? { imageAssetId: selectedImageId } : undefined,
//       },
//       {
//         text: "",
//         user: "system",
//         isLoading: true,
//         createdAt: Date.now(),
//       },
//     ];

//     queryClient.setQueryData(
//       ["messages", agentId],
//       (old: ContentWithUser[] = []) => [...old, ...newMessages]
//     );

//     sendMessageMutation.mutate({
//       message: input,
//       selectedFile: selectedFile || null,
//       selectedImageId,
//     });

//     setSelectedFile(null);
//     setSelectedImageId(null);
//     setInput("");
//     formRef.current?.reset();
//     scrollToBottom();
//   };

//   const sendMessageMutation = useMutation({
//     mutationKey: ["send_message", agentId],
//     mutationFn: ({
//       message,
//       selectedFile,
//       selectedImageId,
//     }: {
//       message: string;
//       selectedFile: File | null;
//       selectedImageId: string | null;
//     }) => {
//       console.log("[CHAT] Sending message:", {
//         message,
//         selectedFile,
//         selectedImageId,
//       });
//       return apiClient.sendMessage(
//         agentId,
//         message,
//         selectedFile,
//         selectedImageId ? { imageAssetId: selectedImageId } : undefined
//       );
//     },
//     onSuccess: (data: ContentWithUser[] | { message: string }) => {
//       console.log("[CHAT] Raw backend response:", data);
//       const newMessages = Array.isArray(data)
//         ? data.map((msg) => ({
//             ...msg,
//             createdAt: msg.createdAt || Date.now(),
//             metadata: msg.metadata || {},
//           }))
//         : [{ text: data.message, user: "system", createdAt: Date.now() }];

//       console.log("[CHAT] Processed messages:", newMessages);

//       queryClient.setQueryData(
//         ["messages", agentId],
//         (old: ContentWithUser[] = []) => {
//           const filteredOld = old.filter((msg) => !msg.isLoading);
//           return [...filteredOld, ...newMessages];
//         }
//       );
//       scrollToBottom();
//     },
//     onError: (e: any) => {
//       console.error("[CHAT] Send message error:", e);
//       queryClient.setQueryData(
//         ["messages", agentId],
//         (old: ContentWithUser[] = []) => old.filter((msg) => !msg.isLoading)
//       );
//       toast({
//         variant: "destructive",
//         title: "Unable to send message",
//         description: e.message.includes("Character not found or access denied")
//           ? "This character does not exist or you don't have access."
//           : e.message || "Failed to send message",
//       });
//     },
//   });

//   const uploadAgentImageMutation = useMutation({
//     mutationKey: ["upload_agent_image", agentId],
//     mutationFn: (file: File) => apiClient.uploadAgentImage(agentId, file),
//     onSuccess: (data: {
//       message: string;
//       url: string;
//       sanityAssetId: string;
//       caption: string;
//     }) => {
//       const newMessage: ContentWithUser = {
//         text: data.caption || "Image uploaded",
//         user: "user",
//         createdAt: Date.now(),
//         attachments: [
//           {
//             id: data.sanityAssetId,
//             source: "image-upload",
//             description: data.caption,
//             text: data.caption,
//             url: data.url,
//             contentType: "image/*",
//             title: "Uploaded Image",
//           },
//         ],
//       };
//       queryClient.setQueryData(
//         ["messages", agentId],
//         (old: ContentWithUser[] = []) => [...old, newMessage]
//       );
//       queryClient.invalidateQueries({ queryKey: ["agent-images", agentId] });
//       toast({
//         title: "Image uploaded",
//         description: "Image added to agent's knowledge and chat.",
//       });
//       setSelectedFile(null);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//       scrollToBottom();
//     },
//     onError: (error: any) => {
//       console.error("Upload agent image error:", error);
//       toast({
//         variant: "destructive",
//         title: "Unable to upload image",
//         description: error.message || "Failed to upload image",
//       });
//     },
//   });

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (file?.type.startsWith("image/")) {
//       setSelectedFile(file);
//     }
//   };

//   const handleUploadAgentImage = () => {
//     if (selectedFile) {
//       uploadAgentImageMutation.mutate(selectedFile);
//     } else {
//       toast({
//         variant: "default",
//         title: "No image selected",
//         description: "Please select an image to upload.",
//       });
//     }
//   };



//   const transitions = useTransition(messages, {
//     keys: (message) => `${message.createdAt}-${message.user}-${message.text}`,
//     from: { opacity: 0, transform: "translateY(50px)" },
//     enter: { opacity: 1, transform: "translateY(0px)" },
//     leave: { opacity: 0, transform: "translateY(10px)" },
//   });

//   const CustomAnimatedDiv = animated.div as React.ComponentType<
//     AnimatedDivProps & React.RefAttributes<HTMLDivElement>
//   >;

//   // Intent detection for messages
//   const detectMessageIntent = (message: ContentWithUser) => {
//     const text = message.text?.toLowerCase() || "";
//     console.log("[CHAT] Detecting intent for message:", {
//       source: message.source,
//       action: message.metadata?.action,
//       promptConfirmation: message.metadata?.promptConfirmation,
//       pendingReply: !!message.metadata?.pendingReply,
//       pendingChipiWalletConfirmation: !!message.metadata?.pendingChipiWalletConfirmation,
//       text,
//     });

//     // Wallet-specific conditions
//     if (
//       message.source === "CHECK_CHIPI_WALLET" ||
//       message.source === "CREATE_CHIPI_WALLET" ||
//       message.metadata?.wallets?.length ||
//       message.metadata?.action === "CREATE_CHIPI_WALLET" ||
//       message.metadata?.promptConfirmation ||
//       message.metadata?.promptPin ||
//       message.metadata?.publicKey ||
//       message.metadata?.pendingChipiWalletConfirmation ||
//       WalletIntentDetector.detectCreateWallet(text) ||
//       WalletIntentDetector.detectViewWallet(text) ||
//       WalletIntentDetector.detectApproveUSDC(text) ||
//       WalletIntentDetector.detectStakeVesuUSDC(text)
//     ) {
//       return "wallet";
//     }

//     // Email-specific conditions
//     if (
//       message.source === "CHECK_EMAIL" ||
//       message.metadata?.emails?.length ||
//       (message.metadata?.pendingReply && message.metadata?.action === "REPLY_EMAIL")
//     ) {
//       return "email";
//     }

//     // Fallback to text-based intent detection
//     if (EmailIntentDetector.detectCheckEmail(text) || EmailIntentDetector.detectReplyEmail(text)) {
//       return "email";
//     }

//     return "default";
//   };
  
//   // Add useEffect for star positions
//   // useEffect(() => {
//   //   const positions = [...Array(20)].map(() => ({
//   //     top: `${Math.random() * 100}%`,
//   //     left: `${Math.random() * 100}%`,
//   //     width: `${Math.random() * 4 + 2}px`,
//   //     height: `${Math.random() * 4 + 2}px`,
//   //     animationDelay: `${Math.random() * 5}s`,
//   //     animationDuration: `${Math.random() * 3 + 2}s`,
//   //   }));
//   //   setStarPositions(positions);
//   // }, []);
//   // const defaultImage = "/images/chat-bg.jpg";

//   // console.log("Chat render");
//   // console.log("ChatMessageList props:", { scrollRef, isAtBottom, scrollToBottom, disableAutoScroll });
//   // console.log("Images:", images);
//   // console.log("Selected image ID:", selectedImageId);
//   // console.log("Email body map:", Object.fromEntries(emailBodyMap));

//   return (
//     <div className="flex flex-col w-full h-[calc(95dvh)] p-6 bg-agentvooc-secondary-bg">
//       {/* Wallet buttons */}
//       <div className="mb-4 flex flex-col gap-2">
//         {!walletExists ? (
//           <Button onClick={() => setShowWalletModal(true)}>Create Wallet</Button>
//         ) : (
//           <>
//             <Button onClick={() => setShowViewPinModal(true)}>View Wallet</Button>
//             <Button onClick={() => setShowApproveModal(true)}>Approve USDC</Button>
//             <Button onClick={() => setShowStakeModal(true)}>Stake USDC</Button>
//           </>
//         )}
//         {/* <StarknetButton agentId={agentId} /> */}
//       </div>

//       {/* Wallet modals */}
//       {showWalletModal && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//           <CreateWallet
//             agentId={agentId}
//             onClose={() => setShowWalletModal(false)}
//           />
//         </div>
//       )}
//       {showViewPinModal && (
//   <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//     <ViewWallet
//       agentId={agentId}
//       onClose={() => setShowViewPinModal(false)}
//     />
//   </div>
// )}
//       {showApproveModal && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//           <ApproveUSDC
//             agentId={agentId}
//             onClose={() => setShowApproveModal(false)}
//           />
//         </div>
//       )}
//       {showStakeModal && (
//         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
//           <StakeVesuUSDC
//             agentId={agentId}
//             onClose={() => setShowStakeModal(false)}
//           />
//         </div>
//       )}

//       <div className="flex-1 overflow-y-auto h-[calc(100dvh-150px)]">
//         {!isLoadingImages && images.length > 0 && (
//           <div className="mb-4">
//             <h3 className="text-sm font-medium  mb-2">Agent Images</h3>
//             <div className="flex overflow-x-auto gap-2 pb-2">
//               {images.map((image) => (
//                 <div
//                   key={image.imageAssetId}
//                   className={cn(
//                     "relative rounded-lg border border-agentvooc-accent/30 p-1.5 cursor-pointer transition-all",
//                     selectedImageId === image.imageAssetId
//                       ? "border-agentvooc-accent ring-1 ring-agentvooc-accent"
//                       : "hover:border-agentvooc-accent"
//                   )}
//                   onClick={() => handleImageSelect(image.imageAssetId)}
//                 >
//                   <img
//                     alt={image.caption || "Agent image"}
//                     src={image.imageUrl}
//                     className="w-20 h-20 object-cover rounded-lg"
//                   />
//                   {image.caption && (
//                     <p className="text-xs  truncate max-w-[80px] mt-1">
//                       {image.caption}
//                     </p>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//         {isLoadingImages && (
//           <div className="mb-4 flex items-center justify-center p-4">
//             <p className="text-sm ">Loading agent images...</p>
//           </div>
//         )}
//         {imagesError && (
//           <div className="mb-4 p-2 border border-agentvooc-accent/20  rounded-lg">
//             <p className="text-sm text-agentvooc-accent">Failed to load agent images</p>
//           </div>
//         )}
//         <ChatMessageList
//           scrollRef={scrollRef}
//           isAtBottom={isAtBottom}
//           scrollToBottom={scrollToBottom}
//           disableAutoScroll={disableAutoScroll}
//         >
//           {transitions((style, message: ContentWithUser) => {
//             const variant = getMessageVariant(message?.user);
//             const intent = detectMessageIntent(message);

//             return (
//               <CustomAnimatedDiv
//                 style={{
//                   ...style,
//                   display: 'flex',
//                   flexDirection: 'column',
//                   gap: '0.5rem',
//                   padding: '1rem',
//                 }}
//               >
//                 <ChatBubble
//                   variant={variant}
//                   className="flex flex-row items-center gap-2 border-agentvooc-accent/30 rounded-lg"
//                 >
//                   {message?.user !== 'user' ? (
//                     <Avatar className="size-8 p-1 border border-agentvooc-accent/30 rounded-full select-none">
//                       <AvatarImage />
//                     </Avatar>
//                   ) : null}
//                   <div className="flex flex-col w-full">
//                     <ChatBubbleMessage isLoading={message?.isLoading}>
//                       {message?.user === "user" ? (
//                         message.text
//                       ) : intent === "email" ? (
//                         <EmailActionHandler
//                           agentId={agentId}
//                           message={message}
//                           setInput={setInput}
//                           handleSendMessage={handleSendMessage}
//                         />
//                       ) : intent === "wallet" ? (
//                         <WalletActionHandler
//                           agentId={agentId}
//                           message={message}
//                           setInput={setInput}
//                           handleSendMessage={handleSendMessage}
//                         />
//                       ) : (
//                         <AIWriter>{message.text}</AIWriter>
//                       )}
//                       {message?.attachments?.map((attachment: IAttachment) => (
//                         <div
//                           className="flex flex-col gap-1 mt-2"
//                           key={`${attachment.url}-${attachment.title}`}
//                         >
//                           <img
//                             alt={attachment.title || "attachment"}
//                             src={attachment.url}
//                             width="100%"
//                             height="100%"
//                             className="w-64 rounded-lg"
//                           />
//                         </div>
//                       ))}
//                       {message?.metadata?.imageAssetId && (
//                         <div className="mt-2 text-xs">
//                           Referenced image:{" "}
//                           {images.find(
//                             (img) =>
//                               img.imageAssetId === message.metadata?.imageAssetId
//                           )?.caption || "Image"}
//                         </div>
//                       )}
//                     </ChatBubbleMessage>
//                     <div className="flex items-center gap-4 justify-between w-full mt-1">
//                       {message?.text && !message?.isLoading ? (
//                         <div className="flex items-center gap-1">
//                           <CopyButton text={message?.text} />
//                           <ChatTtsButton agentId={agentId} text={message?.text} />
//                         </div>
//                       ) : null}
//                       <div
//                         className={cn([
//                           message?.isLoading ? 'mt-2' : '',
//                           'flex items-center justify-between gap-4 select-none',
//                         ])}
//                       >
//                         {message?.source ? <Badge variant="outline">{message.source}</Badge> : null}
//                         {message?.action ? <Badge variant="outline">{message.action}</Badge> : null}
//                         {message?.createdAt ? (
//                           <ChatBubbleTimestamp
//                             timestamp={moment(message?.createdAt).format('LT')}
//                             className=""
//                           />
//                         ) : null}
//                       </div>
//                     </div>
//                   </div>
//                 </ChatBubble>
//               </CustomAnimatedDiv>
//             );
//           })}
//         </ChatMessageList>
//       </div>
//       <div className="px-4 pb-4">
//         <form
//           ref={formRef}
//           onSubmit={handleSendMessage}
//           className="relative rounded-lg border border-agentvooc-accent/30 "
//         >
//           {selectedFile ? (
//             <div className="p-3 flex">
//               <div className="relative rounded-lg border border-agentvooc-accent/30 p-2">
//                 <Button
//                   onClick={() => setSelectedFile(null)}
//                   className="absolute -right-2 -top-2 size-[22px] ring-2 ring-agentvooc-secondary-bg"
//                   variant="outline"
//                   size="icon"
//                 >
//                   <X/>
//                 </Button>
//                 <img
//                   alt="Selected file"
//                   src={URL.createObjectURL(selectedFile)}
//                   height="100%"
//                   width="100%"
//                   className="aspect-square object-contain w-16 rounded-lg"
//                 />
//               </div>
//             </div>
//           ) : null}
//           <div className="px-3 py-2">
//             <ChatInput
//             ref={inputRef}
//             onKeyDown={handleKeyDown}
//             value={input}
//             onChange={({ target }) => setInput(target.value)}
//             placeholder={selectedImageId ? "Ask about the selected image..." : "Type your message here..."}
//             className="focus"
//           />
//           </div>
//           <div className="flex items-center p-3 pt-0">
//             <Tooltip>
//               <TooltipTrigger asChild>
//                 <div>
//                   <Button
//                     variant="ghost"
//                     size="icon"
//                     onClick={() => {
//                       if (fileInputRef.current) {
//                         fileInputRef.current.click();
//                       }
//                     }}                  >
//                     <Paperclip className="size-4" />
//                     <span className="sr-only">Attach file</span>
//                   </Button>
//                   <input
//                     type="file"
//                     ref={fileInputRef}
//                     onChange={handleFileChange}
//                     accept="image/*"
//                     className="hidden"
//                   />
//                 </div>
//               </TooltipTrigger>
//               <TooltipContent side="left">
//                 <p>Attach file</p>
//               </TooltipContent>
//             </Tooltip>
//             <Tooltip>
//               <TooltipTrigger asChild>
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   onClick={handleUploadAgentImage}
//                   disabled={!selectedFile}
//                 >
//                   <ImageIcon className="size-4" />
//                   <span className="sr-only">Upload image to agent</span>
//                 </Button>
//               </TooltipTrigger>
//               <TooltipContent side="left" >
//                 <p>Upload image to agent</p>
//               </TooltipContent>
//             </Tooltip>
//             <AudioRecorder
//               agentId={agentId}
//               onChange={(newInput: string) => setInput(newInput)}
//             />
//             <Button
//               disabled={!input || sendMessageMutation.isPending}
//               type="submit"
//               size="sm"
//             >
//               {sendMessageMutation.isPending
//                 ? "..."
//                 : selectedImageId 
//                   ? "Send with Image" 
//                   : "Send Message"}
//               <Send className="size-3.5" />
//             </Button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }