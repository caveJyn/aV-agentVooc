// client/src/components/create-character.tsx
import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import type { UUID } from "@elizaos/core";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";

// Debounce utility
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface CreateCharacterProps {
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function CreateCharacter({ setError }: CreateCharacterProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [twitterUsername, setTwitterUsername] = useState("");
  const [twitterPassword, setTwitterPassword] = useState("");
  const [twitterEmail, setTwitterEmail] = useState("");
  const [messageExamplesError, setMessageExamplesError] = useState<string | null>(null);
  const [emailOutgoingUser, setEmailOutgoingUser] = useState("");
  const [emailOutgoingPass, setEmailOutgoingPass] = useState("");
  const [emailIncomingUser, setEmailIncomingUser] = useState("");
  const [emailIncomingPass, setEmailIncomingPass] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false); // New state for loader

  const [emailOutgoingUserError, setEmailOutgoingUserError] = useState<string | null>(null);
  const [emailIncomingUserError, setEmailIncomingUserError] = useState<string | null>(null);
  const [showEmailOutgoingPass, setShowEmailOutgoingPass] = useState(false);
  const [showEmailIncomingPass, setShowEmailIncomingPass] = useState(false);


  // Initialize characterData state with empty fields
  const [characterData, setCharacterData] = useState({
    id: uuidv4() as UUID,
    name: "",
    username: "",
    system: "",
    bio: [] as string[],
    lore: [] as string[],
    messageExamples: [] as any[],
    postExamples: [] as string[],
    topics: [] as string[],
    adjectives: [] as string[],
    modelProvider: "OPENAI" as "OPENAI" | undefined,
    plugins: [] as string[],
    settings: {
      secrets: { dynamic: [] as { key: string; value: string }[] },
      voice: { model: "" },
      ragKnowledge: false,
      email: {
        outgoing: {
          service: "gmail" as "smtp" | "gmail",
          host: "",
          port: 0,
          secure: false,
          user: "",
          pass: "",
        },
        incoming: {
          service: "imap" as "imap",
          host: "",
          port: 993,
          user: "",
          pass: "",
        },
      },
    },
    style: {
      all: [] as string[],
      chat: [] as string[],
      post: [] as string[],
    },
    knowledge: [] as any[],
  });

  const [bioInput, setBioInput] = useState("");
  const [loreInput, setLoreInput] = useState("");
  const [messageExamplesInput, setMessageExamplesInput] = useState("[]");
  const [postExamplesInput, setPostExamplesInput] = useState("");
  const [topicsInput, setTopicsInput] = useState("");
  const [adjectivesInput, setAdjectivesInput] = useState("");
  const [styleAllInput, setStyleAllInput] = useState("");
  const [styleChatInput, setStyleChatInput] = useState("");
  const [stylePostInput, setStylePostInput] = useState("");


   // Email validation function
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };


  // Debounced email validation
  const debouncedValidateEmail = useCallback(
    debounce((value: string, field: string, setFieldError: (error: string | null) => void) => {
      if (!value) {
        setFieldError(null); // Clear error if field is empty
        return true;
      }
      const isValid = validateEmail(value);
      if (!isValid) {
        setFieldError(`Invalid email format for ${field}`);
      } else {
        setFieldError(null); // Clear error if valid
      }
      return isValid;
    }, 300),
    []
  );

  // Toggle password visibility
  const toggleEmailOutgoingPassVisibility = () => {
    setShowEmailOutgoingPass((prev) => !prev);
  };

  const toggleEmailIncomingPassVisibility = () => {
    setShowEmailIncomingPass((prev) => !prev);
  };

  // Fetch character presets
  const presetsQuery = useQuery({
    queryKey: ["characterPresets"],
    queryFn: async () => {
      const response = await apiClient.getCharacterPresets();
      // console.log("[CREATE_CHARACTER] characterPresets response:", response);
      return response.characterPresets;
    },
  });

  // Fetch user data from Sanity
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const response = await apiClient.getUser();
      // console.log("[CREATE_CHARACTER] userQuery response:", response);
      return response.user;
    },
  });

  // Handle preset selection
  const handlePresetSelect = (preset: any | null) => {
    setSelectedPreset(preset?._id || null);
    if (!preset) {
      // Reset to "Create Your Own" with empty fields
      setCharacterData({
        id: uuidv4() as UUID,
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
          secrets: { dynamic: [] },
          voice: { model: "" },
          ragKnowledge: false,
          email: {
            outgoing: { service: "gmail", host: "", port: 0, secure: false, user: "", pass: "" },
            incoming: { service: "imap", host: "", port: 993, user: "", pass: "" },
          },
        },
        style: {
          all: [],
          chat: [],
          post: [],
        },
        knowledge: [],
      });
      setBioInput("");
      setLoreInput("");
      setMessageExamplesInput("[]");
      setPostExamplesInput("");
      setTopicsInput("");
      setAdjectivesInput("");
      setStyleAllInput("");
      setStyleChatInput("");
      setStylePostInput("");
      setProfileImage(null);
      setImagePreview(null);
      setTelegramBotToken("");
      setTwitterUsername("");
      setTwitterPassword("");
      setTwitterEmail("");
      setEmailOutgoingUser("");
      setEmailOutgoingPass("");
      setEmailIncomingUser("");
      setEmailIncomingPass("");
      setEmailOutgoingUserError(null); // Reset error states
      setEmailIncomingUserError(null);
      setShowEmailOutgoingPass(false);
      setShowEmailIncomingPass(false);
    } else {
      // Load preset data
      setCharacterData({
        id: uuidv4() as UUID,
        name: preset.name || "",
        username: preset.username || "",
        system: preset.system || "",
        bio: preset.bio || [],
        lore: preset.lore || [],
        messageExamples: preset.messageExamples?.map((msg: any) => msg.conversation) || [],
        postExamples: preset.postExamples || [],
        topics: preset.topics || [],
        adjectives: preset.adjectives || [],
        modelProvider: preset.modelProvider || "OPENAI",
        plugins: preset.plugins || [],
        settings: {
          secrets: preset.settings?.secrets?.dynamic ? { dynamic: preset.settings.secrets.dynamic } : { dynamic: [] },
          voice: preset.settings?.voice || { model: "" },
          ragKnowledge: preset.settings?.ragKnowledge || false,
          email: {
            outgoing: preset.settings?.email?.outgoing || { service: "gmail", host: "", port: 0, secure: false, user: "", pass: "" },
            incoming: preset.settings?.email?.incoming || { service: "imap", host: "", port: 993, user: "", pass: "" },
          },
        },
        style: {
          all: preset.style?.all || [],
          chat: preset.style?.chat || [],
          post: preset.style?.post || [],
        },
        knowledge: preset.knowledge || [],
      });
      setBioInput(preset.bio?.join(",\n\n") || "");
      setLoreInput(preset.lore?.join(",\n") || "");
      setMessageExamplesInput(
        JSON.stringify(preset.messageExamples?.map((msg: any) => msg.conversation) || [], null, 2)
      );
      setPostExamplesInput(preset.postExamples?.join(",\n") || "");
      setTopicsInput(preset.topics?.join(",\n") || "");
      setAdjectivesInput(preset.adjectives?.join(",\n") || "");
      setStyleAllInput(preset.style?.all?.join(",\n") || "");
      setStyleChatInput(preset.style?.chat?.join(",\n") || "");
      setStylePostInput(preset.style?.post?.join(",\n") || "");
      setEmailOutgoingUser(preset.settings?.email?.outgoing?.user || "");
      setEmailOutgoingPass(preset.settings?.email?.outgoing?.pass || "");
      setEmailIncomingUser(preset.settings?.email?.incoming?.user || "");
      setEmailIncomingPass(preset.settings?.email?.incoming?.pass || "");
      debouncedValidateEmail(preset.settings?.email?.outgoing?.user || "", "outgoing email username", setEmailOutgoingUserError);
      debouncedValidateEmail(preset.settings?.email?.incoming?.user || "", "incoming email username", setEmailIncomingUserError);
    }
  };

  useEffect(() => {
    setCharacterData((prev) => {
      let parsedMessageExamples = prev.messageExamples;
      let jsonError: string | null = null;

      if (messageExamplesInput) {
        try {
          parsedMessageExamples = JSON.parse(messageExamplesInput);
          if (!Array.isArray(parsedMessageExamples) || !parsedMessageExamples.every(Array.isArray)) {
            jsonError = "Message Examples must be an array of arrays";
            setMessageExamplesError(jsonError);
            parsedMessageExamples = [];
          } else {
            const isValid = parsedMessageExamples.every((example) =>
              example.every(
                (msg) =>
                  msg &&
                  typeof msg === "object" &&
                  "user" in msg &&
                  "content" in msg &&
                  msg.content &&
                  typeof msg.content === "object" &&
                  "text" in msg.content
              )
            );
            if (!isValid) {
              jsonError = "Each message example must contain objects with 'user' and 'content' properties, where 'content' has a 'text' property";
              setMessageExamplesError(jsonError);
              parsedMessageExamples = [];
            } else {
              setMessageExamplesError(null);
            }
          }
        } catch (error) {
          jsonError = "Invalid JSON format in Message Examples";
          setMessageExamplesError(jsonError);
          parsedMessageExamples = [];
        }
      } else {
        parsedMessageExamples = [];
        setMessageExamplesError(null);
      }

      return {
        ...prev,
        bio: bioInput ? bioInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        lore: loreInput ? loreInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        messageExamples: parsedMessageExamples,
        postExamples: postExamplesInput ? postExamplesInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        topics: topicsInput ? topicsInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        adjectives: adjectivesInput ? adjectivesInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        style: {
          all: styleAllInput ? styleAllInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
          chat: styleChatInput ? styleChatInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
          post: stylePostInput ? stylePostInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
        },
        settings: {
          ...prev.settings,
          email: {
            ...prev.settings.email,
            outgoing: {
              ...prev.settings.email.outgoing,
              user: emailOutgoingUser,
              pass: emailOutgoingPass,
            },
            incoming: {
              ...prev.settings.email.incoming,
              user: emailIncomingUser,
              pass: emailIncomingPass,
            },
          },
        },
      };
    });
  }, [
    bioInput,
    loreInput,
    messageExamplesInput,
    postExamplesInput,
    topicsInput,
    adjectivesInput,
    styleAllInput,
    styleChatInput,
    stylePostInput,
    emailOutgoingUser,
    emailOutgoingPass,
    emailIncomingUser,
    emailIncomingPass,
  ]);

  const handlePluginChange = async (plugin: string, checked: boolean) => {
    let activePlugins = userQuery.data?.activePlugins || [];
    // console.log("[CREATE_CHARACTER] handlePluginChange:", {
    //   plugin,
    //   checked,
    //   activePlugins,
    //   userQueryStatus: userQuery.status,
    //   userQueryError: userQuery.error,
    // });

    if (!activePlugins.includes(plugin) && checked) {
      try {
        // console.log("[CREATE_CHARACTER] Plugin not in activePlugins, fetching subscription items");
        const subscriptionData = await apiClient.getSubscriptionItems({ includeDetails: true });
        activePlugins = subscriptionData.plugins || [];
        // console.log("[CREATE_CHARACTER] Fetched subscription items, activePlugins:", activePlugins);

        if (!activePlugins.includes(plugin)) {
          toast({
            title: "Subscription Required",
            description: `You need a subscription for the ${plugin} plugin. Please subscribe in the settings page.`,
            action: (
              <Button
                onClick={() => navigate("/settings", { state: { from: "create-character" } })}
                variant="default"
              >
                Go to Settings
              </Button>
            ),
          });
          return;
        }
      } catch (error) {
        console.error("[CREATE_CHARACTER] Error fetching subscription items:", error);
        toast({
          title: "Error",
          description: "Failed to verify plugin subscription. Please try again.",
        });
        return;
      }
    }

    setCharacterData((prev) => ({
      ...prev,
      plugins: checked
        ? [...prev.plugins, plugin]
        : prev.plugins.filter((p) => p !== plugin),
    }));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setCharacterData((prev) => ({ ...prev, [name]: value }));
  };

  const debouncedSetMessageExamplesInput = useCallback(
    debounce((value: string) => {
      setMessageExamplesInput(value);
    }, 300),
    []
  );

  const handleArrayInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    field: string
  ) => {
    const value = e.target.value;
    if (field === "bio") {
      setBioInput(value);
    } else if (field === "lore") {
      setLoreInput(value);
    } else if (field === "messageExamples") {
      debouncedSetMessageExamplesInput(value);
    } else if (field === "postExamples") {
      setPostExamplesInput(value);
    } else if (field === "topics") {
      setTopicsInput(value);
    } else if (field === "adjectives") {
      setAdjectivesInput(value);
    } else if (field === "styleAll") {
      setStyleAllInput(value);
    } else if (field === "styleChat") {
      setStyleChatInput(value);
    } else if (field === "stylePost") {
      setStylePostInput(value);
    }
  };

  const handleAdvancedInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
    field: string,
    subfield?: string
  ) => {
    const value = e.target.value;
    setCharacterData((prev) => {
      if (field === "settings" && subfield) {
        if (subfield === "voiceModel") {
          return {
            ...prev,
            settings: {
              ...prev.settings,
              voice: { model: value },
            },
          };
        }
        if (subfield === "ragKnowledge") {
          return {
            ...prev,
            settings: {
              ...prev.settings,
              ragKnowledge: value === "true",
            },
          };
        }
        if (subfield.startsWith("email.outgoing.")) {
          const key = subfield.split(".")[2];
          return {
            ...prev,
            settings: {
              ...prev.settings,
              email: {
                ...prev.settings.email,
                outgoing: {
                  ...prev.settings.email.outgoing,
                  [key]: key === "port" ? Number(value) : key === "secure" ? value === "true" : value,
                },
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
                incoming: {
                  ...prev.settings.email.incoming,
                  [key]: key === "port" ? Number(value) : value,
                },
              },
            },
          };
        }
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
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
        settings: {
          ...prev.settings,
          email: {
            outgoing: { service: "gmail", host: "", port: 0, secure: false, user: "", pass: "" },
            incoming: { service: "imap", host: "", port: 993, user: "", pass: "" },
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
        email: {
          ...prev.settings.email,
          outgoing: { ...prev.settings.email.outgoing, user: value },
        },
      },
    }));
  };

  const handleEmailOutgoingPassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailOutgoingPass(value);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: {
          ...prev.settings.email,
          outgoing: { ...prev.settings.email.outgoing, pass: value },
        },
      },
    }));
  };

  const handleEmailIncomingUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailIncomingUser(value);
    debouncedValidateEmail(value, "incoming email username", setEmailIncomingUserError);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: {
          ...prev.settings.email,
          incoming: { ...prev.settings.email.incoming, user: value },
        },
      },
    }));
  };

  const handleEmailIncomingPassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailIncomingPass(value);
    setCharacterData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        email: {
          ...prev.settings.email,
          incoming: { ...prev.settings.email.incoming, pass: value },
        },
      },
    }));
  };

  const handleTelegramCheckbox = (checked: boolean) => {
    handlePluginChange("telegram", checked);
    if (!checked) {
      setTelegramBotToken("");
    }
  };

  const handleTelegramBotTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelegramBotToken(e.target.value);
  };

   // Add handler for Chipi plugin checkbox
  const handleChipiCheckbox = (checked: boolean) => {
    handlePluginChange("chipi", checked);
  };

  // Add handler for ZKProof plugin checkbox
  const handleZKProofCheckbox = (checked: boolean) => {
    handlePluginChange("zKproof", checked);
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
  //   setTwitterUsername(e.target.value);
  // };

  // const handleTwitterPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setTwitterPassword(e.target.value);
  // };

  // const handleTwitterEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   setTwitterEmail(e.target.value);
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
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const uploadImageMutation = useMutation({
    mutationFn: async ({ characterId, file }: { characterId: UUID; file: File }) => {
      // console.log("[CREATE_CHARACTER] Uploading profile image for characterId:", characterId);
      const formData = new FormData();
      formData.append("image", file);
      const response = await apiClient.uploadCharacterProfileImage(characterId, formData);
      // console.log("[CREATE_CHARACTER] Image upload response:", response);
      return response;
    },
    onSuccess: (_response) => {
      // console.log("[CREATE_CHARACTER] Profile image uploaded successfully, URL:", response.url);
      toast({
        title: "Success",
        description: "Profile image uploaded successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
    onError: (error: any) => {
      console.error("[CREATE_CHARACTER] Image upload error:", error);
      setError("Failed to upload image: " + (error.message || "Unknown error"));
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to upload image.",
      });
      if (error.status === 401 && window.location.pathname !== "/auth") {
        // console.log("[CREATE_CHARACTER] 401 error, redirecting to /auth");
        navigate("/auth");
      }
    },
  });

  const createCharacterMutation = useMutation({
  mutationFn: async () => {
    setIsCreating(true); // Start loader
    // Check if user is logged in
    if (!userQuery.data) {
      throw new Error("Log in to create Character");
    }

    // Validate email settings if email plugin is enabled
    if (characterData.plugins.includes("email")) {
      if (
        !emailOutgoingUser ||
        !emailOutgoingPass ||
        !emailIncomingUser ||
        !emailIncomingPass
      ) {
        throw new Error(
          "All email fields (username and password for both outgoing and incoming) are required when email plugin is enabled."
        );
      }
      if (
        characterData.settings.email.outgoing.service === "smtp" &&
        (!characterData.settings.email.outgoing.host ||
          !characterData.settings.email.outgoing.port)
      ) {
        throw new Error(
          "SMTP host and port are required when using SMTP service."
        );
      }
    }

    // Validate messageExamples JSON
    let parsedMessageExamples;
    try {
      parsedMessageExamples = messageExamplesInput
        ? JSON.parse(messageExamplesInput)
        : [];
      if (!Array.isArray(parsedMessageExamples) || !parsedMessageExamples.every(Array.isArray)) {
        throw new Error("Message Examples must be an array of arrays");
      }
      const isValid = parsedMessageExamples.every((example) =>
        example.every(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            "user" in msg &&
            "content" in msg &&
            msg.content &&
            typeof msg.content === "object" &&
            "text" in msg.content
        )
      );
      if (!isValid) {
        throw new Error(
          "Each message example must contain objects with 'user' and 'content' properties, where 'content' has a 'text' property"
        );
      }
    } catch (error) {
      throw new Error(
        "Invalid JSON format in Message Examples: " +
          (error instanceof Error ? error.message : String(error))
      );
    }

    const updatedCharacterData = {
      id: characterData.id,
      name: characterData.name,
      username: characterData.username || undefined,
      system: characterData.system || undefined,
      bio: bioInput ? bioInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
      lore: loreInput ? loreInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s) : [],
      messageExamples: parsedMessageExamples,
      postExamples: postExamplesInput
        ? postExamplesInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
        : [],
      topics: topicsInput
        ? topicsInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
        : [],
      adjectives: adjectivesInput
        ? adjectivesInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
        : [],
      modelProvider: characterData.modelProvider || "OPENAI",
      plugins: characterData.plugins || [],
      knowledge: characterData.knowledge || [],
      settings: {
        secrets: {
          dynamic: [
            ...(telegramBotToken ? [{ key: "TELEGRAM_BOT_TOKEN", value: telegramBotToken }] : []),
            ...(twitterUsername ? [{ key: "TWITTER_USERNAME", value: twitterUsername }] : []),
            ...(twitterPassword ? [{ key: "TWITTER_PASSWORD", value: twitterPassword }] : []),
            ...(twitterEmail ? [{ key: "TWITTER_EMAIL", value: twitterEmail }] : []),
            ...(emailOutgoingUser ? [{ key: "EMAIL_OUTGOING_USER", value: emailOutgoingUser }] : []),
            ...(emailOutgoingPass ? [{ key: "EMAIL_OUTGOING_PASS", value: emailOutgoingPass }] : []),
            ...(emailIncomingUser ? [{ key: "EMAIL_INCOMING_USER", value: emailIncomingUser }] : []),
            ...(emailIncomingPass ? [{ key: "EMAIL_INCOMING_PASS", value: emailIncomingPass }] : []),
          ],
        },
        voice: characterData.settings.voice.model ? characterData.settings.voice : undefined,
        ragKnowledge: characterData.settings.ragKnowledge,
        email: characterData.plugins.some((p) => ["email"].includes(p))
          ? {
              outgoing: {
                ...characterData.settings.email.outgoing,
                user: emailOutgoingUser,
                pass: emailOutgoingPass,
              },
              incoming: {
                ...characterData.settings.email.incoming,
                user: emailIncomingUser,
                pass: emailIncomingPass,
              },
            }
          : undefined,
      },
      style: {
        all: styleAllInput
          ? styleAllInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
          : [],
        chat: styleChatInput
          ? styleChatInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
          : [],
        post: stylePostInput
          ? stylePostInput.split(/,\s*\n/).map((s) => s.trim()).filter((s) => s)
          : [],
      },
      createdBy: {
        _type: "reference",
        _ref: userQuery.data._id, // Safe to access since we checked userQuery.data
      },
    };

    await apiClient.createCharacter(updatedCharacterData);

    if (profileImage) {
      await uploadImageMutation.mutateAsync({ characterId: characterData.id, file: profileImage });
    }

    return characterData.id;
  },
  onSuccess: (_characterId) => {
    setIsCreating(false); // Stop loader
    queryClient.invalidateQueries({ queryKey: ["characters"] });
    toast({
      title: "Success",
      description: `Character "${characterData.name}" created successfully.`,
    });
    // Reset form to empty fields
    setCharacterData({
      id: uuidv4() as UUID,
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
        secrets: { dynamic: [] },
        voice: { model: "" },
        ragKnowledge: false,
        email: {
          outgoing: { service: "gmail", host: "", port: 0, secure: false, user: "", pass: "" },
          incoming: { service: "imap", host: "", port: 993, user: "", pass: "" },
        },
      },
      style: {
        all: [],
        chat: [],
        post: [],
      },
      knowledge: [],
    });
    setBioInput("");
    setLoreInput("");
    setMessageExamplesInput("[]");
    setPostExamplesInput("");
    setTopicsInput("");
    setAdjectivesInput("");
    setStyleAllInput("");
    setStyleChatInput("");
    setStylePostInput("");
    setProfileImage(null);
    setImagePreview(null);
    setError(null);
    setTelegramBotToken("");
    setTwitterUsername("");
    setTwitterPassword("");
    setTwitterEmail("");
    setEmailOutgoingUser("");
    setEmailOutgoingPass("");
    setEmailIncomingUser("");
    setEmailIncomingPass("");
    setSelectedPreset(null);
    navigate("/home");
  },
  onError: (error: any) => {
    setIsCreating(false); // Stop loader
    console.error("[CREATE_CHARACTER] Character creation error:", error);
    const errorMessage = error.message || "Failed to create character";
    setError(errorMessage);
    toast({
      variant: "destructive",
      title: "Error",
      description: errorMessage,
    });
    // Only redirect for 401 errors from the API, not for the "Log in to create Character" error
    if (error.status === 401 && errorMessage !== "Log in to create Character" && window.location.pathname !== "/auth") {
      navigate("/auth");
    }
  },
});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterData.name) {
      setError("Character name is required.");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Character name is required.",
      });
      return;
    }
    try {
      if (messageExamplesInput) {
        JSON.parse(messageExamplesInput);
      }
    } catch (error) {
      setError("Invalid JSON format in Message Examples");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid JSON format in Message Examples. Please check the syntax.",
      });
      return;
    }
    // console.log("[CREATE_CHARACTER] Submitting character creation form");
    createCharacterMutation.mutate();
  };

  const handleCancel = () => {
    // console.log("[CREATE_CHARACTER] Canceling character creation");
    navigate("/home");
  };


  // Define the common className for inputs and textareas
  const inputClassName =
  " border-agentvooc-accent/50 bg-agentvooc-secondary-bg focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg";


  return (
  <div className="p-6 border border-agentvooc-accent/30  w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <h3 className="text-xl font-semibold mb-6 ">Create New Character</h3>
    <div className="mb-6">
      <label className="block text-sm font-medium  mb-2">
        Select a Preset
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedPreset === null ? "default" : "outline"}
          onClick={() => handlePresetSelect(null)}
          className={
            selectedPreset === null
              ? ""
              : "w-full border-agentvooc-accent/30  hover:bg-agentvooc-accent hover:-bg"
          }
        >
          Create Your Own
        </Button>
        {presetsQuery.isLoading ? (
          <p className="">Loading presets...</p>
        ) : presetsQuery.isError ? (
          <p className="text-red-500">Error loading presets: {presetsQuery.error.message}</p>
        ) : (
          presetsQuery.data?.map((preset: any) => (
            <Button
              key={preset._id}
              variant={selectedPreset === preset._id ? "default" : "outline"}
              onClick={() => handlePresetSelect(preset)}
              className={
                selectedPreset === preset._id
                  ? ""
                  : "w-full border-agentvooc-accent/30  hover:bg-agentvooc-accent hover:-bg"
              }
            >
              {preset.name}
            </Button>
          ))
        )}
      </div>
    </div>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium  mb-1"
        >
          Character Name (Required)
        </label>
        <Input
          id="name"
          name="name"
          type="text"
          value={characterData.name}
          onChange={handleInputChange}
          placeholder="Enter character name (e.g., Eliza)"
          className={inputClassName}
          required
        />
      </div>
      <div>
        <label
          htmlFor="profileImage"
          className="block text-sm font-medium  mb-1"
        >
          Profile Image (JPEG, PNG, or GIF)
        </label>
        {imagePreview && (
          <div className="mt-2 mb-4">
            <img
              src={imagePreview}
              alt="Profile preview"
              className="w-24 h-24 object-cover rounded-sm"
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
        />
        {profileImage && (
          <p className="text-sm  mt-1">
            Selected: {profileImage.name}
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium  mb-1"
        >
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
        />
      </div>
      <div>
        <label
          htmlFor="system"
          className="block text-sm font-medium  mb-1"
        >
          System Prompt
        </label>
        <Textarea
          id="system"
          name="system"
          value={characterData.system}
          onChange={handleInputChange}
          placeholder="Enter system prompt (e.g., Roleplay as a Web3 developer)"
          className={inputClassName}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (characterData.system.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="bio"
          className="block text-sm font-medium  mb-1"
        >
          Bio (comma-separated, one per line)
        </label>
        <Textarea
          id="bio"
          name="bio"
          value={bioInput}
          onChange={(e) => handleArrayInputChange(e, "bio")}
          placeholder="Enter bio statements, one per line (e.g., Web3 developer,\nSecurity-minded)"
          className={inputClassName}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (bioInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="lore"
          className="block text-sm font-medium  mb-1"
        >
          Lore (comma-separated, one per line)
        </label>
        <Textarea
          id="lore"
          name="lore"
          value={loreInput}
          onChange={(e) => handleArrayInputChange(e, "lore")}
          placeholder="Enter lore snippets, one per line (e.g., Started in Web2,\nContributes to Ethereum)"
          className={inputClassName}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (loreInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="messageExamples"
          className="block text-sm font-medium  mb-1"
        >
          Message Examples (JSON format, array of arrays with user and content objects)
        </label>
        <Textarea
          id="messageExamples"
          name="messageExamples"
          value={messageExamplesInput}
          onChange={(e) => handleArrayInputChange(e, "messageExamples")}
          placeholder={`Example format:\n[\n  [\n    {"user": "{{user1}}", "content": {"text": "Question"}},\n    {"user": "CharacterName", "content": {"text": "Answer"}}\n  ],\n  [...]\n]`}
          className={`${inputClassName} font-mono resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (messageExamplesInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
        {messageExamplesError && (
          <p className="text-red-500 text-sm mt-1">{messageExamplesError}</p>
        )}
      </div>
      <div>
        <label
          htmlFor="postExamples"
          className="block text-sm font-medium  mb-1"
        >
          Post Examples (comma-separated, one per line)
        </label>
        <Textarea
          id="postExamples"
          name="postExamples"
          value={postExamplesInput}
          onChange={(e) => handleArrayInputChange(e, "postExamples")}
          placeholder="Enter post examples, one per line (e.g., Debugged for 3 hours,\nGas fees are forever)"
          className={inputClassName}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (postExamplesInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="topics"
          className="block text-sm font-medium  mb-1"
        >
          Topics (comma-separated, one per line)
        </label>
        <Textarea
          id="topics"
          name="topics"
          value={topicsInput}
          onChange={(e) => handleArrayInputChange(e, "topics")}
          placeholder="Enter topics, one per line (e.g., Web3,\nBlockchain)"
          className={`${inputClassName} resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (topicsInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="adjectives"
          className="block text-sm font-medium  mb-1"
        >
          Personality (comma-separated, one per line)
        </label>
        <Textarea
          id="adjectives"
          name="adjectives"
          value={adjectivesInput}
          onChange={(e) => handleArrayInputChange(e, "adjectives")}
          placeholder="Enter personality traits, one per line (e.g., witty,\ntechnical)"
          className={`${inputClassName} resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (adjectivesInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="styleAll"
          className="block text-sm font-medium  mb-1"
        >
          Style: All Contexts (comma-separated, one per line)
        </label>
        <Textarea
          id="styleAll"
          name="styleAll"
          value={styleAllInput}
          onChange={(e) => handleArrayInputChange(e, "styleAll")}
          placeholder="Enter styles, one per line (e.g., concise,\nwitty)"
          className={`${inputClassName} resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (styleAllInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="styleChat"
          className="block text-sm font-medium  mb-1"
        >
          Style: Chat (comma-separated, one per line)
        </label>
        <Textarea
          id="styleChat"
          name="styleChat"
          value={styleChatInput}
          onChange={(e) => handleArrayInputChange(e, "styleChat")}
          placeholder="Enter chat styles, one per line (e.g., playful,\ndynamic)"
          className={`${inputClassName} resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (styleChatInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="stylePost"
          className="block text-sm font-medium  mb-1"
        >
          Style: Post (comma-separated, one per line)
        </label>
        <Textarea
          id="stylePost"
          name="stylePost"
          value={stylePostInput}
          onChange={(e) => handleArrayInputChange(e, "stylePost")}
          placeholder="Enter post styles, one per line (e.g., ironic,\nrelevant)"
          className={`${inputClassName} resize-none overflow-y-auto leading-6`}
          style={{
            minHeight: '120px',
            maxHeight: '288px',
            height: `${Math.min(
              288,
              Math.max(120, (stylePostInput.split('\n').length + 2) * 24)
            )}px`,
            paddingBottom: '3rem',
          }}
        />
      </div>
      <div>
        <label
          htmlFor="modelProvider"
          className="block text-sm font-medium  mb-1"
        >
          Model Provider
        </label>
        <select
          id="modelProvider"
          name="modelProvider"
          value={characterData.modelProvider}
          onChange={handleInputChange}
          className={`${inputClassName} w-full p-2`}
        >
          <option value="OPENAI">OPENAI</option>
        </select>
      </div>
      <div>
        <label
          htmlFor="enableEmailPlugin"
          className="block text-sm font-medium  mb-1"
        >
          Enable Email Plugin
        </label>
        <input
          id="enableEmailPlugin"
          name="enableEmailPlugin"
          type="checkbox"
          checked={characterData.plugins.includes("email")}
          onChange={(e) => handleEmailCheckbox(e.target.checked)}
          className=""
        />
      </div>
      {characterData.plugins.includes("email") && (
        <>
          <div>
            <h4 className="text-sm font-medium  mb-2">
              Outgoing Email Settings
            </h4>
            <div className="ml-4 space-y-4">
              <div>
                <label
                  htmlFor="emailOutgoingService"
                  className="block text-sm font-medium  mb-1"
                >
                  Service
                </label>
                <select
                  id="emailOutgoingService"
                  name="emailOutgoingService"
                  value={characterData.settings.email.outgoing.service}
                  onChange={(e) =>
                    handleAdvancedInputChange(e, "settings", "email.outgoing.service")
                  }
                  className={`${inputClassName} w-full p-2`}
                >
                  <option value="gmail">Gmail</option>
                  <option value="smtp">SMTP</option>
                </select>
              </div>
              {characterData.settings.email.outgoing.service === "smtp" && (
                <>
                  <div>
                    <label
                      htmlFor="emailOutgoingHost"
                      className="block text-sm font-medium  mb-1"
                    >
                      Host
                    </label>
                    <Input
                      id="emailOutgoingHost"
                      name="emailOutgoingHost"
                      type="text"
                      value={characterData.settings.email.outgoing.host}
                      onChange={(e) =>
                        handleAdvancedInputChange(e, "settings", "email.outgoing.host")
                      }
                      placeholder="e.g., smtp.example.com"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="emailOutgoingPort"
                      className="block text-sm font-medium  mb-1"
                    >
                      Port
                    </label>
                    <Input
                      id="emailOutgoingPort"
                      name="emailOutgoingPort"
                      type="number"
                      value={characterData.settings.email.outgoing.port}
                      onChange={(e) =>
                        handleAdvancedInputChange(e, "settings", "email.outgoing.port")
                      }
                      placeholder="e.g., 587"
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="emailOutgoingSecure"
                      className="block text-sm font-medium  mb-1"
                    >
                      Secure (TLS)
                    </label>
                    <select
                      id="emailOutgoingSecure"
                      name="emailOutgoingSecure"
                      value={characterData.settings.email.outgoing.secure.toString()}
                      onChange={(e) =>
                        handleAdvancedInputChange(e, "settings", "email.outgoing.secure")
                      }
                      className={`${inputClassName} w-full p-2`}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </>
              )}
              <div>
                <label
                  htmlFor="emailOutgoingUser"
                  className="block text-sm font-medium  mb-1"
                >
                  Username
                </label>
                <Input
                  id="emailOutgoingUser"
                  name="emailOutgoingUser"
                  type="text"
                  value={emailOutgoingUser}
                  onChange={handleEmailOutgoingUserChange}
                  placeholder="e.g., your-email@gmail.com"
                  className={`${inputClassName} ${emailOutgoingUserError ? "border-red-500" : ""}`}
                  aria-invalid={emailOutgoingUserError ? "true" : "false"}
                  aria-describedby={emailOutgoingUserError ? "emailOutgoingUserError" : undefined}
                />
                {emailOutgoingUserError && (
                  <p id="emailOutgoingUserError" className="text-red-500 text-sm mt-1" role="alert">
                    {emailOutgoingUserError}
                  </p>
                )}
              </div>
              <div className="relative">
                <label
                  htmlFor="emailOutgoingPass"
                  className="block text-sm font-medium  mb-1"
                >
                  Password
                </label>
                <Input
                  id="emailOutgoingPass"
                  name="emailOutgoingPass"
                  type={showEmailOutgoingPass ? "text" : "password"}
                  value={emailOutgoingPass}
                  onChange={handleEmailOutgoingPassChange}
                  placeholder="e.g., your-app-password"
                  className={`${inputClassName} pr-10`}
                />
                <button
                  type="button"
                  onClick={toggleEmailOutgoingPassVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center "
                  aria-label={showEmailOutgoingPass ? "Hide password" : "Show password"}
                >
                  {showEmailOutgoingPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                {characterData.settings.email.outgoing.service === "gmail" && (
                  <p className="text-sm  mt-1">
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
                  </p>
                )}
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium  mb-2">
              Incoming Email Settings
            </h4>
            <div className="ml-4 space-y-4">
              <div>
                <label
                  htmlFor="emailIncomingHost"
                  className="block text-sm font-medium  mb-1"
                >
                  Host
                </label>
                <Input
                  id="emailIncomingHost"
                  name="emailIncomingHost"
                  type="text"
                  value={characterData.settings.email.incoming.host}
                  onChange={(e) =>
                    handleAdvancedInputChange(e, "settings", "email.incoming.host")
                  }
                  placeholder="e.g., imap.gmail.com"
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="emailIncomingPort"
                  className="block text-sm font-medium mb-1"
                >
                  Port
                </label>
                <Input
                  id="emailIncomingPort"
                  name="emailIncomingPort"
                  type="number"
                  value={characterData.settings.email.incoming.port}
                  onChange={(e) =>
                    handleAdvancedInputChange(e, "settings", "email.incoming.port")
                  }
                  placeholder="e.g., 993"
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="emailIncomingUser"
                  className="block text-sm font-medium  mb-1"
                >
                  Username
                </label>
                <Input
                  id="emailIncomingUser"
                  name="emailIncomingUser"
                  type="text"
                  value={emailIncomingUser}
                  onChange={handleEmailIncomingUserChange}
                  placeholder="e.g., your-email@gmail.com"
                  className={`${inputClassName} ${emailIncomingUserError ? "border-red-500" : ""}`}
                  aria-invalid={emailIncomingUserError ? "true" : "false"}
                  aria-describedby={emailIncomingUserError ? "emailIncomingUserError" : undefined}
                />
                {emailIncomingUserError && (
                  <p id="emailIncomingUserError" className="text-red-500 text-sm mt-1" role="alert">
                    {emailIncomingUserError}
                  </p>
                )}
              </div>
              <div className="relative">
                <label
                  htmlFor="emailIncomingPass"
                  className="block text-sm font-medium  mb-1"
                >
                  Password
                </label>
                <Input
                  id="emailIncomingPass"
                  name="emailIncomingPass"
                  type={showEmailIncomingPass ? "text" : "password"}
                  value={emailIncomingPass}
                  onChange={handleEmailIncomingPassChange}
                  placeholder="e.g., your-app-password"
                  className={`${inputClassName} pr-10`}
                />
                <button
                  type="button"
                  onClick={toggleEmailIncomingPassVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center  mt-6"
                  aria-label={showEmailIncomingPass ? "Hide password" : "Show password"}
                >
                  {showEmailIncomingPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <div>
        <label
          htmlFor="enableTelegramPlugin"
          className="block text-sm font-medium  mb-1"
        >
          Enable Telegram Plugin
        </label>
        <input
          id="enableTelegramPlugin"
          name="enableTelegramPlugin"
          type="checkbox"
          checked={characterData.plugins.includes("telegram")}
          onChange={(e) => handleTelegramCheckbox(e.target.checked)}
          className=""
        />
      </div>
      {characterData.plugins.includes("telegram") && (
        <div>
          <h4 className="text-sm font-medium  mb-2">
            Telegram Settings
          </h4>
          <div className="ml-4 space-y-4">
            <div>
              <label
                htmlFor="telegramBotToken"
                className="block text-sm font-medium  mb-1"
              >
                Telegram Bot Token
              </label>
              <Input
                id="telegramBotToken"
                name="telegramBotToken"
                type="text"
                value={telegramBotToken}
                onChange={handleTelegramBotTokenChange}
                placeholder="e.g., 123456789:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                className={inputClassName}
              />
            </div>
          </div>
        </div>
      )}
      {/* New Chipi Plugin Section */}
        <div>
          <label
            htmlFor="enableChipiPlugin"
            className="block text-sm font-medium mb-1"
          >
            Enable Chipi Plugin
          </label>
          <input
            id="enableChipiPlugin"
            name="enableChipiPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("chipi")}
            onChange={(e) => handleChipiCheckbox(e.target.checked)}
            className=""
          />
        </div>
         {/* New ZKProof Plugin Section */}
        <div>
          <label
            htmlFor="enableZKProofPlugin"
            className="block text-sm font-medium mb-1"
          >
            Enable ZKProof Plugin
          </label>
          <input
            id="enableZKProofPlugin"
            name="enableZKProofPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("zKproof")}
            onChange={(e) => handleZKProofCheckbox(e.target.checked)}
            className=""
          />
        </div>

      {/* <div>
          <label
            htmlFor="enableTwitterPlugin"
            className="block text-sm font-medium text-agentvooc-secondary mb-1"
          >
            Enable Twitter Plugin
          </label>
          <input
            id="enableTwitterPlugin"
            name="enableTwitterPlugin"
            type="checkbox"
            checked={characterData.plugins.includes("twitter")}
            onChange={(e) => handleTwitterCheckbox(e.target.checked)}
            className="text-agentvooc-accent focus:ring-agentvooc-accent rounded"
          />
        </div>
        {characterData.plugins.includes("twitter") && (
          <div>
            <h4 className="text-sm font-medium text-agentvooc-secondary mb-2">
              Twitter Settings
            </h4>
            <div className="ml-4 space-y-4">
              <div>
                <label
                  htmlFor="twitterUsername"
                  className="block text-sm font-medium text-agentvooc-secondary mb-1"
                >
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
                />
              </div>
              <div>
                <label
                  htmlFor="twitterPassword"
                  className="block text-sm font-medium text-agentvooc-secondary mb-1"
                >
                  Twitter Password
                </label>
                <Input
                  id="twitterPassword"
                  name="twitterPassword"
                  type="password"
                  value={twitterPassword}
                  onChange={handleTwitterPasswordChange}
                  placeholder="Enter your Twitter password"
                  className="text-agentvooc-primary bg-agentvooc-secondary-accent border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="twitterEmail"
                  className="block text-sm font-medium text-agentvooc-secondary mb-1"
                >
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
                />
              </div>
            </div>
          </div>
        )} */}
        {/* <div>
          <label
            htmlFor="voiceModel"
            className="block text-sm font-medium text-agentvooc-secondary mb-1"
          >
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
          />
        </div> */}
      <div>
        <label
          htmlFor="ragKnowledge"
          className="block text-sm font-medium  mb-1"
        >
          Enable RAG Knowledge
        </label>
        <select
          id="ragKnowledge"
          name="ragKnowledge"
          value={characterData.settings.ragKnowledge.toString()}
          onChange={(e) => handleAdvancedInputChange(e, "settings", "ragKnowledge")}
          className={`${inputClassName} w-full p-2`}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
      <div className="flex gap-4">
        <Button
          type="submit"
          className="rounded-lg px-6 py-2"
          disabled={createCharacterMutation.isPending || uploadImageMutation.isPending || isCreating}
        >
          {isCreating ? (
            <>
              <Loader2 className=" mr-2 h-4 w-4 animate-spin" />
              Your character is being Created
            </>
          ) : (
            "Create Character"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          className="border-agentvooc-accent/50  hover:bg-agentvooc-accent hover:-bg rounded-lg px-6 py-2"
          disabled={isCreating}
        >
          Cancel
        </Button>
      </div>
    </form>
  </div>
);
}