import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { debounce } from "@/lib/debounce";
import type { UUID, Character, Plugin } from "@elizaos/core";

interface CharacterResponse {
  id: UUID;
  character: Character;
}

interface UserResponse {
  user: {
    _id: string;
    userId: string;
    userType: string;
    activePlugins: string[];
    [key: string]: any;
  };
}

interface EditCharacterProps {
  setError: (error: string | null) => void;
}

interface Message {
  user: string;
  content: {
    text: string;
    action?: string;
  };
}

interface CharacterData {
  id: UUID;
  name: string;
  username: string;
  system: string;
  bio: string[];
  lore: string[];
  messageExamples: Message[][];
  postExamples: string[];
  topics: string[];
  adjectives: string[];
  modelProvider: "OPENAI" ;
  plugins: string[];
  settings: {
    voice: { model: string };
    ragKnowledge: boolean;
    email: {
      outgoing: {
        service: "gmail" | "smtp";
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
      };
      incoming: {
        service: "imap";
        host: string;
        port: number;
        user: string;
        pass: string;
      };
    };
  };
  style: {
    all: string[];
    chat: string[];
    post: string[];
  };
  knowledge: any[];
  enabled: boolean;
}

export default function EditCharacter({ setError }: EditCharacterProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: characterId } = useParams<{ id: UUID }>();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [twitterUsername, setTwitterUsername] = useState("");
  const [twitterPassword, setTwitterPassword] = useState("");
  const [twitterEmail, setTwitterEmail] = useState("");
  const [emailOutgoingUser, setEmailOutgoingUser] = useState("");
  const [emailOutgoingPass, setEmailOutgoingPass] = useState("");
  const [emailIncomingUser, setEmailIncomingUser] = useState("");
  const [emailIncomingPass, setEmailIncomingPass] = useState("");
  const [showEmailOutgoingPass, setShowEmailOutgoingPass] = useState(false);
  const [showEmailIncomingPass, setShowEmailIncomingPass] = useState(false);
  // const [showTwitterPassword, setShowTwitterPassword] = useState(false);
  const [messageExamplesInput, setMessageExamplesInput] = useState(
    JSON.stringify(
      [
        [
          { user: "{{user1}}", content: { text: "Hello, how are you?" } },
          { user: "CharacterName", content: { text: "I'm doing great, thanks for asking!" } },
        ],
      ],
      null,
      2
    )
  );
  const [messageExamplesError, setMessageExamplesError] = useState<string | null>(null);
  const [bioInput, setBioInput] = useState("");
  const [loreInput, setLoreInput] = useState("");
  const [topicsInput, setTopicsInput] = useState("");
  const [adjectivesInput, setAdjectivesInput] = useState("");
  const [postExamplesInput, setPostExamplesInput] = useState("");
  const [emailOutgoingUserError, setEmailOutgoingUserError] = useState<string | null>(null);
  const [emailIncomingUserError, setEmailIncomingUserError] = useState<string | null>(null);

  const [characterData, setCharacterData] = useState<CharacterData>({
    id: characterId ?? "00000000-0000-0000-0000-000000000000",
    name: "",
    username: "",
    system: "",
    bio: [],
    lore: [],
    messageExamples: [],
    postExamples: [],
    topics: [],
    adjectives: [],
    modelProvider: "OPENAI",
    plugins: [],
    settings: {
      voice: { model: "" },
      ragKnowledge: false,
      email: {
        outgoing: { service: "gmail", host: "", port: 587, secure: true, user: "", pass: "" },
        incoming: { service: "imap", host: "imap.gmail.com", port: 993, user: "", pass: "" },
      },
    },
    style: { all: [], chat: [], post: [] },
    knowledge: [],
    enabled: true,
  });

  const { data: initialData, isLoading, error } = useQuery<CharacterResponse>({
    queryKey: ["character", characterId],
    queryFn: () => apiClient.getCharacter(characterId!),
    enabled: !!characterId,
  });

  const userQuery = useQuery<UserResponse>({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await apiClient.getUser();
      // console.log("[EDIT_CHARACTER] userQuery response:", response);
      return response;
    },
  });

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const debouncedValidateEmail = useCallback(
    debounce((value: string, field: string, setFieldError: (error: string | null) => void) => {
      if (!value) {
        setFieldError(null); // Clear error if field is empty
        return true;
      }
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isValid) {
        setFieldError(`Invalid email format for ${field}`);
      } else {
        setFieldError(null); // Clear error if valid
      }
      return isValid;
    }, 300),
    []
  );

  useEffect(() => {
    if (initialData?.character) {
      // console.log("[EDIT_CHARACTER] Initial character data:", initialData.character);
      const character: Character = initialData.character;

      const transformedMessageExamples = Array.isArray(character.messageExamples)
      ? character.messageExamples.map((conversation: any) =>
          Array.isArray(conversation?.messages) ? conversation.messages : []
        )
      : [];


      const newCharacterData: CharacterData = {
        id: character.id ?? characterId!,
        name: character.name || "",
        username: character.username || "",
        system: character.system || "",
        bio: Array.isArray(character.bio) ? character.bio : [],
        lore: Array.isArray(character.lore) ? character.lore : [],
        messageExamples: transformedMessageExamples,
        postExamples: Array.isArray(character.postExamples) ? character.postExamples : [],
        topics: Array.isArray(character.topics) ? character.topics : [],
        adjectives: Array.isArray(character.adjectives) ? character.adjectives : [],
        modelProvider: ["OPENAI"].includes(character.modelProvider as string)
          ? (character.modelProvider as unknown as "OPENAI")
          : "OPENAI",
        plugins: Array.isArray(character.plugins)
          ? character.plugins
              .filter((p: string | Plugin): p is string | Plugin => p != null)
              .map((p: string | Plugin) => (typeof p === "string" ? p : p.name))
              .filter((name: string | undefined): name is string => name != null)
          : [],
        settings: {
          voice: character.settings?.voice?.model ? { model: character.settings.voice.model } : { model: "" },
          ragKnowledge: character.settings?.ragKnowledge || false,
          email: character.settings?.email
            ? {
                outgoing: {
                  service: character.settings.email.outgoing?.service || "gmail",
                  host: character.settings.email.outgoing?.host || "",
                  port: character.settings.email.outgoing?.port || 587,
                  secure: character.settings.email.outgoing?.secure ?? true,
                  user: character.settings.email.outgoing?.user || "",
                  pass: character.settings.email.outgoing?.pass || "",
                },
                incoming: {
                  service: character.settings.email.incoming?.service || "imap",
                  host: character.settings.email.incoming?.host || "imap.gmail.com",
                  port: character.settings.email.incoming?.port || 993,
                  user: character.settings.email.incoming?.user || "",
                  pass: character.settings.email.incoming?.pass || "",
                },
              }
            : {
                outgoing: { service: "gmail", host: "", port: 587, secure: true, user: "", pass: "" },
                incoming: { service: "imap", host: "imap.gmail.com", port: 993, user: "", pass: "" },
              },
        },
        style: {
          all: Array.isArray(character.style?.all) ? character.style.all : [],
          chat: Array.isArray(character.style?.chat) ? character.style.chat : [],
          post: Array.isArray(character.style?.post) ? character.style.post : [],
        },
        knowledge: Array.isArray(character.knowledge) ? character.knowledge : [],
        enabled: character.enabled !== undefined ? character.enabled : true,
      };
      setCharacterData(newCharacterData);
      setBioInput(Array.isArray(character.bio) ? character.bio.join("\n") : "");
      setLoreInput(Array.isArray(character.lore) ? character.lore.join("\n") : "");
      setTopicsInput(Array.isArray(character.topics) ? character.topics.join("\n") : "");
      setAdjectivesInput(Array.isArray(character.adjectives) ? character.adjectives.join("\n") : "");
      setPostExamplesInput(Array.isArray(character.postExamples) ? character.postExamples.join("\n") : "");
      setMessageExamplesInput(
      JSON.stringify(transformedMessageExamples, null, 2)
    );
      setTelegramBotToken(
        Array.isArray(character.settings?.secrets?.dynamic)
          ? character.settings.secrets.dynamic.find((s) => s.key === "TELEGRAM_BOT_TOKEN")?.value || ""
          : ""
      );
      setTwitterUsername(
        Array.isArray(character.settings?.secrets?.dynamic)
          ? character.settings.secrets.dynamic.find((s) => s.key === "TWITTER_USERNAME")?.value || ""
          : ""
      );
      setTwitterPassword(
        Array.isArray(character.settings?.secrets?.dynamic)
          ? character.settings.secrets.dynamic.find((s) => s.key === "TWITTER_PASSWORD")?.value || ""
          : ""
      );
      setTwitterEmail(
        Array.isArray(character.settings?.secrets?.dynamic)
          ? character.settings.secrets.dynamic.find((s) => s.key === "TWITTER_EMAIL")?.value || ""
          : ""
      );
      setEmailOutgoingUser(character.settings?.email?.outgoing?.user || "");
      setEmailOutgoingPass(character.settings?.email?.outgoing?.pass || "");
      setEmailIncomingUser(character.settings?.email?.incoming?.user || "");
      setEmailIncomingPass(character.settings?.email?.incoming?.pass || "");
      setImagePreview(character.profile?.image || null);
      // console.log("[EDIT_CHARACTER] Initialized email fields:", {
      //   emailOutgoingUser: character.settings?.email?.outgoing?.user || "",
      //   emailOutgoingPass: character.settings?.email?.outgoing?.pass || "",
      //   emailIncomingUser: character.settings?.email?.incoming?.user || "",
      //   emailIncomingPass: character.settings?.email?.incoming?.pass || "",
      // });
    }
  }, [initialData, characterId]);

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch character data",
      });
    }
  }, [error, setError]);

  const debouncedUpdateCharacterData = useCallback(
    debounce((updates: Partial<CharacterData>) => {
      setCharacterData((prev) => ({ ...prev, ...updates }));
    }, 300),
    []
  );

  const debouncedSetMessageExamplesInput = useCallback(
    debounce((value: string) => {
      setMessageExamplesInput(value);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedUpdateCharacterData({
      bio: bioInput ? bioInput.split("\n").map((s) => s.trim()).filter((s) => s) : [],
      lore: loreInput ? loreInput.split("\n").map((s) => s.trim()).filter((s) => s) : [],
      topics: topicsInput ? topicsInput.split("\n").map((s) => s.trim()).filter((s) => s) : [],
      adjectives: adjectivesInput ? adjectivesInput.split("\n").map((s) => s.trim()).filter((s) => s) : [],
      postExamples: postExamplesInput ? postExamplesInput.split("\n").map((s) => s.trim()).filter((s) => s) : [],
    });
  }, [bioInput, loreInput, topicsInput, adjectivesInput, postExamplesInput, debouncedUpdateCharacterData]);

useEffect(() => {
  let parsedMessageExamples: Message[][] = [];
  setMessageExamplesError(null); // Reset error state

  try {
    if (messageExamplesInput) {
      const parsed = JSON.parse(messageExamplesInput);
      
      // Check if input is an array
      if (!Array.isArray(parsed)) {
        setMessageExamplesError("Message Examples must be an array");
        return;
      }

      // Transform Sanity structure to Message[][] if needed
      if (parsed.every(item => 'messages' in item && Array.isArray(item.messages))) {
        // Input matches Sanity schema: [{ messages: [{ user, content: { text, action? }}] }, ...]
        parsedMessageExamples = parsed.map((conversation: { messages: Message[] }) => conversation.messages);
      } else if (parsed.every(Array.isArray)) {
        // Input is already in Message[][] format
        parsedMessageExamples = parsed;
      } else {
        setMessageExamplesError("Message Examples must be an array of arrays or an array of conversation objects");
        return;
      }

      // Validate each message
      const isValid = parsedMessageExamples.every((conversation, convoIndex) =>
        Array.isArray(conversation) &&
        conversation.every((msg, msgIndex) => {
          if (!msg || typeof msg !== 'object') {
            setMessageExamplesError(`Invalid message at conversation ${convoIndex + 1}, message ${msgIndex + 1}: Must be an object`);
            return false;
          }
          if (!('user' in msg) || typeof msg.user !== 'string' || !msg.user) {
            setMessageExamplesError(`Invalid message at conversation ${convoIndex + 1}, message ${msgIndex + 1}: 'user' must be a non-empty string`);
            return false;
          }
          if (!('content' in msg) || typeof msg.content !== 'object' || !msg.content) {
            setMessageExamplesError(`Invalid message at conversation ${convoIndex + 1}, message ${msgIndex + 1}: 'content' must be an object`);
            return false;
          }
          if (!('text' in msg.content) || typeof msg.content.text !== 'string' || !msg.content.text) {
            setMessageExamplesError(`Invalid message at conversation ${convoIndex + 1}, message ${msgIndex + 1}: 'content.text' must be a non-empty string`);
            return false;
          }
          if ('action' in msg.content && msg.content.action !== undefined && typeof msg.content.action !== 'string') {
            setMessageExamplesError(`Invalid message at conversation ${convoIndex + 1}, message ${msgIndex + 1}: 'content.action' must be a string if provided`);
            return false;
          }
          return true;
        })
      );

      if (!isValid) {
        // Error is set in the validation loop
        return;
      }
    }
  } catch (error) {
    setMessageExamplesError("Invalid JSON format in Message Examples");
    return;
  }

  setCharacterData((prev) => ({
    ...prev,
    messageExamples: parsedMessageExamples,
  }));
}, [messageExamplesInput]);

  const handlePluginChange = async (plugin: string, checked: boolean) => {
    if (userQuery.isLoading) {
      toast({
        variant: "destructive",
        title: "Loading",
        description: "Please wait while we verify your subscription.",
      });
      return;
    }
    const activePlugins = userQuery.data?.user?.activePlugins || [];
    // console.log("[EDIT_CHARACTER] handlePluginChange:", {
    //   plugin,
    //   checked,
    //   activePlugins,
    //   userQueryStatus: userQuery.status,
    // });

    if (!activePlugins.includes(plugin) && checked) {
      try {
        // console.log("[EDIT_CHARACTER] Plugin not in activePlugins, fetching subscription items");
        const subscriptionData = await apiClient.getSubscriptionItems({ includeDetails: true });
        const availablePlugins = subscriptionData.plugins || [];
        // console.log("[EDIT_CHARACTER] Fetched subscription items, activePlugins:", availablePlugins);

        if (!availablePlugins.includes(plugin)) {
          toast({
            variant: "destructive",
            title: "Subscription Required",
            description: `You need a subscription for the ${plugin} plugin. Please subscribe in the settings page.`,
            action: (
              <Button
                onClick={() => navigate("/settings", { state: { from: "edit-character" } })}
                className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg"
              >
                Go to Settings
              </Button>
            ),
          });
          return;
        }
      } catch (error) {
        console.error("[EDIT_CHARACTER] Error fetching subscription items:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to verify plugin subscription. Please try again.",
        });
        return;
      }
    }
    setCharacterData((prev) => ({
      ...prev,
      plugins: checked ? [...prev.plugins, plugin] : prev.plugins.filter((p) => p !== plugin),
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCharacterData((prev) => ({ ...prev, [name]: value }));
  };

  const handleArrayInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: string
  ) => {
    const value = e.target.value;
    if (field === "bio") setBioInput(value);
    if (field === "lore") setLoreInput(value);
    if (field === "topics") setTopicsInput(value);
    if (field === "adjectives") setAdjectivesInput(value);
    if (field === "postExamples") setPostExamplesInput(value);
    if (field === "messageExamples") debouncedSetMessageExamplesInput(value);
  };

  const handleAdvancedInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    field: string,
    subfield?: string
  ) => {
    const value = e.target.value;
    setCharacterData((prev) => {
      if (field === "settings" && subfield) {
        if (subfield === "voiceModel") {
          return { ...prev, settings: { ...prev.settings, voice: { model: value } } };
        }
        if (subfield === "ragKnowledge") {
          return { ...prev, settings: { ...prev.settings, ragKnowledge: value === "true" } };
        }
        if (subfield.startsWith("email.outgoing.")) {
          const key = subfield.split(".")[2];
          return {
            ...prev,
            settings: {
              ...prev.settings,
              email: {
                ...prev.settings.email,
                outgoing: { ...prev.settings.email.outgoing, [key]: key === "port" ? Number(value) : key === "secure" ? value === "true" : value },
              },
            },
          };
        }
        if (subfield.startsWith("email.incoming.")) {
          const key = subfield.split(".")[2];
          return {
            ...prev,
            settings: {
              ...prev.settings,
              email: {
                ...prev.settings.email,
                incoming: { ...prev.settings.email.incoming, [key]: key === "port" ? Number(value) : value },
              },
            },
          };
        }
        return prev;
      }
      if (field === "style" && subfield) {
        return { ...prev, style: { ...prev.style, [subfield]: value.split("\n").map((s) => s.trim()).filter((s) => s) } };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleEmailCheckbox = (checked: boolean) => {
    handlePluginChange("email", checked);
    if (!checked) {
      setEmailOutgoingUser("");
      setEmailOutgoingPass("");
      setEmailIncomingUser("");
      setEmailIncomingPass("");
      setCharacterData((prev) => ({
        ...prev,
        plugins: prev.plugins.filter((p) => p !== "email"),
        settings: {
          ...prev.settings,
          email: {
            outgoing: { service: "gmail", host: "", port: 587, secure: true, user: "", pass: "" },
            incoming: { service: "imap", host: "imap.gmail.com", port: 993, user: "", pass: "" },
          },
        },
      }));
    }
  };

  const handleEmailOutgoingUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailOutgoingUser(value);
    debouncedValidateEmail(value, "outgoing email username", setEmailOutgoingUserError);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: { ...prev.settings.email, outgoing: { ...prev.settings.email.outgoing, user: value } },
      },
    }));
    // console.log("[EDIT_CHARACTER] Updated emailOutgoingUser:", value);
  };

  const handleEmailOutgoingPassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailOutgoingPass(value);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: { ...prev.settings.email, outgoing: { ...prev.settings.email.outgoing, pass: value } },
      },
    }));
    // console.log("[EDIT_CHARACTER] Updated emailOutgoingPass:", value);
  };

  const handleEmailIncomingUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailIncomingUser(value);
    debouncedValidateEmail(value, "incoming email username", setEmailIncomingUserError);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: { ...prev.settings.email, incoming: { ...prev.settings.email.incoming, user: value } },
      },
    }));
    // console.log("[EDIT_CHARACTER] Updated emailIncomingUser:", value);
  };

  const handleEmailIncomingPassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailIncomingPass(value);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: { ...prev.settings.email, incoming: { ...prev.settings.email.incoming, pass: value } },
      },
    }));
    // console.log("[EDIT_CHARACTER] Updated emailIncomingPass:", value);
  };

  const handleTelegramCheckbox = (checked: boolean) => {
    handlePluginChange("telegram", checked);
    if (!checked) {
      setTelegramBotToken("");
    }
  };

  const handleTelegramBotTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTelegramBotToken(value);
  };

  // Add handler for Chipi plugin checkbox
  const handleChipiCheckbox = (checked: boolean) => {
    handlePluginChange("chipi", checked);
  };

  // const handleTwitterCheckbox = (checked: boolean) => {
  //   handlePluginChange("twitter", checked);
  //   if (!checked) {
  //     setTwitterUsername("");
  //     setTwitterPassword("");
  //     setTwitterEmail("");
  //   }
  // };

  // const handleTwitterUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setTwitterUsername(value);
  // };

  // const handleTwitterPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   setTwitterPassword(value);
  // };

  // const handleTwitterEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const value = e.target.value;
  //   if (value && !validateEmail(value)) {
  //     setError("Invalid email format for Twitter email");
  //     toast({
  //       variant: "destructive",
  //       title: "Error",
  //       description: "Invalid email format for Twitter email",
  //     });
  //     return;
  //   }
  //   setTwitterEmail(value);
  // };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
        setError("Invalid file type. Only JPEG, PNG, and GIF are allowed.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid file type. Only JPEG, PNG, and GIF are allowed.",
        });
        return;
      }
      setProfileImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setError(null);
    }
  };


  const uploadImageMutation = useMutation({
    mutationFn: async ({ characterId, file }: { characterId: UUID; file: File }) => {
      // console.log("[EDIT_CHARACTER] Uploading profile image for characterId:", characterId);
      const formData = new FormData();
      formData.append("image", file);
      const response = await apiClient.uploadCharacterProfileImage(characterId, formData);
      // console.log("[EDIT_CHARACTER] Image upload response:", response);
      return response.url;
    },
    onSuccess: () => {
      // console.log("[EDIT_CHARACTER] Profile image uploaded successfully");
      toast({
        title: "Success",
        description: "Profile image uploaded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
    onError: (error: any) => {
      console.error("[EDIT_CHARACTER] Image upload error:", error);
      setError("Failed to upload image: " + (error.message || "Unknown error"));
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload image.",
      });
    },
  });

  const updateCharacterMutation = useMutation({
    mutationFn: async () => {
      // console.log("[EDIT_CHARACTER] Email fields before submission:", {
      //   emailOutgoingUser,
      //   emailOutgoingPass,
      //   emailIncomingUser,
      //   emailIncomingPass,
      //   settingsEmail: characterData.settings.email,
      //   plugins: characterData.plugins,
      // });

      if (!characterData.name) {
        throw new Error("Character name is required.");
      }
      if (characterData.plugins.includes("email") ) {
        if (
          !emailOutgoingUser ||
          !emailOutgoingPass ||
          !emailIncomingUser ||
          !emailIncomingPass
        ) {
          throw new Error("All email fields (username and password for both outgoing and incoming) are required when email plugin is enabled.");
        }
        if (
          characterData.settings.email.outgoing.service === "smtp" &&
          (!characterData.settings.email.outgoing.host || !characterData.settings.email.outgoing.port)
        ) {
          throw new Error("SMTP host and port are required when using SMTP service.");
        }
      }
      try {
      if (messageExamplesInput) {
        const parsed = JSON.parse(messageExamplesInput);
        if (!Array.isArray(parsed) || !parsed.every(Array.isArray)) {
          throw new Error("Message Examples must be an array of arrays");
        }
        const isValid = parsed.every((example) =>
          example.every(
            (msg) =>
              msg &&
              typeof msg === "object" &&
              "user" in msg &&
              typeof msg.user === "string" &&
              msg.user &&
              "content" in msg &&
              msg.content &&
              typeof msg.content === "object" &&
              "text" in msg.content &&
              typeof msg.content.text === "string" &&
              msg.content.text &&
              (!("action" in msg.content) || typeof msg.content.action === "string")
          )
        );
        if (!isValid) {
          throw new Error(
            "Each message example must contain objects with 'user' and 'content' properties, where 'content' has a 'text' property, and 'action' is optional but must be a string if provided"
          );
        }
      }
    } catch (error) {
      throw new Error("Invalid JSON format in Message Examples");
    }
      const secrets = [
        ...(characterData.plugins.includes("telegram") && telegramBotToken
          ? [{ key: "TELEGRAM_BOT_TOKEN", value: telegramBotToken }]
          : []),
        ...(characterData.plugins.includes("twitter") && twitterUsername
          ? [{ key: "TWITTER_USERNAME", value: twitterUsername }]
          : []),
        ...(characterData.plugins.includes("twitter") && twitterPassword
          ? [{ key: "TWITTER_PASSWORD", value: twitterPassword }]
          : []),
        ...(characterData.plugins.includes("twitter") && twitterEmail
          ? [{ key: "TWITTER_EMAIL", value: twitterEmail }]
          : []),
        ...((characterData.plugins.includes("email") ) && emailOutgoingUser
          ? [{ key: "EMAIL_OUTGOING_USER", value: emailOutgoingUser }]
          : []),
        ...((characterData.plugins.includes("email") ) && emailOutgoingPass
          ? [{ key: "EMAIL_OUTGOING_PASS", value: emailOutgoingPass }]
          : []),
        ...((characterData.plugins.includes("email") ) && emailIncomingUser
          ? [{ key: "EMAIL_INCOMING_USER", value: emailIncomingUser }]
          : []),
        ...((characterData.plugins.includes("email") ) && emailIncomingPass
          ? [{ key: "EMAIL_INCOMING_PASS", value: emailIncomingPass }]
          : []),
      ];
      const secretKeys = secrets.map((s) => s.key.trim()).filter((k) => k);
      if (new Set(secretKeys).size !== secretKeys.length) {
        throw new Error("Duplicate keys found in plugin secrets");
      }
      const currentUser = userQuery.data;
      // console.log("[EDIT_CHARACTER] Current user:", currentUser);
      if (!currentUser?.user?._id) {
        throw new Error("Cannot update character: user ID not found. Please log in again.");
      }
      const updatedCharacterData = {
        name: characterData.name,
        username: characterData.username || undefined,
        system: characterData.system || undefined,
        bio: characterData.bio,
        lore: characterData.lore,
        messageExamples: characterData.messageExamples,
        postExamples: characterData.postExamples,
        topics: characterData.topics,
        adjectives: characterData.adjectives,
        modelProvider: characterData.modelProvider,
        plugins: characterData.plugins,
        knowledge: characterData.knowledge,
        settings: {
          secrets: { dynamic: secrets },
          voice: characterData.settings.voice.model ? { model: characterData.settings.voice.model } : undefined,
          ragKnowledge: characterData.settings.ragKnowledge,
          email: characterData.plugins.includes("email")
            ? {
                outgoing: {
                  service: characterData.settings.email.outgoing.service || "gmail",
                  host: characterData.settings.email.outgoing.host || "",
                  port: characterData.settings.email.outgoing.port || 587,
                  secure: characterData.settings.email.outgoing.secure ?? true,
                  user: emailOutgoingUser,
                  pass: emailOutgoingPass,
                },
                incoming: {
                  service: characterData.settings.email.incoming.service || "imap",
                  host: characterData.settings.email.incoming.host || "imap.gmail.com",
                  port: characterData.settings.email.incoming.port || 993,
                  user: emailIncomingUser,
                  pass: emailIncomingPass,
                },
              }
            : undefined,
        },
        style: {
          all: characterData.style.all.length ? characterData.style.all : undefined,
          chat: characterData.style.chat.length ? characterData.style.chat : undefined,
          post: characterData.style.post.length ? characterData.style.post : undefined,
        },
        enabled: characterData.enabled,
        createdBy: {
          _type: "reference",
          _ref: currentUser.user._id,
        },
      };
      // console.log("[EDIT_CHARACTER] Updating character with payload:", JSON.stringify(updatedCharacterData, null, 2));
      await apiClient.updateCharacter(characterId!, updatedCharacterData);
      if (profileImage) {
        await uploadImageMutation.mutateAsync({ characterId: characterId!, file: profileImage });
      }
    },
    onSuccess: () => {
      // console.log("[EDIT_CHARACTER] Character updated successfully");
      queryClient.invalidateQueries({ queryKey: ["characters"] });
      queryClient.invalidateQueries({ queryKey: ["character", characterId] });
      toast({
        title: "Success",
        description: `Character "${characterData.name}" updated successfully.`,
      });
      setMessageExamplesError(null);
      navigate("/home");
    },
    onError: (error: any) => {
      console.error("[EDIT_CHARACTER] Character update error:", error);
      const errorMessage = error.message || "Failed to update character";
      if (errorMessage.includes("Message Examples")) {
        setMessageExamplesError(errorMessage);
      } else {
        setError(errorMessage);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // console.log("[EDIT_CHARACTER] Submitting character update form");
    if (characterData.plugins.includes("email")) {
      if (!emailOutgoingUser || !emailOutgoingPass || !emailIncomingUser || !emailIncomingPass) {
        setError("All email fields are required when the email plugin is enabled.");
        toast({
          variant: "destructive",
          title: "Error",
          description: "All email fields (username and password for both outgoing and incoming) are required when the email plugin is enabled.",
        });
        return;
      }
      // Validate email formats on submission
      if (!validateEmail(emailOutgoingUser)) {
        setEmailOutgoingUserError("Invalid email format for outgoing email username");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid email format for outgoing email username",
        });
        return;
      }
      if (!validateEmail(emailIncomingUser)) {
        setEmailIncomingUserError("Invalid email format for incoming email username");
        toast({
          variant: "destructive",
          title: "Error",
          description: "Invalid email format for incoming email username",
        });
        return;
      }
    }
    updateCharacterMutation.mutate();
  };

  const handleCancel = () => {
    // console.log("[EDIT_CHARACTER] Canceling character update");
    setTimeout(() => {
      navigate("/home");
    }, 0);
  };

    // Define the common className for inputs and textareas
  const inputClassName =
  " border-agentvooc-accent/50 bg-agentvooc-secondary-bg focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg";


   if (isLoading) {
    return (
      <div className="p-6 bg-agentvooc-secondary-bg border border-agentvooc-accent/30 rounded-xl shadow-agentvooc-glow max-w-2xl mx-auto">
        <Loader2 className="h-6 w-6 animate-spin text-agentvooc-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-agentvooc-secondary-bg border border-agentvooc-accent/30 rounded-xl shadow-agentvooc-glow max-w-2xl mx-auto">
        <p className="text-red-500 text-sm">Error loading character data. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="p-6 border border-agentvooc-accent/30  w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <h3 className="text-xl font-semibold mb-6 text-agentvooc-primary">Edit Character</h3>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Character Name (Required)
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            value={characterData.name}
            onChange={handleInputChange}
            placeholder="Enter character name (e.g., agentVooc)"
            className={inputClassName}
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="profileImage" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Profile Image (JPEG, PNG, or GIF)
          </label>
          {imagePreview && (
            <div className="mt-2 mb-4">
              <img
                src={imagePreview}
                alt="Profile preview"
                className="w-24 h-24 object-cover rounded-lg border border-agentvooc-accent/30"
              />
            </div>
          )}
          <Input
            id="profileImage"
            name="profileImage"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleImageChange}
            className={inputClassName}
            aria-describedby="profileImageDescription"
          />
          <p id="profileImageDescription" className="text-sm text-agentvooc-secondary mt-1">
            Upload a JPEG, PNG, or GIF image for the character profile.
          </p>
          {profileImage && <p className="text-sm text-agentvooc-secondary mt-1">Selected: {profileImage.name}</p>}
        </div>
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Username
          </label>
          <Input
            id="username"
            name="username"
            type="text"
            value={characterData.username}
            onChange={handleInputChange}
            placeholder="Enter username (e.g., eliza)"
            className={inputClassName}
            aria-describedby="usernameDescription"
          />
          <p id="usernameDescription" className="text-sm text-agentvooc-secondary mt-1">
            Optional username for the character.
          </p>
        </div>
        <div>
          <label htmlFor="system" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            System Prompt
          </label>
          <Textarea
            id="system"
            name="system"
            value={characterData.system}
            onChange={handleInputChange}
            placeholder="Enter system prompt (e.g., Roleplay as a Web3 developer)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (characterData.system.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="systemDescription"
          />
          <p id="systemDescription" className="text-sm text-agentvooc-secondary mt-1">
            Optional system prompt to define the character’s behavior.
          </p>
        </div>
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Bio (one per line)
          </label>
          <Textarea
            id="bio"
            name="bio"
            value={bioInput}
            onChange={(e) => handleArrayInputChange(e, "bio")}
            placeholder="Enter bio statements, one per line (e.g., Web3 developer\nSecurity-minded)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (bioInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="bioDescription"
          />
          <p id="bioDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter bio statements, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="lore" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Lore (one per line)
          </label>
          <Textarea
            id="lore"
            name="lore"
            value={loreInput}
            onChange={(e) => handleArrayInputChange(e, "lore")}
            placeholder="Enter lore snippets, one per line (e.g., Started in Web2\nContributes to Ethereum)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (loreInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="loreDescription"
          />
          <p id="loreDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter lore snippets, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="messageExamples" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Message Examples (JSON format, array of arrays with user and content objects)
          </label>
          <Textarea
            id="messageExamples"
            name="messageExamples"
            value={messageExamplesInput}
            onChange={(e) => debouncedSetMessageExamplesInput(e.target.value)}
            placeholder={`Example format:\n[\n  [\n    {"user": "{{user1}}", "content": {"text": "Question"}},\n    {"user": "CharacterName", "content": {"text": "Answer"}}\n  ],\n  [...]\n]`}
            className={`${inputClassName} font-mono resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (messageExamplesInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="messageExamplesDescription"
          />
          <p id="messageExamplesDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter message examples in JSON format as an array of arrays.
          </p>
          {messageExamplesError && <p className="text-red-500 text-sm mt-1">{messageExamplesError}</p>}
        </div>
        <div>
          <label htmlFor="postExamples" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Post Examples (one per line)
          </label>
          <Textarea
            id="postExamples"
            name="postExamples"
            value={postExamplesInput}
            onChange={(e) => handleArrayInputChange(e, "postExamples")}
            placeholder="Enter post examples, one per line (e.g., Debugged for 3 hours\nGas fees are forever)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (postExamplesInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="postExamplesDescription"
          />
          <p id="postExamplesDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter post examples, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="topics" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Topics (one per line)
          </label>
          <Textarea
            id="topics"
            name="topics"
            value={topicsInput}
            onChange={(e) => handleArrayInputChange(e, "topics")}
            placeholder="Enter topics, one per line (e.g., Web3\nBlockchain)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (topicsInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="topicsDescription"
          />
          <p id="topicsDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter topics, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="adjectives" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Personality (one per line)
          </label>
          <Textarea
            id="adjectives"
            name="adjectives"
            value={adjectivesInput}
            onChange={(e) => handleArrayInputChange(e, "adjectives")}
            placeholder="Enter personality traits, one per line (e.g., witty\ntechnical)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (adjectivesInput.split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="adjectivesDescription"
          />
          <p id="adjectivesDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter personality traits, one per line.
          </p>
        </div>        
        <div>
          <label htmlFor="styleAll" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Style: All Contexts (one per line)
          </label>
          <Textarea
            id="styleAll"
            name="styleAll"
            value={characterData.style.all.join("\n")}
            onChange={(e) => handleAdvancedInputChange(e, "style", "all")}
            placeholder="Enter styles, one per line (e.g., concise\nwitty)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (characterData.style.all.join("\n").split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="styleAllDescription"
          />
          <p id="styleAllDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter styles for all contexts, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="styleChat" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Style: Chat (one per line)
          </label>
          <Textarea
            id="styleChat"
            name="styleChat"
            value={characterData.style.chat.join("\n")}
            onChange={(e) => handleAdvancedInputChange(e, "style", "chat")}
            placeholder="Enter chat styles, one per line (e.g., playful\ndynamic)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (characterData.style.chat.join("\n").split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="styleChatDescription"
          />
          <p id="styleChatDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter styles for chat, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="stylePost" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Style: Post (one per line)
          </label>
          <Textarea
            id="stylePost"
            name="stylePost"
            value={characterData.style.post.join("\n")}
            onChange={(e) => handleAdvancedInputChange(e, "style", "post")}
            placeholder="Enter post styles, one per line (e.g., ironic\nrelevant)"
            className={`${inputClassName} resize-none overflow-y-auto leading-6`}
            style={{
              minHeight: "120px",
              maxHeight: "288px",
              height: `${Math.min(288, Math.max(120, (characterData.style.post.join("\n").split("\n").length + 2) * 24))}px`,
              paddingBottom: "3rem",
            }}
            aria-describedby="stylePostDescription"
          />
          <p id="stylePostDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter styles for posts, one per line.
          </p>
        </div>
        <div>
          <label htmlFor="modelProvider" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Model Provider
          </label>
          <select
            id="modelProvider"
            name="modelProvider"
            value={characterData.modelProvider}
            onChange={handleInputChange}
            className={`${inputClassName} w-full p-2`}
            aria-describedby="modelProviderDescription"
          >
            <option value="OPENAI">OPENAI</option>
          </select>
          <p id="modelProviderDescription" className="text-sm text-agentvooc-secondary mt-1">
            Select the model provider for the character.
          </p>
        </div>
        <div>
          <label htmlFor="enableEmailPlugin" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Enable Email Plugin
          </label>
          <input
            id="enableEmailPlugin"
            name="enableEmailPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("email")}
            onChange={(e) => handleEmailCheckbox(e.target.checked)}
            className="text-agentvooc-accent focus:ring-agentvooc-accent rounded"
            aria-describedby="enableEmailPluginDescription"
          />
          <p id="enableEmailPluginDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enable email functionality for the character.
          </p>
        </div>
        {characterData.plugins.includes("email") && (
          <>
            <div>
              <h4 className="text-sm font-medium text-agentvooc-secondary mb-2">Outgoing Email Settings</h4>
              <div className="ml-4 space-y-4">
                <div>
                  <label htmlFor="emailOutgoingService" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Service
                  </label>
                  <select
                    id="emailOutgoingService"
                    name="emailOutgoingService"
                    value={characterData.settings.email.outgoing.service}
                    onChange={(e) => handleAdvancedInputChange(e, "settings", "email.outgoing.service")}
                    className={`${inputClassName} w-full p-2`}
                    aria-describedby="emailOutgoingServiceDescription"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="smtp">SMTP</option>
                  </select>
                  <p id="emailOutgoingServiceDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Select the outgoing email service.
                  </p>
                </div>
                {characterData.settings.email.outgoing.service === "smtp" && (
                  <>
                    <div>
                      <label htmlFor="emailOutgoingHost" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                        Host
                      </label>
                      <Input
                        id="emailOutgoingHost"
                        name="emailOutgoingHost"
                        type="text"
                        value={characterData.settings.email.outgoing.host}
                        onChange={(e) => handleAdvancedInputChange(e, "settings", "email.outgoing.host")}
                        placeholder="e.g., smtp.example.com"
                        className={inputClassName}
                        aria-describedby="emailOutgoingHostDescription"
                      />
                      <p id="emailOutgoingHostDescription" className="text-sm text-agentvooc-secondary mt-1">
                        Enter the SMTP host for outgoing emails.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="emailOutgoingPort" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                        Port
                      </label>
                      <Input
                        id="emailOutgoingPort"
                        name="emailOutgoingPort"
                        type="number"
                        value={characterData.settings.email.outgoing.port}
                        onChange={(e) => handleAdvancedInputChange(e, "settings", "email.outgoing.port")}
                        placeholder="e.g., 587"
                        className={inputClassName}
                        aria-describedby="emailOutgoingPortDescription"
                      />
                      <p id="emailOutgoingPortDescription" className="text-sm text-agentvooc-secondary mt-1">
                        Enter the SMTP port for outgoing emails.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="emailOutgoingSecure" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                        Secure (TLS)
                      </label>
                      <select
                        id="emailOutgoingSecure"
                        name="emailOutgoingSecure"
                        value={characterData.settings.email.outgoing.secure.toString()}
                        onChange={(e) => handleAdvancedInputChange(e, "settings", "email.outgoing.secure")}
                        className={`${inputClassName} w-full p-2`}
                        aria-describedby="emailOutgoingSecureDescription"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      <p id="emailOutgoingSecureDescription" className="text-sm text-agentvooc-secondary mt-1">
                        Enable TLS for outgoing emails.
                      </p>
                    </div>
                  </>
                )}
                <div>
                  <label htmlFor="emailOutgoingUser" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Username
                  </label>
                  <Input
                    id="emailOutgoingUser"
                    name="emailOutgoingUser"
                    type="email"
                    value={emailOutgoingUser}
                    onChange={handleEmailOutgoingUserChange}
                    placeholder="e.g., your-email@gmail.com"
                    className={`${inputClassName} ${emailOutgoingUserError ? "border-red-500" : ""}`}
                    aria-describedby="emailOutgoingUserDescription"
                    aria-invalid={!!emailOutgoingUserError}
                  />
                  {emailOutgoingUserError && (
                    <p className="text-red-500 text-sm mt-1">{emailOutgoingUserError}</p>
                  )}
                  <p id="emailOutgoingUserDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Enter the username for outgoing emails.
                  </p>
                </div>
                <div>
                  <label htmlFor="emailOutgoingPass" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Password
                  </label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="emailOutgoingPass"
                      name="emailOutgoingPass"
                      type={showEmailOutgoingPass ? "text" : "password"}
                      value={emailOutgoingPass}
                      onChange={handleEmailOutgoingPassChange}
                      placeholder="e.g., your-app-password"
                      className={`${inputClassName} pr-10`}
                      aria-describedby="emailOutgoingPassDescription"
                    />
                    <Button
                      type="button"
                      onClick={() => setShowEmailOutgoingPass(!showEmailOutgoingPass)}
                      className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg rounded-lg"
                    >
                      {showEmailOutgoingPass ? "Hide" : "Show"}
                    </Button>
                  </div>
                  <p id="emailOutgoingPassDescription" className="text-sm text-agentvooc-secondary mt-1">
                    {characterData.settings.email.outgoing.service === "gmail" ? (
                      <>
                        Use a Gmail App Password (
                        <a
                          href="https://support.google.com/mail/answer/185833?hl=en"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-agentvooc-accent hover:underline"
                        >
                          learn more
                        </a>
                        ).
                      </>
                    ) : (
                      "Enter the password for outgoing emails."
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-agentvooc-secondary mb-2">Incoming Email Settings</h4>
              <div className="ml-4 space-y-4">
                <div>
                  <label htmlFor="emailIncomingHost" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Host
                  </label>
                  <Input
                    id="emailIncomingHost"
                    name="emailIncomingHost"
                    type="text"
                    value={characterData.settings.email.incoming.host}
                    onChange={(e) => handleAdvancedInputChange(e, "settings", "email.incoming.host")}
                    placeholder="e.g., imap.gmail.com"
                    className={inputClassName}
                    aria-describedby="emailIncomingHostDescription"
                  />
                  <p id="emailIncomingHostDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Enter the IMAP host for incoming emails.
                  </p>
                </div>
                <div>
                  <label htmlFor="emailIncomingPort" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Port
                  </label>
                  <Input
                    id="emailIncomingPort"
                    name="emailIncomingPort"
                    type="number"
                    value={characterData.settings.email.incoming.port}
                    onChange={(e) => handleAdvancedInputChange(e, "settings", "email.incoming.port")}
                    placeholder="e.g., 993"
                    className={inputClassName}
                    aria-describedby="emailIncomingPortDescription"
                  />
                  <p id="emailIncomingPortDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Enter the IMAP port for incoming emails.
                  </p>
                </div>
                <div>
                  <label htmlFor="emailIncomingUser" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Username
                  </label>
                  <Input
                    id="emailIncomingUser"
                    name="emailIncomingUser"
                    type="email"
                    value={emailIncomingUser}
                    onChange={handleEmailIncomingUserChange}
                    placeholder="e.g., your-email@gmail.com"
                    className={`${inputClassName} ${emailIncomingUserError ? "border-red-500" : ""}`}
                    aria-describedby="emailIncomingUserDescription"
                    aria-invalid={!!emailIncomingUserError}
                  />
                  {emailIncomingUserError && (
                    <p className="text-red-500 text-sm mt-1">{emailIncomingUserError}</p>
                  )}
                  <p id="emailIncomingUserDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Enter the username for incoming emails.
                  </p>
                </div>
                <div>
                  <label htmlFor="emailIncomingPass" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                    Password
                  </label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="emailIncomingPass"
                      name="emailIncomingPass"
                      type={showEmailIncomingPass ? "text" : "password"}
                      value={emailIncomingPass}
                      onChange={handleEmailIncomingPassChange}
                      placeholder="e.g., your-app-password"
                      className={`${inputClassName} pr-10`}
                      aria-describedby="emailIncomingPassDescription"
                    />
                    <Button
                      type="button"
                      onClick={() => setShowEmailIncomingPass(!showEmailIncomingPass)}
                      className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg rounded-lg"
                    >
                      {showEmailIncomingPass ? "Hide" : "Show"}
                    </Button>
                  </div>
                  <p id="emailIncomingPassDescription" className="text-sm text-agentvooc-secondary mt-1">
                    Enter the password for incoming emails.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
        <div>
          <label htmlFor="enableTelegramPlugin" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Enable Telegram Plugin
          </label>
          <input
            id="enableTelegramPlugin"
            name="enableTelegramPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("telegram")}
            onChange={(e) => handleTelegramCheckbox(e.target.checked)}
            className="text-agentvooc-accent focus:ring-agentvooc-accent rounded"
            aria-describedby="enableTelegramPluginDescription"
          />
          <p id="enableTelegramPluginDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enable Telegram functionality for the character.
          </p>
        </div>
        {characterData.plugins.includes("telegram") && (
          <div>
            <h4 className="text-sm font-medium text-agentvooc-secondary mb-2">Telegram Settings</h4>
            <div className="ml-4 space-y-4">
              <div>
                <label htmlFor="telegramBotToken" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                  Bot Token
                </label>
                <Input
                  id="telegramBotToken"
                  name="telegramBotToken"
                  type="text"
                  value={telegramBotToken}
                  onChange={handleTelegramBotTokenChange}
                  placeholder="e.g., 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className={inputClassName}
                  aria-describedby="telegramBotTokenDescription"
                />
                <p id="telegramBotTokenDescription" className="text-sm text-agentvooc-secondary mt-1">
                  Enter the Telegram bot token.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* New Chipi Plugin Section */}
          <div>
            <label htmlFor="enableChipiPlugin" className="block text-sm font-medium text-agentvooc-secondary mb-1">
              Enable Chipi Plugin
            </label>
            <input
              id="enableChipiPlugin"
              name="enableChipiPlugin"
              type="checkbox"
              checked={characterData.plugins.includes("chipi")}
              onChange={(e) => handleChipiCheckbox(e.target.checked)}
              className="text-agentvooc-accent focus:ring-agentvooc-accent rounded"
              aria-describedby="enableChipiPluginDescription"
            />
            <p id="enableChipiPluginDescription" className="text-sm text-agentvooc-secondary mt-1">
              Enable Chipi functionality for the character.
            </p>
          </div>

          
        {/* <div>
          <label htmlFor="enableTwitterPlugin" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Enable Twitter Plugin
          </label>
          <input
            id="enableTwitterPlugin"
            name="enableTwitterPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("twitter")}
            onChange={(e) => handleTwitterCheckbox(e.target.checked)}
            className="text-agentvooc-accent focus:ring-agentvooc-accent rounded"
            aria-describedby="enableTwitterPluginDescription"
          />
          <p id="enableTwitterPluginDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enable Twitter functionality for the character.
          </p>
        </div>
        {characterData.plugins.includes("twitter") && (
          <div>
            <h4 className="text-sm font-medium text-agentvooc-secondary mb-2">Twitter Settings</h4>
            <div className="ml-4 space-y-4">
              <div>
                <label htmlFor="twitterUsername" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                  Twitter Username
                </label>
                <Input
                  id="twitterUsername"
                  name="twitterUsername"
                  type="text"
                  value={twitterUsername}
                  onChange={handleTwitterUsernameChange}
                  placeholder="e.g., @username"
                  className="text-agentvooc-primary bg-agentvooc-secondary-accent border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
                  aria-describedby="twitterUsernameDescription"
                />
                <p id="twitterUsernameDescription" className="text-sm text-agentvooc-secondary mt-1">
                  Enter the Twitter username.
                </p>
              </div>
              <div>
                <label htmlFor="twitterPassword" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                  Twitter Password
                </label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="twitterPassword"
                    name="twitterPassword"
                    type={showTwitterPassword ? "text" : "password"}
                    value={twitterPassword}
                    onChange={handleTwitterPasswordChange}
                    placeholder="Enter your Twitter password"
                    className="text-agentvooc-primary bg-agentvooc-secondary-accent border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
                    aria-describedby="twitterPasswordDescription"
                  />
                  <Button
                    type="button"
                    onClick={() => setShowTwitterPassword(!showTwitterPassword)}
                    className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg rounded-lg"
                  >
                    {showTwitterPassword ? "Hide" : "Show"}
                  </Button>
                </div>
                <p id="twitterPasswordDescription" className="text-sm text-agentvooc-secondary mt-1">
                  Enter the Twitter password.
                </p>
              </div>
              <div>
                <label htmlFor="twitterEmail" className="block text-sm font-medium text-agentvooc-secondary mb-1">
                  Twitter Email
                </label>
                <Input
                  id="twitterEmail"
                  name="twitterEmail"
                  type="email"
                  value={twitterEmail}
                  onChange={handleTwitterEmailChange}
                  placeholder="e.g., user@example.com"
                  className="text-agentvooc-primary bg-agentvooc-secondary-accent border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
                  aria-describedby="twitterEmailDescription"
                />
                <p id="twitterEmailDescription" className="text-sm text-agentvooc-secondary mt-1">
                  Enter the Twitter email.
                </p>
              </div>
            </div>
          </div>
        )} */}
        {/* <div>
          <label htmlFor="voiceModel" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Voice Model
          </label>
          <Input
            id="voiceModel"
            name="voiceModel"
            type="text"
            value={characterData.settings.voice.model}
            onChange={(e) => handleAdvancedInputChange(e, "settings", "voiceModel")}
            placeholder="Enter voice model (e.g., en_US-hfc_female-medium)"
            className="text-agentvooc-primary bg-agentvooc-secondary-accent border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
            aria-describedby="voiceModelDescription"
          />
          <p id="voiceModelDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enter the voice model for the character.
          </p>
        </div> */}
        <div>
          <label htmlFor="ragKnowledge" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Enable RAG Knowledge
          </label>
          <select
            id="ragKnowledge"
            name="ragKnowledge"
            value={characterData.settings.ragKnowledge.toString()}
            onChange={(e) => handleAdvancedInputChange(e, "settings", "ragKnowledge")}
            className={`${inputClassName} w-full p-2`}
            aria-describedby="ragKnowledgeDescription"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <p id="ragKnowledgeDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enable or disable RAG knowledge for the character.
          </p>
        </div>    
        
        <div>
          <label htmlFor="enabled" className="block text-sm font-medium text-agentvooc-secondary mb-1">
            Enabled
          </label>
          <select
            id="enabled"
            name="enabled"
            value={characterData.enabled.toString()}
            onChange={(e) => setCharacterData((prev) => ({ ...prev, enabled: e.target.value === "true" }))}
            className={`${inputClassName} w-full p-2`}
            aria-describedby="enabledDescription"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          <p id="enabledDescription" className="text-sm text-agentvooc-secondary mt-1">
            Enable or disable the character.
          </p>
        </div>    
        <div className="flex gap-4">
          <Button
            type="submit"
            className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg shadow-agentvooc-glow rounded-lg px-6 py-2"
            disabled={updateCharacterMutation.isPending || uploadImageMutation.isPending}
            aria-label="Update character"
          >
            {updateCharacterMutation.isPending || uploadImageMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-agentvooc-primary" />
                Updating...
              </>
            ) : (
              "Update Character"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="border-agentvooc-accent/30 text-agentvooc-primary hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg rounded-lg px-6 py-2"
            aria-label="Cancel"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}