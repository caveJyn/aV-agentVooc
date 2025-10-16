import { createClient } from "@sanity/client";
import { Character, elizaLogger, stringToUuid } from "@elizaos/core";

export async function fetchCharacterById(agentId: string): Promise<Character | null> {
  const callId = stringToUuid(`sanity-fetch-character-${Date.now()}`);
  elizaLogger.debug(`[SHARED-SANITY] Starting fetchCharacterById for agentId: ${agentId}, callId: ${callId}`);

  try {
    const client = createClient({
      projectId: process.env.SANITY_PROJECT_ID,
      dataset: process.env.SANITY_DATASET,
      apiVersion: process.env.SANITY_API_VERSION,
      useCdn: false,
      token: process.env.SANITY_API_TOKEN,
    });

    const query = `*[_type == "character" && enabled == true && id == $agentId][0] {
      _id,
      id,
      name,
      username,
      system,
      modelProvider,
      bio,
      lore,
      messageExamples[] {
        messages[] {
          user,
          content { text, action }
        }
      },
      postExamples,
      topics,
      adjectives,
      style { all, chat, post },
      settings {
        secrets { dynamic[] { key, encryptedValue { iv, ciphertext }, hash } },
        voice { model },
        ragKnowledge,
        email { outgoing { service, host, port, secure, user, pass }, incoming { service, host, port, user, pass } }
      },
      knowledge,
      templates { messageHandlerTemplate },
      profile,
      createdBy-> {
        _id,
        name,
        email,
        userId
      }
    }`;

    const sanityChar = await client.fetch(query, { agentId });
    if (!sanityChar) {
      elizaLogger.warn(`[SHARED-SANITY] No character found for agentId: ${agentId}`);
      return null;
    }



    const knowledge = (sanityChar.knowledge || []).map((item: any) => {
      if (item._type === "directoryItem") {
        if (!item.directory) {
          elizaLogger.warn(`[SHARED-SANITY] Invalid directory item for ${sanityChar.name}: missing directory field`, item);
          return null;
        }
        return {
          type: "directory",
          directory: item.directory,
          shared: Boolean(item.shared ?? false),
        };
      } else if (item._type === "reference") {
        return {
          type: "reference",
          _ref: item._ref,
          _id: item._id,
        };
      }
      elizaLogger.warn(`[SHARED-SANITY] Unknown knowledge item type ${item?._type} for ${sanityChar.name}`, item);
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    const hardcodedKnowledge = [
      {
        type: "directory",
        directory: "shared",
        shared: true,
      },
      {
        type: "directory",
        directory: sanityChar.name.toLowerCase(),
        shared: false,
      },
    ];

    const combinedKnowledge = [
      ...knowledge,
      ...hardcodedKnowledge.filter(
        (hk) => !knowledge.some((k) => k.type === "directory" && k.directory === hk.directory)
      ),
    ];

    let messageExamples: any[] = [];
    if (sanityChar.messageExamples && Array.isArray(sanityChar.messageExamples)) {
      if (sanityChar.messageExamples.every((ex: any) => ex.messages && Array.isArray(ex.messages))) {
        messageExamples = sanityChar.messageExamples.map((ex: any) =>
          (ex.messages || []).map((msg: any) => ({
            user: typeof msg.user === 'string' ? msg.user : '',
            content: {
              text: typeof msg.content?.text === 'string' ? msg.content.text : '',
              action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
            },
          }))
        );
      } else if (sanityChar.messageExamples.every((ex: any) => ex.user && ex.content)) {
        messageExamples = [
          sanityChar.messageExamples.map((msg: any) => ({
            user: typeof msg.user === 'string' ? msg.user : '',
            content: {
              text: typeof msg.content?.text === 'string' ? msg.content.text : '',
              action: typeof msg.content?.action === 'string' ? msg.content.action : undefined,
            },
          }))
        ];
      }
    }

    const character: Character = {
      id: sanityChar.id,
      name: sanityChar.name,
      username: sanityChar.username,
      system: sanityChar.system,
      modelProvider: sanityChar.modelProvider?.toLowerCase() || "openai",
      plugins: sanityChar.plugins || [],
      bio: sanityChar.bio || [],
      lore: sanityChar.lore || [],
      messageExamples,
      postExamples: sanityChar.postExamples || [],
      topics: sanityChar.topics || [],
      adjectives: sanityChar.adjectives || [],
      style: {
        all: sanityChar.style?.all || [],
        chat: sanityChar.style?.chat || [],
        post: sanityChar.style?.post || [],
      },
      settings: {
        voice: sanityChar.settings?.voice ? { model: sanityChar.settings.voice.model } : undefined,
        ragKnowledge: sanityChar.settings?.ragKnowledge ?? true,
        email: sanityChar.settings?.email || { outgoing: {}, incoming: {} },
      },
      knowledge: combinedKnowledge,
      templates: {
        messageHandlerTemplate: sanityChar.templates?.messageHandlerTemplate,
      },
      profile: sanityChar.profile?.image ? { image: sanityChar.profile.image } : undefined,
      createdBy: {
        _id: sanityChar.createdBy?._id,
        name: sanityChar.createdBy?.name,
        email: sanityChar.createdBy?.email,
        userId: sanityChar.createdBy?.userId,
      },
    };

    elizaLogger.debug(`[SHARED-SANITY] Fetched character ${sanityChar.name} for agentId: ${agentId}`);
    return character;
  } catch (error: any) {
    elizaLogger.error(`[SHARED-SANITY] Failed to fetch character for agentId: ${agentId}`, { error: error.message });
    return null;
  }
}