// /home/cave/projects/bots/venv/elizaOS_env/projectVersions/eliza-mainn/client/src/components/CreateCharacter.tsx
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { UUID } from "@elizaos/core";
import { UseQueryResult } from "@tanstack/react-query";

interface CreateCharacterProps {
  toggleForm: () => void;
  agentsQuery: UseQueryResult<any, unknown>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export default function CreateCharacter({
  toggleForm,
  agentsQuery,
  setError,
}: CreateCharacterProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
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
    modelProvider: "OPENAI" as "OPENAI" | "OLLAMA" | "CUSTOM" | undefined,
    plugins: [] as string[],
    settings: {
      secrets: {} as { [key: string]: string },
      voice: { model: "" },
      ragKnowledge: false,
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
  const [topicsInput, setTopicsInput] = useState("");
  const [adjectivesInput, setAdjectivesInput] = useState("");
  const [postExamplesInput, setPostExamplesInput] = useState("");

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
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
        return {
          ...prev,
          settings: {
            ...prev.settings,
            [subfield]: subfield === "ragKnowledge" ? value === "true" : value,
          },
        };
      }
      if (field === "style" && subfield) {
        return {
          ...prev,
          style: {
            ...prev.style,
            [subfield]: value.split(",").map((s) => s.trim()),
          },
        };
      }
      if (field === "plugins") {
        return {
          ...prev,
          plugins: value.split(",").map((s) => s.trim()),
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleCreateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createCharacter({
        ...characterData,
        bio: bioInput ? bioInput.split(",").map((s) => s.trim()) : [],
        lore: loreInput ? loreInput.split(",").map((s) => s.trim()) : [],
        topics: topicsInput ? topicsInput.split(",").map((s) => s.trim()) : [],
        adjectives: adjectivesInput
          ? adjectivesInput.split(",").map((s) => s.trim())
          : [],
        postExamples: postExamplesInput
          ? postExamplesInput.split(",").map((s) => s.trim())
          : [],
        username: characterData.username || undefined,
        modelProvider: characterData.modelProvider || "OPENAI",
        plugins: characterData.plugins || [],
        knowledge: characterData.knowledge || [],
        messageExamples: characterData.messageExamples || [],
      });
      console.log(`Character created with id: ${characterData.id}`);
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
        modelProvider: "OPENAI" as "OPENAI" | "OLLAMA" | "CUSTOM" | undefined,
        plugins: [],
        settings: {
          secrets: {},
          voice: { model: "" },
          ragKnowledge: false,
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
      setTopicsInput("");
      setAdjectivesInput("");
      setPostExamplesInput("");
      agentsQuery.refetch();
      setError(null);
      toggleForm();
    } catch (err: any) {
      setError(err.message || "Failed to create character");
      console.error("Error creating character:", err.message);
    }
  };

  return (
    <div className="border rounded p-4 bg-white">
      <h3 className="text-lg font-semibold mb-4">Create New Character</h3>
      <form onSubmit={handleCreateCharacter}>
        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Character Name (Required)
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={characterData.name}
            onChange={handleInputChange}
            placeholder="Enter character name (e.g., Eliza)"
            required
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={characterData.username}
            onChange={handleInputChange}
            placeholder="Enter username (e.g., eliza)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="system"
            className="block text-sm font-medium text-gray-700"
          >
            System Prompt
          </label>
          <Textarea
            id="system"
            name="system"
            value={characterData.system}
            onChange={handleInputChange}
            placeholder="Enter system prompt (e.g., Roleplay as a Web3 developer)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="bio"
            className="block text-sm font-medium text-gray-700"
          >
            Bio (comma-separated)
          </label>
          <input
            id="bio"
            name="bio"
            type="text"
            value={bioInput}
            onChange={(e) => handleArrayInputChange(e, "bio")}
            placeholder="Enter bio statements (e.g., Web3 developer, Security-minded)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="lore"
            className="block text-sm font-medium text-gray-700"
          >
            Lore (comma-separated)
          </label>
          <input
            id="lore"
            name="lore"
            type="text"
            value={loreInput}
            onChange={(e) => handleArrayInputChange(e, "lore")}
            placeholder="Enter lore snippets (e.g., Started in Web2, Contributes to Ethereum)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="topics"
            className="block text-sm font-medium text-gray-700"
          >
            Topics (comma-separated)
          </label>
          <input
            id="topics"
            name="topics"
            type="text"
            value={topicsInput}
            onChange={(e) => handleArrayInputChange(e, "topics")}
            placeholder="Enter topics (e.g., Web3, Blockchain)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="adjectives"
            className="block text-sm font-medium text-gray-700"
          >
            Adjectives (comma-separated)
          </label>
          <input
            id="adjectives"
            name="adjectives"
            type="text"
            value={adjectivesInput}
            onChange={(e) => handleArrayInputChange(e, "adjectives")}
            placeholder="Enter adjectives (e.g., witty, technical)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <label
            htmlFor="postExamples"
            className="block text-sm font-medium text-gray-700"
          >
            Post Examples (comma-separated)
          </label>
          <input
            id="postExamples"
            name="postExamples"
            type="text"
            value={postExamplesInput}
            onChange={(e) => handleArrayInputChange(e, "postExamples")}
            placeholder="Enter post examples (e.g., Debugged for 3 hours, Gas fees are forever)"
            className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center"
          >
            Advanced Settings{" "}
            {showAdvanced ? (
              <ChevronUp className="ml-2" />
            ) : (
              <ChevronDown className="ml-2" />
            )}
          </Button>
        </div>
        {showAdvanced && (
          <>
            <div className="mb-4">
              <label
                htmlFor="modelProvider"
                className="block text-sm font-medium text-gray-700"
              >
                Model Provider
              </label>
              <select
                id="modelProvider"
                name="modelProvider"
                value={characterData.modelProvider}
                onChange={(e) => handleAdvancedInputChange(e, "modelProvider")}
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              >
                <option value="OPENAI">OPENAI</option>
                <option value="OLLAMA">OLLAMA</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </div>
            <div className="mb-4">
              <label
                htmlFor="plugins"
                className="block text-sm font-medium text-gray-700"
              >
                Plugins (comma-separated)
              </label>
              <input
                id="plugins"
                name="plugins"
                type="text"
                value={characterData.plugins.join(",")}
                onChange={(e) => handleAdvancedInputChange(e, "plugins")}
                placeholder="Enter plugins (e.g., telegram, solana)"
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="voiceModel"
                className="block text-sm font-medium text-gray-700"
              >
                Voice Model
              </label>
              <input
                id="voiceModel"
                name="voiceModel"
                type="text"
                value={characterData.settings.voice.model}
                onChange={(e) => {
                  handleAdvancedInputChange(e, "settings", "voiceModel");
                  setCharacterData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      voice: { model: e.target.value },
                    },
                  }));
                }}
                placeholder="Enter voice model (e.g., en_US-hfc_female-medium)"
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="ragKnowledge"
                className="block text-sm font-medium text-gray-700"
              >
                Enable RAG Knowledge
              </label>
              <select
                id="ragKnowledge"
                name="ragKnowledge"
                value={characterData.settings.ragKnowledge.toString()}
                onChange={(e) =>
                  handleAdvancedInputChange(e, "settings", "ragKnowledge")
                }
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="mb-4">
              <label
                htmlFor="styleAll"
                className="block text-sm font-medium text-gray-700"
              >
                Style: All Contexts (comma-separated)
              </label>
              <input
                id="styleAll"
                name="styleAll"
                type="text"
                value={characterData.style.all.join(",")}
                onChange={(e) => handleAdvancedInputChange(e, "style", "all")}
                placeholder="Enter styles (e.g., concise, witty)"
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="styleChat"
                className="block text-sm font-medium text-gray-700"
              >
                Style: Chat (comma-separated)
              </label>
              <input
                id="styleChat"
                name="styleChat"
                type="text"
                value={characterData.style.chat.join(",")}
                onChange={(e) => handleAdvancedInputChange(e, "style", "chat")}
                placeholder="Enter chat styles (e.g., playful, dynamic)"
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
            <div className="mb-4">
              <label
                htmlFor="stylePost"
                className="block text-sm font-medium text-gray-700"
              >
                Style: Post (comma-separated)
              </label>
              <input
                id="stylePost"
                name="stylePost"
                type="text"
                value={characterData.style.post.join(",")}
                onChange={(e) => handleAdvancedInputChange(e, "style", "post")}
                placeholder="Enter post styles (e.g., ironic, relevant)"
                className="text-black mt-1 block w-full border border-gray-300 rounded-md p-2"
              />
            </div>
          </>
        )}
        <div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}