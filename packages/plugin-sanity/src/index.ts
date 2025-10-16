import { createClient } from "@sanity/client";
import {
  Character,
  ModelProviderName,
  Plugin,
  elizaLogger,
  stringToUuid,
  type RAGKnowledgeItem,
  type UUID,
  type Secret
} from "@elizaos/core";
import "dotenv/config";
import { join, resolve } from "path";
import imageUrlBuilder from "@sanity/image-url";

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID ,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

export interface SanityKnowledgeQuery {
  projectId?: string;
  dataset?: string;
  query?: string;
  agentId: UUID;
}

// Create urlFor function for image URLs
const builder = imageUrlBuilder(sanityClient);
export function urlFor(source: any) {
  return builder.image(source);
}

export async function loadSanityKnowledge(params: SanityKnowledgeQuery): Promise<RAGKnowledgeItem[]> {
  const { projectId, dataset, query, agentId } = params;
  try {
    const effectiveProjectId = projectId || process.env.SANITY_PROJECT_ID ;
    const effectiveDataset = dataset || process.env.SANITY_DATASET;
    const effectiveQuery = query || `*[_type == "knowledge" && agentId == "${agentId}"]`;

    const client = createClient({
      projectId: effectiveProjectId,
      dataset: effectiveDataset,
      apiVersion: process.env.SANITY_API_VERSION || "2023-05-03",
      useCdn: false,
      token: process.env.SANITY_API_TOKEN,
    });

    const knowledgeDocs = await client.fetch(effectiveQuery);
    if (knowledgeDocs.length === 0) {
      elizaLogger.warn(`[SANITY] No knowledge items found for agentId ${agentId}.`);
    }

    const knowledgeItems: RAGKnowledgeItem[] = knowledgeDocs.flatMap((doc: any) => {
      let id = doc.id || stringToUuid(`sanity-${doc._id}`);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        elizaLogger.error(`[SANITY] Non-UUID id "${id}" detected in knowledge document _id: ${doc._id}. Generating new UUID.`);
        id = stringToUuid(`sanity-${doc._id}`);
      }
      const text = doc.text || "";
      const metadata = doc.metadata || {};

      const items: RAGKnowledgeItem[] = [];

      // Handle standard knowledge document
      items.push({
        id,
        agentId: doc.agentId || agentId,
        content: {
          text,
          metadata: {
            isMain: metadata.isMain || false,
            isChunk: metadata.isChunk || false,
            originalId: metadata.originalId || undefined,
            chunkIndex: metadata.chunkIndex || undefined,
            source: metadata.source || "sanity",
            type: metadata.type || "text",
            isShared: false,
            category: metadata.category || "",
            customFields: metadata.customFields || [],
          },
        },
        embedding: doc.embedding ? new Float32Array(doc.embedding) : undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
      });

      // Handle images in metadata.images
      if (metadata.type === "image-collection" && metadata.images?.length > 0) {
        metadata.images.forEach((image: any, index: number) => {
          const imageId = stringToUuid(`image-${doc._id}-${index}`);
          items.push({
            id: imageId,
            agentId: doc.agentId || agentId,
            content: {
              text: image.caption || "",
              metadata: {
                isMain: false,
                isChunk: false,
                source: "image-upload",
                type: "image",
                imageAssetId: image.imageAssetId,
                imageUrl: image.imageUrl,
                createdAt: image.createdAt,
                customFields: [],
              },
            },
            createdAt: image.createdAt ? new Date(image.createdAt).getTime() : Date.now(),
          });
        });
      }

      return items;
    });

    elizaLogger.debug(`[SANITY] Loaded ${knowledgeItems.length} knowledge items for agent ${agentId} from Sanity`);
    return knowledgeItems;
  } catch (error) {
    elizaLogger.error(`[SANITY] Failed to load Sanity knowledge for agent ${agentId}:`, error);
    return [];
  }
}

