import { createClient } from "@sanity/client";
import {
  Character,
  ModelProviderName,
  Plugin,
  elizaLogger,
  stringToUuid,
  type RAGKnowledgeItem,
  type UUID,
} from "@elizaos/core";
import telegram from "@elizaos-plugins/client-telegram";
import solana from "@elizaos-plugins/plugin-solana";
import twitter from "@elizaos-plugins/plugin-twitter";
import "dotenv/config";
import { join, resolve } from "path";
import imageUrlBuilder from "@sanity/image-url";

export const sanityClient = createClient({
  projectId: process.env.SANITY_PROJECT_ID || "qtnhvmdn",
  dataset: process.env.SANITY_DATASET || "production",
  apiVersion: process.env.SANITY_API_VERSION || "2023-05-03",
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
    const effectiveProjectId = projectId || process.env.SANITY_PROJECT_ID || "xyz789abc";
    const effectiveDataset = dataset || process.env.SANITY_DATASET || "production";
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
      elizaLogger.warn(`No knowledge items found for agentId ${agentId}.`);
    }

    const knowledgeItems: RAGKnowledgeItem[] = knowledgeDocs.map((doc: any) => {
      let id = doc.id || stringToUuid(`sanity-${doc._id}`);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        elizaLogger.error(`Non-UUID id "${id}" detected in knowledge document _id: ${doc._id}. Generating new UUID.`);
        id = stringToUuid(`sanity-${doc._id}`);
      }
      const text = doc.text || "";
      const metadata = doc.metadata || {};
      return {
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
            isShared: metadata.isShared || false,
            category: metadata.category || "",
            customFields: metadata.customFields || [],
          },
        },
        embedding: doc.embedding ? new Float32Array(doc.embedding) : undefined,
        createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
      };
    });

    elizaLogger.info(`Loaded ${knowledgeItems.length} knowledge items for agent ${agentId} from Sanity`);
    return knowledgeItems;
  } catch (error) {
    elizaLogger.error(`Failed to load Sanity knowledge for agent ${agentId}:`, error);
    return [];
  }
}