export async function loadEnabledSanityCharacters(): Promise<Character[]> {
  const callId = stringToUuid(`sanity-load-${Date.now()}`);
  elizaLogger.debug(`[SANITY] Starting loadEnabledSanityCharacters, callId: ${callId}`);

  try {
    const query = `*[_type == "character" && enabled == true] {
      _id,
      id,
      name,
      username,
      system,
      modelProvider,
      plugins,
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
    const sanityCharacters = await sanityClient.fetch(query);
    elizaLogger.debug(`[SANITY] Raw Sanity characters:`, {
      count: sanityCharacters.length,
      characters: sanityCharacters.map((c: any) => ({
        id: c.id,
        name: c.name,
        createdBy: c.createdBy?.userId,
      })),
    });

    const characters: Character[] = await Promise.all(
      sanityCharacters.map(async (sanityChar: any) => {
        // Validate createdBy
        if (!sanityChar.createdBy?._id || !sanityChar.createdBy?.userId) {
          elizaLogger.warn(`[SANITY] Character ${sanityChar.name} is missing createdBy._id or createdBy.userId`);
          return null;
        }

        // Process plugins
        const pluginPromises = (sanityChar.plugins || []).map(
          async (plugin: any): Promise<Plugin | undefined> => {
            let pluginName: string | undefined;
              let pluginConfig: any = {};
            try {
              
              if (typeof plugin === "string") {
                pluginName = plugin;
              } else if (typeof plugin === "object" && plugin?.name) {
                pluginName = plugin.name;
                pluginConfig = plugin;
              } else {
                elizaLogger.warn(`[SANITY] Invalid plugin format for ${sanityChar.name}:`, plugin);
                return undefined;
              }

              let pluginModule;
              switch (pluginName) {
                case "telegram":
                  pluginModule = await import("@elizaos-plugins/client-telegram");
                  elizaLogger.debug(`[SANITY] Telegram plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "telegram",
                    description: pluginConfig.description || "Telegram client plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                  };
                case "instagram":
                  pluginModule = await import("@elizaos-plugins/client-instagram");
                  elizaLogger.debug(`[SANITY] Instagram plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "instagram",
                    description: pluginConfig.description || "Instagram client plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                  };
                case "twitter":
                  pluginModule = await import("@elizaos-plugins/plugin-twitter");
                  elizaLogger.debug(`[SANITY] Twitter plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "twitter",
                    description: pluginConfig.description || "Twitter plugin",
                    actions: pluginConfig.actions || pluginModule.default?.actions || [],
                    services: pluginModule.default?.services || [],
                  };
                case "email":
                  elizaLogger.debug(`[SANITY] Attempting to import @elizaos-plugins/plugin-email for ${sanityChar.name}`);
                  pluginModule = await import("@elizaos-plugins/plugin-email");
                  elizaLogger.debug(`[SANITY] Email plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "email",
                    description: pluginConfig.description || "Email client plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                    actions: pluginConfig.actions || pluginModule.default?.actions || [],
                  };
                  case "chipi":
                  elizaLogger.debug(`[SANITY] Attempting to import @elizaos-plugins/plugin-chipi for ${sanityChar.name}`);
                  pluginModule = await import("@elizaos-plugins/plugin-chipi");
                  elizaLogger.debug(`[SANITY] Chipi plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "chipi",
                    description: pluginConfig.description || "Chipi plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                    actions: pluginConfig.actions || pluginModule.default?.actions || [],
                  };
                  case "chipiclient":
                  elizaLogger.debug(`[SANITY] Attempting to import @elizaos-plugins/plugin-chipi-client for ${sanityChar.name}`);
                  pluginModule = await import("@elizaos-plugins/plugin-chipi-client");
                  elizaLogger.debug(`[SANITY] Chipi Client plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "chipiclient",
                    description: pluginConfig.description || "Chipi Client plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                    actions: pluginConfig.actions || pluginModule.default?.actions || [],
                  };
                  case "zKproof":
                  elizaLogger.debug(`[SANITY] Attempting to import @elizaos-plugins/plugin-zKproof for ${sanityChar.name}`);
                  pluginModule = await import("@elizaos-plugins/plugin-zkproof");
                  elizaLogger.debug(`[SANITY] ZK Proof plugin module:`, Object.keys(pluginModule));
                  return {
                    name: "zKproof",
                    description: pluginConfig.description || "ZK Proof plugin",
                    clients: pluginConfig.clients || pluginModule.default?.clients || [],
                    actions: pluginConfig.actions || pluginModule.default?.actions || [],
                  };
                default:
                  elizaLogger.warn(`[SANITY] Unknown plugin for ${sanityChar.name}: ${pluginName}`);
                  return undefined;
              }
            } catch (error) {
  elizaLogger.error(`[SANITY] Failed to import plugin for ${sanityChar.name}:`, {
    message: error.message,
    stack: error.stack,
    plugin: pluginName
  });
  return undefined;
}
          }
        );

        const mappedPlugins: Plugin[] = (await Promise.all(pluginPromises)).filter(
          (plugin): plugin is Plugin => plugin !== undefined
        );

        if (!sanityChar.id) {
          elizaLogger.error(`[SANITY] Character ${sanityChar.name} missing id field`);
          return null;
        }
        const characterId = sanityChar.id;

         // Map secretsDynamic directly from settings.secrets.dynamic
        const secretsDynamic = (sanityChar.settings?.secrets?.dynamic || []).map(
          (item: any): Secret => ({
            key: item.key,
            encryptedValue: item.encryptedValue
              ? { iv: item.encryptedValue.iv, ciphertext: item.encryptedValue.ciphertext }
              : undefined,
            hash: item.hash,
          })
        );

        // Do not populate secrets with plain values; let startAgent handle decryption
        const secrets: { [key: string]: string } = {};

        // Validate required credentials for plugins
const requiredSecrets: { [plugin: string]: string[] } = {
  twitter: ["TWITTER_USERNAME", "TWITTER_PASSWORD", "TWITTER_EMAIL"],
  telegram: ["TELEGRAM_BOT_TOKEN"],
  instagram: ["INSTAGRAM_USERNAME", "INSTAGRAM_PASSWORD", "INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
  email: ["EMAIL_OUTGOING_USER", "EMAIL_OUTGOING_PASS"]
};
for (const plugin of mappedPlugins) {
  const neededKeys = requiredSecrets[plugin.name];
  if (neededKeys) {
    for (const key of neededKeys) {
      if (!secretsDynamic.find((s: Secret) => s.key === key)) {
        elizaLogger.warn(
          `[SANITY] Missing secret ${key} for plugin ${plugin.name} in character ${sanityChar.name}`
        );
      }
    }
  }
}

        // Process and augment knowledge field with hardcoded directories
        const knowledge = (sanityChar.knowledge || []).map((item: any) => {
          if (item._type === "directoryItem") {
            if (!item.directory) {
              elizaLogger.warn(`[SANITY] Invalid directory item for ${sanityChar.name}: missing directory field`, item);
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
          } else {
            elizaLogger.warn(`[SANITY] Unknown knowledge item type ${item?._type} for ${sanityChar.name}`, item);
            return null;
          }
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        // Add hardcoded directory knowledge
        const hardcodedKnowledge = [
          {
            type: "directory",
            directory: "shared",
            shared: true,
          },
          {
            type: "directory",
            directory: sanityChar.name.toLowerCase(), // Agent-specific directory based on name
            shared: false,
          },
        ];

        // Combine and deduplicate knowledge entries (avoid duplicate directories)
        const combinedKnowledge = [
          ...knowledge,
          ...hardcodedKnowledge.filter(
            (hk) => !knowledge.some((k) => k.type === "directory" && k.directory === hk.directory)
          ),
        ];

        elizaLogger.debug(`[SANITY] Knowledge for ${sanityChar.name}:`, combinedKnowledge);

        const validModelProviders = ["OPENAI", "OLLAMA", "CUSTOM"];
        const modelProvider = validModelProviders.includes(sanityChar.modelProvider)
          ? sanityChar.modelProvider.toLowerCase()
          : ModelProviderName.OPENAI;

        // Process profile image URL
        const profileImage = sanityChar.profile?.image
          ? urlFor(sanityChar.profile.image).url()
          : undefined;

           // Transform messageExamples, handling both correct and incorrect formats
        let messageExamples: any[] = [];
        if (sanityChar.messageExamples && Array.isArray(sanityChar.messageExamples)) {
          if (sanityChar.messageExamples.every((ex: any) => ex.messages && Array.isArray(ex.messages))) {
            // Correct format: [{ messages: [...] }, ...]
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
            // Incorrect format: [{user, content}, ...]
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
        elizaLogger.debug(`[SANITY] Transformed messageExamples for ${sanityChar.name}:`, messageExamples);

        const character: Character = {
          id: characterId,
          name: sanityChar.name,
          username: sanityChar.username,
          system: sanityChar.system,
          modelProvider: modelProvider as ModelProviderName,
          plugins: mappedPlugins,
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
            secrets,
            secretsDynamic: secretsDynamic,
            voice: sanityChar.settings?.voice ? { model: sanityChar.settings.voice.model } : undefined,
            ragKnowledge: sanityChar.settings?.ragKnowledge ?? true,
            email: sanityChar.settings?.email || { outgoing: {}, incoming: {} },
          },
          knowledge: combinedKnowledge, // Fixed: Use combinedKnowledge instead of sanityChar.knowledge
          templates: {
            messageHandlerTemplate: sanityChar.templates?.messageHandlerTemplate,
          },
          profile: profileImage ? { image: profileImage } : undefined,
          createdBy: {
            _id: sanityChar.createdBy._id,
            name: sanityChar.createdBy.name,
            email: sanityChar.createdBy.email,
            userId: sanityChar.createdBy.userId,
          },
        };

        elizaLogger.debug(
          `[SANITY] Mapped character ${sanityChar.name} with ${combinedKnowledge.length} knowledge items for user ${sanityChar.createdBy.userId}`
        );
        return character;
      })
    );

    const validCharacters = characters.filter((char): char is Character => char !== null);
    elizaLogger.debug(`[SANITY] Loaded ${validCharacters.length} characters from Sanity`);
    return validCharacters;
  } catch (error) {
    elizaLogger.error("[SANITY] Failed to fetch characters:", error);
    return [];
  }
}

export default {
  name: "sanity",
  description: "Sanity plugin for fetching character data and knowledge",
  providers: [
    {
      name: "sanityCharacters",
      description: "Provides enabled characters from Sanity",
      handler: loadEnabledSanityCharacters,
    },
    {
      name: "sanityKnowledge",
      description: "Provides knowledge items from Sanity",
      handler: loadSanityKnowledge,
    },
  ],
};