export async function loadEnabledSanityCharacters(): Promise<Character[]> {
  const callId = stringToUuid(`sanity-load-${Date.now()}`);
  elizaLogger.debug(`[Sanity Load] Starting loadEnabledSanityCharacters, callId: ${callId}`);

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
        conversation[] {
          user,
          content { text, action }
        }
      },
      postExamples,
      topics,
      adjectives,
      style { all, chat, post },
      settings {
        secrets { dynamic[] { key, value } },
        voice { model },
        ragKnowledge
      },
      knowledge,
      templates { messageHandlerTemplate },
      profile,
      createdBy-> {
        _id,
        name,
        email
      }
    }`;
    const sanityCharacters = await sanityClient.fetch(query);
    elizaLogger.debug(`[Sanity Load] Raw Sanity characters:`, {
      count: sanityCharacters.length,
      characters: sanityCharacters.map((c: any) => ({ id: c.id, name: c.name, createdBy: c.createdBy })),
    });

    const projectRoot = process.cwd();
    const knowledgeRoot = join(projectRoot, "characters", "knowledge");
    const relativePath = "degennn";
    const resolvedPath = resolve(knowledgeRoot, relativePath);

    elizaLogger.info(`[Sanity] Project root: ${projectRoot}`);
    elizaLogger.info(`[Sanity] Knowledge root: ${knowledgeRoot}`);
    elizaLogger.info(`[Sanity] Relative path: ${relativePath}`);
    elizaLogger.info(`[Sanity] Resolved path: ${resolvedPath}`);

    const hardcodedDirectoryItem = {
      directory: relativePath,
      shared: false,
    };

    const characters: Character[] = await Promise.all(
      sanityCharacters.map(async (sanityChar: any) => {
        const pluginPromises = (sanityChar.plugins || []).map(async (plugin: any): Promise<Plugin | undefined> => {
          try {
            let pluginConfig: any = {};

            // Determine pluginName
            let pluginName: string;
            if (typeof plugin === 'string') {
              pluginName = plugin;
              elizaLogger.debug(`[Sanity Load] Processing string plugin for ${sanityChar.name}: ${pluginName}`);
            } else if (typeof plugin === 'object' && plugin?.name) {
              pluginName = plugin.name;
              pluginConfig = plugin;
              elizaLogger.debug(`[Sanity Load] Processing object plugin for ${sanityChar.name}:`, plugin);
            } else {
              elizaLogger.warn(`[Sanity Load] Invalid plugin format for ${sanityChar.name}:`, plugin);
              return undefined;
            }

            let pluginModule;
            switch (pluginName) {
              case 'telegram':
                pluginModule = await import('@elizaos-plugins/client-telegram');
                if (!pluginModule.default) {
                  elizaLogger.error(`[Sanity Load] Telegram plugin module is invalid for ${sanityChar.name}`);
                  return undefined;
                }
                elizaLogger.debug(`[Sanity Load] Telegram plugin loaded for ${sanityChar.name}:`, pluginModule.default);
                return {
                  name: 'telegram',
                  description: pluginConfig.description || 'Telegram client plugin',
                  clients: pluginConfig.clients || pluginModule.default?.clients || [],
                };
              case 'solana':
                pluginModule = await import('@elizaos-plugins/plugin-solana');
                if (!pluginModule.default) {
                  elizaLogger.error(`[Sanity Load] Solana plugin module is invalid for ${sanityChar.name}`);
                  return undefined;
                }
                return {
                  name: 'solana',
                  description: pluginConfig.description || 'Solana plugin',
                  actions: pluginConfig.actions || pluginModule.default?.actions || [],
                };
              case 'twitter':
                pluginModule = await import('@elizaos-plugins/plugin-twitter');
                if (!pluginModule.default) {
                  elizaLogger.error(`[Sanity Load] Twitter plugin module is invalid for ${sanityChar.name}`);
                  return undefined;
                }
                return {
                  name: 'twitter',
                  description: pluginConfig.description || 'Twitter plugin',
                  actions: pluginConfig.actions || pluginModule.default?.actions || [],
                };
                case 'email':
                pluginModule = await import('@elizaos-plugins/plugin-email');
                if (!pluginModule.default) {
                  elizaLogger.error(`[Sanity Load] Email plugin module is invalid for ${sanityChar.name}`);
                  return undefined;
                }
                return {
                  name: 'email',
                  description: pluginConfig.description || 'Email plugin',
                  actions: pluginConfig.actions || pluginModule.default?.actions || [],
                };
              default:
                elizaLogger.warn(`[Sanity Load] Unknown plugin for ${sanityChar.name}: ${pluginName}`);
                return undefined;
            }
          } catch (error) {
            elizaLogger.error(
              `[Sanity Load] Failed to import plugin for ${sanityChar.name}: ${JSON.stringify(plugin)}`,
              error
            );
            return undefined;
          }
        });

        const mappedPlugins: Plugin[] = (await Promise.all(pluginPromises)).filter(
          (plugin): plugin is Plugin => plugin !== undefined
        );

        if (!sanityChar.id) {
          elizaLogger.error(`Character ${sanityChar.name} missing id field in Sanity`);
          return null;
        }
        const characterId = sanityChar.id;

        const secrets = (sanityChar.settings?.secrets?.dynamic || []).reduce(
          (acc: { [key: string]: string }, item: { key: string; value: string }) => {
            acc[item.key] = item.value;
            return acc;
          },
          {}
        );

        const validModelProviders = ["OPENAI", "OLLAMA", "CUSTOM"];
        const modelProvider = validModelProviders.includes(sanityChar.modelProvider)
          ? sanityChar.modelProvider.toLowerCase()
          : ModelProviderName.OPENAI;

        const knowledgeItems = (sanityChar.knowledge || []).map((k: any) => {
          if (typeof k === "string") {
            return k;
          } else if (k.path) {
            return { path: k.path, shared: k.shared || false };
          }
          return k;
        });
        knowledgeItems.push(hardcodedDirectoryItem);

        const character: Character = {
          id: characterId,
          name: sanityChar.name,
          username: sanityChar.username,
          system: sanityChar.system,
          modelProvider: modelProvider as ModelProviderName,
          plugins: mappedPlugins,
          bio: sanityChar.bio || [],
          lore: sanityChar.lore || [],
          messageExamples: (sanityChar.messageExamples || []).map((ex: any) =>
            ex.conversation.map((msg: any) => ({
              user: msg.user,
              content: { text: msg.content.text, action: msg.content.action },
            }))
          ),
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
            voice: sanityChar.settings?.voice ? { model: sanityChar.settings.voice.model } : undefined,
            ragKnowledge: sanityChar.settings?.ragKnowledge ?? true,
          },
          knowledge: knowledgeItems,
          templates: {
            messageHandlerTemplate: sanityChar.templates?.messageHandlerTemplate,
          },
          createdBy: sanityChar.createdBy,
        };
        elizaLogger.debug(`[Sanity Load] Mapped plugins for ${sanityChar.name}:`, mappedPlugins);
        elizaLogger.info(`[Sanity Load] Mapped character ${sanityChar.name}:`, {
          id: character.id,
          createdBy: character.createdBy,
        });
        return character;
      })
    );

    const validCharacters = characters.filter((char): char is Character => char !== null);
    elizaLogger.info(`[Sanity Load] Loaded ${validCharacters.length} characters from Sanity`);
    return validCharacters;
  } catch (error) {
    elizaLogger.error("[Sanity Load] Failed to fetch characters from Sanity:", error);
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