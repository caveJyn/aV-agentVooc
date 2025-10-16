import { DirectClient } from "@elizaos/client-direct";
import {
    type Adapter,
    AgentRuntime,
    CacheManager,
    CacheStore,
    type Character,
    type ClientInstance,
    DbCacheAdapter,
    elizaLogger,
    FsCacheAdapter,
    type IAgentRuntime,
    type IDatabaseAdapter,
    type IDatabaseCacheAdapter,
    ModelProviderName,
    parseBooleanFromText,
    settings,
    stringToUuid,
    validateCharacterConfig,
    type Plugin,
    Service,
    ServiceType,
    UUID,
    type Secret,
    type DirectoryItem
} from "@elizaos/core";

import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { loadEnabledSanityCharacters } from "@elizaos-plugins/plugin-sanity";
import { loadSanityKnowledge } from "@elizaos-plugins/plugin-sanity";


import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import yargs from "yargs";
import chokidar from 'chokidar';
import pkg from 'lodash';
const { debounce } = pkg;
import { readFile } from 'fs/promises';
import  { decryptValue }  from "@elizaos/client-direct"

const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory


export const wait = (minTime = 1000, maxTime = 3000) => {
    const waitTime =
        Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
    return new Promise((resolve) => setTimeout(resolve, waitTime));
};

const logFetch = async (url: string, options: any) => {
    elizaLogger.debug(`Fetching ${url}`);
    // Disabled to avoid disclosure of sensitive information such as API keys
    // elizaLogger.debug(JSON.stringify(options, null, 2));
    return fetch(url, options);
};

export function parseArguments(): {
    character?: string;
    characters?: string;
} {
    try {
        return yargs(process.argv.slice(3))
            .option("character", {
                type: "string",
                description: "Path to the character JSON file",
            })
            .option("characters", {
                type: "string",
                description:
                    "Comma separated list of paths to character JSON files",
            })
            .parseSync();
    } catch (error) {
        elizaLogger.error("Error parsing arguments:", error);
        return {};
    }
}

function tryLoadFile(filePath: string): string | null {
    try {
        return fs.readFileSync(filePath, "utf8");
    } catch (e) {
        return null;
    }
}
function mergeCharacters(base: Character, child: Character): Character {
    const mergeObjects = (baseObj: any, childObj: any) => {
        const result: any = {};
        const keys = new Set([
            ...Object.keys(baseObj || {}),
            ...Object.keys(childObj || {}),
        ]);
        keys.forEach((key) => {
            if (
                typeof baseObj[key] === "object" &&
                typeof childObj[key] === "object" &&
                !Array.isArray(baseObj[key]) &&
                !Array.isArray(childObj[key])
            ) {
                result[key] = mergeObjects(baseObj[key], childObj[key]);
            } else if (
                Array.isArray(baseObj[key]) ||
                Array.isArray(childObj[key])
            ) {
                result[key] = [
                    ...(baseObj[key] || []),
                    ...(childObj[key] || []),
                ];
            } else {
                result[key] =
                    childObj[key] !== undefined ? childObj[key] : baseObj[key];
            }
        });
        return result;
    };
    return mergeObjects(base, child);
}
/* function isAllStrings(arr: unknown[]): boolean {
    return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}
export async function loadCharacterFromOnchain(): Promise<Character[]> {
    const jsonText = onchainJson;

    elizaLogger.debug("JSON:", jsonText);
    if (!jsonText) return [];
    const loadedCharacters = [];
    try {
        const character = JSON.parse(jsonText);
        validateCharacterConfig(character);

        // .id isn't really valid
        const characterId = character.id || character.name;
        const characterPrefix = `CHARACTER.${characterId
            .toUpperCase()
            .replace(/ /g, "_")}.`;

        const characterSettings = Object.entries(process.env)
            .filter(([key]) => key.startsWith(characterPrefix))
            .reduce((settings, [key, value]) => {
                const settingKey = key.slice(characterPrefix.length);
                settings[settingKey] = value;
                return settings;
            }, {});

        if (Object.keys(characterSettings).length > 0) {
            character.settings = character.settings || {};
            character.settings.secrets = {
                ...characterSettings,
                ...character.settings.secrets,
            };
        }

        // Handle plugins
        if (isAllStrings(character.plugins)) {
            elizaLogger.debug("Plugins are: ", character.plugins);
            const importedPlugins = await Promise.all(
                character.plugins.map(async (plugin) => {
                    const importedPlugin = await import(plugin);
                    return importedPlugin.default;
                })
            );
            character.plugins = importedPlugins;
        }

        loadedCharacters.push(character);
        elizaLogger.debug(
            `Successfully loaded character from: ${process.env.IQ_WALLET_ADDRESS}`
        );
        return loadedCharacters;
    } catch (e) {
        elizaLogger.error(
            `Error parsing character from ${process.env.IQ_WALLET_ADDRESS}: ${e}`
        );
        process.exit(1);
    }
} */

async function loadCharactersFromUrl(url: string): Promise<Character[]> {
    try {
        const response = await fetch(url);
        const responseJson = await response.json();

        let characters: Character[] = [];
        if (Array.isArray(responseJson)) {
            characters = await Promise.all(
                responseJson.map((character) => jsonToCharacter(url, character))
            );
        } else {
            const character = await jsonToCharacter(url, responseJson);
            characters.push(character);
        }
        return characters;
    } catch (e) {
        elizaLogger.error(`Error loading character(s) from ${url}: ${e}`);
        process.exit(1);
    }
}

async function jsonToCharacter(
    filePath: string,
    character: any
): Promise<Character> {
    validateCharacterConfig(character);

    // .id isn't really valid
    const characterId = character.id || character.name;
    const characterPrefix = `CHARACTER.${characterId
        .toUpperCase()
        .replace(/ /g, "_")}.`;
    const characterSettings = Object.entries(process.env)
        .filter(([key]) => key.startsWith(characterPrefix))
        .reduce((settings, [key, value]) => {
            const settingKey = key.slice(characterPrefix.length);
            return { ...settings, [settingKey]: value };
        }, {});
    if (Object.keys(characterSettings).length > 0) {
        character.settings = character.settings || {};
        character.settings.secrets = {
            ...characterSettings,
            ...character.settings.secrets,
        };
    }
    // Handle plugins
    character.plugins = await handlePluginImporting(character.plugins);
    if (character.extends) {
        elizaLogger.debug(
            `Merging  ${character.name} character with parent characters`
        );
        for (const extendPath of character.extends) {
            const baseCharacter = await loadCharacter(
                path.resolve(path.dirname(filePath), extendPath)
            );
            character = mergeCharacters(baseCharacter, character);
            elizaLogger.debug(
                `Merged ${character.name} with ${baseCharacter.name}`
            );
        }
    }
    return character;
}

async function loadCharacter(filePath: string): Promise<Character> {
    const content = tryLoadFile(filePath);
    if (!content) {
        throw new Error(`Character file not found: ${filePath}`);
    }
    const character = JSON.parse(content);
    return jsonToCharacter(filePath, character);
}

async function loadCharacterTryPath(characterPath: string): Promise<Character> {
    let content: string | null = null;
    let resolvedPath = "";

    // Try different path resolutions in order
    const pathsToTry = [
        characterPath, // exact path as specified
        path.resolve(process.cwd(), characterPath), // relative to cwd
        path.resolve(process.cwd(), "agent", characterPath), // Add this
        path.resolve(__dirname, characterPath), // relative to current script
        path.resolve(__dirname, "characters", path.basename(characterPath)), // relative to agent/characters
        path.resolve(__dirname, "../characters", path.basename(characterPath)), // relative to characters dir from agent
        path.resolve(
            __dirname,
            "../../characters",
            path.basename(characterPath)
        ), // relative to project root characters dir
    ];

    elizaLogger.debug(
        "Trying paths:",
        pathsToTry.map((p) => ({
            path: p,
            exists: fs.existsSync(p),
        }))
    );

    for (const tryPath of pathsToTry) {
        content = tryLoadFile(tryPath);
        if (content !== null) {
            resolvedPath = tryPath;
            break;
        }
    }

    if (content === null) {
        elizaLogger.error(
            `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
        elizaLogger.error("Tried the following paths:");
        pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
        throw new Error(
            `Error loading character from ${characterPath}: File not found in any of the expected locations`
        );
    }
    try {
        const character: Character = await loadCharacter(resolvedPath);
        elizaLogger.debug(`Successfully loaded character from: ${resolvedPath}`);
        return character;
    } catch (e) {
        elizaLogger.error(`Error parsing character from ${resolvedPath}: ${e}`);
        throw new Error(`Error parsing character from ${resolvedPath}: ${e}`);
    }
}

function commaSeparatedStringToArray(commaSeparated: string): string[] {
    return commaSeparated?.split(",").map((value) => value.trim());
}

async function readCharactersFromStorage(
    characterPaths: string[]
): Promise<string[]> {
    try {
        const uploadDir = path.join(process.cwd(), "data", "characters");
        await fs.promises.mkdir(uploadDir, { recursive: true });
        const fileNames = await fs.promises.readdir(uploadDir);
        fileNames.forEach((fileName) => {
            characterPaths.push(path.join(uploadDir, fileName));
        });
    } catch (err) {
        elizaLogger.error(`Error reading directory: ${err.message}`);
    }

    return characterPaths;
}

export async function loadCharacters(
    charactersArg: string | undefined
): Promise<Character[]> { // Adjusted type to match usage
    const loadedCharacters: Character[] = [];
  
    // elizaLogger.debug("loadCharacters starting with charactersArg:", charactersArg);
    // elizaLogger.debug("REMOTE_CHARACTER_URLS:", process.env.REMOTE_CHARACTER_URLS);
    // elizaLogger.debug("USE_CHARACTER_STORAGE:", process.env.USE_CHARACTER_STORAGE);
  
    // Handle CLI arguments (character paths)
    if (charactersArg) {
      elizaLogger.debug("Loading characters from CLI arguments");
      let characterPaths = commaSeparatedStringToArray(charactersArg);
  
      // Include characters from storage if enabled
      if (process.env.USE_CHARACTER_STORAGE === "true") {
        characterPaths = await readCharactersFromStorage(characterPaths);
      }
  
      // Load characters from specified paths
      if (characterPaths?.length > 0) {
        for (const characterPath of characterPaths) {
          try {
            const character: Character = await loadCharacterTryPath(characterPath);
            loadedCharacters.push(character);
            elizaLogger.debug(`Loaded character from path: ${character.name}`);
          } catch (e) {
            elizaLogger.error(`Failed to load character from ${characterPath}: ${e}`);
          }
        }
      }
    }
  
    // Load from remote URLs if provided and no CLI args
    if (!charactersArg && hasValidRemoteUrls()) {
      elizaLogger.debug("Loading characters from remote URLs");
      const characterUrls = commaSeparatedStringToArray(process.env.REMOTE_CHARACTER_URLS);
      for (const characterUrl of characterUrls) {
        try {
          const characters = await loadCharactersFromUrl(characterUrl);
          loadedCharacters.push(...characters);
          elizaLogger.debug(`Loaded ${characters.length} characters from ${characterUrl}`);
        } catch (e) {
          elizaLogger.error(`Failed to load characters from ${characterUrl}: ${e}`);
        }
      }
    }
  
    // Load from Sanity if no CLI args or remote URLs
    if (!charactersArg && !hasValidRemoteUrls()) {
      elizaLogger.debug("Fetching enabled characters from Sanity");
      try {
        const sanityCharacters = await loadEnabledSanityCharacters();
        loadedCharacters.push(...sanityCharacters);
        elizaLogger.debug(`Loaded ${sanityCharacters.length} characters from Sanity`);
      } catch (e) {
        elizaLogger.error(`Failed to load characters from Sanity: ${e}`);
      }
    }
  
    // Fallback to default character if none loaded
    if (loadedCharacters.length === 0) {
      elizaLogger.debug("No characters found, using default character");
      loadedCharacters.push();
    }
  
    elizaLogger.debug("Total characters loaded:", loadedCharacters.map(c => c.name));
    return loadedCharacters;
  }






// Define a type for constructable service classes
interface ServiceConstructor {
  new (): Service;
  getInstance?: () => Service;
    serviceType?: string; // Optional, to match TwitterService
}

async function initializeServices(character: Character, runtime: IAgentRuntime) {
  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      elizaLogger.debug(`Processing plugin: ${plugin.name}, services: ${plugin.services?.length}`);
      if (plugin.services && plugin.services.length > 0) {
        for (const serviceClass of plugin.services as unknown as ServiceConstructor[]) {
          elizaLogger.debug(`[DEBUG] Service class: ${serviceClass.name}, has getInstance: ${typeof serviceClass.getInstance === 'function'}`);
          const hasGetInstance = typeof serviceClass.getInstance === 'function';
          let serviceInstance: Service;
          if (hasGetInstance) {
            serviceInstance = serviceClass.getInstance();
          } else {
            serviceInstance = new serviceClass();
          }
          elizaLogger.debug(`[DEBUG] Service instance:`, serviceInstance, `instanceof Service: ${serviceInstance instanceof Service}, has initialize: ${typeof serviceInstance.initialize === 'function'}`);
          if (!(serviceInstance instanceof Service) || typeof serviceInstance.initialize !== 'function') {
            elizaLogger.error(`[AGENT] Service ${serviceClass.name} does not properly extend Service or lacks initialize method`);
            continue;
          }
          await serviceInstance.initialize(runtime);
          runtime.registerService(serviceInstance);
        }
      }
    }
  }
}



  async function handlePluginImporting(plugins: (string | Plugin)[]): Promise<Plugin[]> {
    if (plugins.length > 0) {
      elizaLogger.debug("Plugins to process:", plugins);
      const importedPlugins = await Promise.all(
        plugins.map(async (plugin) => {
          try {
            // If plugin is already a Plugin object, return it
            if (typeof plugin === "object" && plugin?.name) {
              elizaLogger.debug(`Using pre-mapped plugin: ${plugin.name}`);
              return plugin as Plugin;
            }
  
            // If plugin is a string, map to module path or import
            if (typeof plugin === "string") {
              let modulePath = plugin;
              // Map known plugin names to module paths
              const pluginModuleMap: { [key: string]: string } = {
                twitter: "@elizaos-plugins/plugin-twitter",
                telegram: "@elizaos-plugins/client-telegram",
                email: "@elizaos-plugins/plugin-email",

                // Add other plugins as needed
              };
              if (pluginModuleMap[plugin]) {
                modulePath = pluginModuleMap[plugin];
                elizaLogger.debug(`Mapped plugin name ${plugin} to module path ${modulePath}`);
              }
              const importedPlugin = await import(modulePath);
              const functionName = modulePath
                .replace("@elizaos/plugin-", "")
                .replace("@elizaos-plugins/plugin-", "")
                .replace("@elizaos-plugins/client-", "")
                .replace(/-./g, (x) => x[1].toUpperCase()) + "Plugin";
              const pluginInstance = importedPlugin.default || importedPlugin[functionName];
              if (!pluginInstance) {
                elizaLogger.error(`No valid plugin export found for ${modulePath}`);
                return null;
              }
              return pluginInstance as Plugin;
            }
  
            // Invalid plugin format
            elizaLogger.warn(`Invalid plugin format:`, plugin);
            return null;
          } catch (importError) {
            elizaLogger.error(`[AGENT] Failed to import plugin ${plugin}:`, {
              message: importError.message,
              stack: importError.stack,
            });
            return null;
          }
        })
      );
      return importedPlugins.filter((p): p is Plugin => p !== null);
    }
    return [];
  }

export function getTokenForProvider(
    provider: ModelProviderName,
    character: Character
): string | undefined {
    switch (provider) {
        // no key needed for llama_local, ollama, lmstudio, gaianet or bedrock
        case ModelProviderName.LLAMALOCAL:
            return "";
        case ModelProviderName.OLLAMA:
            return "";
        case ModelProviderName.LMSTUDIO:
            return "";
        case ModelProviderName.GAIANET:
            return (
                character.settings?.secrets?.GAIA_API_KEY ||
                settings.GAIA_API_KEY
            );
        case ModelProviderName.BEDROCK:
            return "";
        case ModelProviderName.OPENAI:
            return (
                character.settings?.secrets?.OPENAI_API_KEY ||
                settings.OPENAI_API_KEY
            );
        case ModelProviderName.ETERNALAI:
            return (
                character.settings?.secrets?.ETERNALAI_API_KEY ||
                settings.ETERNALAI_API_KEY
            );
        case ModelProviderName.NINETEEN_AI:
            return (
                character.settings?.secrets?.NINETEEN_AI_API_KEY ||
                settings.NINETEEN_AI_API_KEY
            );
        case ModelProviderName.LLAMACLOUD:
        case ModelProviderName.TOGETHER:
            return (
                character.settings?.secrets?.LLAMACLOUD_API_KEY ||
                settings.LLAMACLOUD_API_KEY ||
                character.settings?.secrets?.TOGETHER_API_KEY ||
                settings.TOGETHER_API_KEY ||
                character.settings?.secrets?.OPENAI_API_KEY ||
                settings.OPENAI_API_KEY
            );
        case ModelProviderName.CLAUDE_VERTEX:
        case ModelProviderName.ANTHROPIC:
            return (
                character.settings?.secrets?.ANTHROPIC_API_KEY ||
                character.settings?.secrets?.CLAUDE_API_KEY ||
                settings.ANTHROPIC_API_KEY ||
                settings.CLAUDE_API_KEY
            );
        case ModelProviderName.REDPILL:
            return (
                character.settings?.secrets?.REDPILL_API_KEY ||
                settings.REDPILL_API_KEY
            );
        case ModelProviderName.OPENROUTER:
            return (
                character.settings?.secrets?.OPENROUTER_API_KEY ||
                settings.OPENROUTER_API_KEY
            );
        case ModelProviderName.GROK:
            return (
                character.settings?.secrets?.GROK_API_KEY ||
                settings.GROK_API_KEY
            );
        case ModelProviderName.HEURIST:
            return (
                character.settings?.secrets?.HEURIST_API_KEY ||
                settings.HEURIST_API_KEY
            );
        case ModelProviderName.GROQ:
            return (
                character.settings?.secrets?.GROQ_API_KEY ||
                settings.GROQ_API_KEY
            );
        case ModelProviderName.GALADRIEL:
            return (
                character.settings?.secrets?.GALADRIEL_API_KEY ||
                settings.GALADRIEL_API_KEY
            );
        case ModelProviderName.FAL:
            return (
                character.settings?.secrets?.FAL_API_KEY || settings.FAL_API_KEY
            );
        case ModelProviderName.ALI_BAILIAN:
            return (
                character.settings?.secrets?.ALI_BAILIAN_API_KEY ||
                settings.ALI_BAILIAN_API_KEY
            );
        case ModelProviderName.VOLENGINE:
            return (
                character.settings?.secrets?.VOLENGINE_API_KEY ||
                settings.VOLENGINE_API_KEY
            );
        case ModelProviderName.NANOGPT:
            return (
                character.settings?.secrets?.NANOGPT_API_KEY ||
                settings.NANOGPT_API_KEY
            );
        case ModelProviderName.HYPERBOLIC:
            return (
                character.settings?.secrets?.HYPERBOLIC_API_KEY ||
                settings.HYPERBOLIC_API_KEY
            );

        case ModelProviderName.VENICE:
            return (
                character.settings?.secrets?.VENICE_API_KEY ||
                settings.VENICE_API_KEY
            );
        case ModelProviderName.ATOMA:
            return (
                character.settings?.secrets?.ATOMASDK_BEARER_AUTH ||
                settings.ATOMASDK_BEARER_AUTH
            );
        case ModelProviderName.NVIDIA:
            return (
                character.settings?.secrets?.NVIDIA_API_KEY ||
                settings.NVIDIA_API_KEY
            );
        case ModelProviderName.AKASH_CHAT_API:
            return (
                character.settings?.secrets?.AKASH_CHAT_API_KEY ||
                settings.AKASH_CHAT_API_KEY
            );
        case ModelProviderName.GOOGLE:
            return (
                character.settings?.secrets?.GOOGLE_GENERATIVE_AI_API_KEY ||
                settings.GOOGLE_GENERATIVE_AI_API_KEY
            );
        case ModelProviderName.MISTRAL:
            return (
                character.settings?.secrets?.MISTRAL_API_KEY ||
                settings.MISTRAL_API_KEY
            );
        case ModelProviderName.LETZAI:
            return (
                character.settings?.secrets?.LETZAI_API_KEY ||
                settings.LETZAI_API_KEY
            );
        case ModelProviderName.INFERA:
            return (
                character.settings?.secrets?.INFERA_API_KEY ||
                settings.INFERA_API_KEY
            );
        case ModelProviderName.DEEPSEEK:
            return (
                character.settings?.secrets?.DEEPSEEK_API_KEY ||
                settings.DEEPSEEK_API_KEY
            );
        case ModelProviderName.LIVEPEER:
            return (
                character.settings?.secrets?.LIVEPEER_GATEWAY_URL ||
                settings.LIVEPEER_GATEWAY_URL
            );
        case ModelProviderName.SECRETAI:
            return (
                character.settings?.secrets?.SECRET_AI_API_KEY ||
                settings.SECRET_AI_API_KEY
            );
        case ModelProviderName.NEARAI:
            try {
                const config = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.nearai/config.json'), 'utf8'));
                return JSON.stringify(config?.auth);
            } catch (e) {
                elizaLogger.warn(`Error loading NEAR AI config: ${e}`);
            }
            return (
                character.settings?.secrets?.NEARAI_API_KEY ||
                settings.NEARAI_API_KEY
            );

        default:
            const errorMessage = `Failed to get token - unsupported model provider: ${provider}`;
            elizaLogger.error(errorMessage);
            throw new Error(errorMessage);
    }
}

// also adds plugins from character file into the runtime
export async function initializeClients(
    character: Character,
    runtime: IAgentRuntime
) {
    // each client can only register once
    // and if we want two we can explicitly support it
    const clients: ClientInstance[] = [];
    // const clientTypes = clients.map((c) => c.name);
    // elizaLogger.log("initializeClients", clientTypes, "for", character.name);

    if (character.plugins?.length > 0) {
        for (const plugin of character.plugins) {
          if (plugin.clients && plugin.clients.length > 0) {
            for (const client of plugin.clients) {
              try {
                const startedClient = await client.start(runtime);
                elizaLogger.info(`Initializing client: ${client.name} for plugin: ${plugin.name}`);
                clients.push(startedClient);
              } catch (error) {
                elizaLogger.error(`Failed to initialize client ${client.name} for plugin ${plugin.name}:`, {
                    message: error.message,
                    stack: error.stack,
                    characterId: character.id,
                    characterName: character.name,
                });
              }
            }
          } else {
            elizaLogger.info(`[AGENT] No clients to initialize for plugin: ${plugin.name}`);
          }
        }
      } else {
        elizaLogger.info(`[AGENT] No plugins defined for character: ${character.name}`);
      }
      return clients;
    }

export async function createAgent(
    character: Character,
    token: string
): Promise<AgentRuntime> {
    elizaLogger.log(`Creating runtime for character ${character.name}`);
    return new AgentRuntime({
        token,
        modelProvider: character.modelProvider,
        evaluators: [],
        character,
        // character.plugins are handled when clients are added
        plugins: [
            bootstrapPlugin,
        ]
            .flat()
            .filter(Boolean),
        providers: [],
        managers: [],
        fetch: logFetch,
        // verifiableInferenceAdapter,
    });
}

function initializeFsCache(baseDir: string, character: Character) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cacheDir = path.resolve(baseDir, character.id, "cache");

    const cache = new CacheManager(new FsCacheAdapter(cacheDir));
    return cache;
}

function initializeDbCache(character: Character, db: IDatabaseCacheAdapter) {
    if (!character?.id) {
        throw new Error(
            "initializeFsCache requires id to be set in character definition"
        );
    }
    const cache = new CacheManager(new DbCacheAdapter(db, character.id));
    return cache;
}

function initializeCache(
    cacheStore: string,
    character: Character,
    baseDir?: string,
    db?: IDatabaseCacheAdapter
) {
    switch (cacheStore) {
        // case CacheStore.REDIS:
        //     if (process.env.REDIS_URL) {
        //         elizaLogger.debug("Connecting to Redis...");
        //         const redisClient = new RedisClient(process.env.REDIS_URL);
        //         if (!character?.id) {
        //             throw new Error(
        //                 "CacheStore.REDIS requires id to be set in character definition"
        //             );
        //         }
        //         return new CacheManager(
        //             new DbCacheAdapter(redisClient, character.id) // Using DbCacheAdapter since RedisClient also implements IDatabaseCacheAdapter
        //         );
        //     } else {
        //         throw new Error("REDIS_URL environment variable is not set.");
        //     }

        case CacheStore.DATABASE:
            if (db) {
                elizaLogger.debug("Using Database Cache...");
                return initializeDbCache(character, db);
            } else {
                throw new Error(
                    "Database adapter is not provided for CacheStore.Database."
                );
            }

        case CacheStore.FILESYSTEM:
            elizaLogger.debug("Using File System Cache...");
            if (!baseDir) {
                throw new Error(
                    "baseDir must be provided for CacheStore.FILESYSTEM."
                );
            }
            return initializeFsCache(baseDir, character);

        default:
            throw new Error(
                `Invalid cache store: ${cacheStore} or required configuration missing.`
            );
    }
}

async function findDatabaseAdapter(runtime: AgentRuntime) {
  const { adapters } = runtime;
  let adapter: Adapter | undefined;
  // if not found, default to sqlite
  if (adapters.length === 0) {
    const sqliteAdapterPlugin = await import('@elizaos-plugins/adapter-sqlite');
    const sqliteAdapterPluginDefault = sqliteAdapterPlugin.default;
    adapter = sqliteAdapterPluginDefault.adapters[0];
    if (!adapter) {
      throw new Error("Internal error: No database adapter found for default adapter-sqlite");
    }
  } else if (adapters.length === 1) {
    adapter = adapters[0];
  } else {
    throw new Error("Multiple database adapters found. You must have no more than one. Adjust your plugins configuration.");
    }
  const adapterInterface = adapter?.init(runtime);
  return adapterInterface;
}



async function updateAgentKnowledge(runtime: AgentRuntime, event: string, filePath: string) {
    const knowledgeRoot = path.join(process.cwd(), 'agent',  'characters', 'knowledge');
    // Normalize paths to avoid platform-specific issues
    const normalizedKnowledgeRoot = path.normalize(knowledgeRoot).replace(/\\/g, '/');
    const normalizedFilePath = path.normalize(filePath).replace(/\\/g, '/');
    const relPath = path.relative(normalizedKnowledgeRoot, normalizedFilePath).replace(/\\/g, '/');
    const fileDir = path.dirname(relPath).replace(/\\/g, '/').replace(/\/+$/, ''); // Remove trailing slashes
    const knowledgeItems = (runtime.character.knowledge || []).filter(
        (item): item is DirectoryItem => 
            typeof item === 'object' && 
            item !== null && 
            'type' in item && 
            item.type === 'directory' && 
            'directory' in item && 
            typeof item.directory === 'string'
    );
    elizaLogger.debug(`Processing file: ${normalizedFilePath}, relPath: ${relPath}, fileDir: ${fileDir}`, {
        knowledgeRoot: normalizedKnowledgeRoot,
        knowledgeItemsCount: knowledgeItems.length,
        knowledgeItems: knowledgeItems.map(item => ({ directory: item.directory, shared: item.shared }))
    });
    let matched = false;
    for (const item of knowledgeItems) {
        const dirRel = item.directory.replace(/\\/g, '/').replace(/\/+$/, ''); // Normalize and remove trailing slashes
        elizaLogger.debug(`Checking directory: ${dirRel}, shared: ${item.shared}, matches: ${fileDir === dirRel || fileDir.startsWith(`${dirRel}/`)}`);
        if (fileDir === dirRel || fileDir.startsWith(`${dirRel}/`)) {
            matched = true;
            const isShared = item.shared || false;
            if (event === 'add' || event === 'change') {
                try {
                    elizaLogger.debug(`Attempting to read ${normalizedFilePath} for ${runtime.character.name}`);
                    const content = await readFile(normalizedFilePath, 'utf8');
                    elizaLogger.debug(`Read ${normalizedFilePath}, content length: ${content.length}, content: ${content.slice(0, 50)}`);
                    const fileExtension = path.extname(normalizedFilePath).toLowerCase().slice(1);
                    if (['md', 'txt', 'pdf'].includes(fileExtension)) {
                        elizaLogger.debug(`Processing ${relPath} for ${runtime.character.name}`);
                        await runtime.ragKnowledgeManager.processFile({
                            path: relPath,
                            content,
                            type: fileExtension as 'md' | 'txt' | 'pdf',
                            isShared,
                        });
                        elizaLogger.debug(`Updated knowledge for ${runtime.character.name} from ${relPath}`);
                    } else {
                        elizaLogger.warn(`Unsupported file extension: ${fileExtension} for ${relPath}`);
                    }
                } catch (error) {
                    elizaLogger.error(`Failed to process ${relPath} for ${runtime.character.name}:`, {
                        message: error.message,
                        stack: error.stack
                    });
                    throw error; // Ensure errors are not silently ignored
                }
            }
            break;
        }
    }
    if (!matched) {
        elizaLogger.warn(`No matching knowledge directory found for ${relPath}`, {
            fileDir,
            availableDirectories: knowledgeItems.map(item => item.directory)
        });
    }
}



async function startAgent(character: Character, directClient: DirectClient): Promise<AgentRuntime> {
  let db: IDatabaseAdapter & IDatabaseCacheAdapter;
  try {
    elizaLogger.debug(`Starting agent for character ${character.name}`, { id: character.id, createdBy: character.createdBy });

    // Ensure character has valid ID and username
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    // Initialize settings if undefined, omitting email to keep it undefined
    character.settings = character.settings || { secrets: {}, secretsDynamic: [] };

    // Decrypt dynamic secrets from Sanity CMS
    const decryptedDynamicSecrets = (character.settings.secretsDynamic || []).map((secret: Secret) => {
      try {
        const value = secret.encryptedValue?.iv
          ? decryptValue(secret.encryptedValue.iv, secret.encryptedValue.ciphertext)
          : secret.encryptedValue?.ciphertext || '';
        return { ...secret, value };
      } catch (error) {
        elizaLogger.warn(`Failed to decrypt secret ${secret.key}`, { error: error.message });
        return { ...secret, value: '' };
      }
    });

    // Merge decrypted secrets into settings
    const secrets = decryptedDynamicSecrets.reduce(
      (acc: { [key: string]: string }, secret: Secret) => {
        if (secret.value) acc[secret.key] = secret.value;
        return acc;
      },
      { ...character.settings.secrets }
    );

    // Fallback to environment variables for critical secrets
    const requiredSecrets = [
      'EMAIL_INCOMING_USER',
      'EMAIL_INCOMING_PASS',
      'EMAIL_OUTGOING_USER',
      'EMAIL_OUTGOING_PASS',
      'EMAIL_INCOMING_SERVICE',
      'EMAIL_INCOMING_HOST',
      'EMAIL_INCOMING_PORT',
    ];
    requiredSecrets.forEach(key => {
      if (!secrets[key] && process.env[key]) secrets[key] = process.env[key]!;
    });

    // Construct email settings for plugins
    const emailSettings: Character['settings']['email'] = {
      outgoing: {
        service: secrets.EMAIL_OUTGOING_SERVICE && ['gmail', 'smtp'].includes(secrets.EMAIL_OUTGOING_SERVICE)
          ? secrets.EMAIL_OUTGOING_SERVICE as 'gmail' | 'smtp'
          : 'gmail',
        host: secrets.EMAIL_OUTGOING_HOST || '',
        port: secrets.EMAIL_OUTGOING_PORT ? parseInt(secrets.EMAIL_OUTGOING_PORT, 10) : 587,
        secure: secrets.EMAIL_SECURE ? secrets.EMAIL_SECURE === 'true' : true,
        user: secrets.EMAIL_OUTGOING_USER || '',
        pass: secrets.EMAIL_OUTGOING_PASS || '',
      },
      incoming: {
        service: 'imap' as const, // Use 'as const' to ensure literal type "imap"
        host: secrets.EMAIL_INCOMING_HOST || '',
        port: secrets.EMAIL_INCOMING_PORT ? parseInt(secrets.EMAIL_INCOMING_PORT, 10) : 993,
        user: secrets.EMAIL_INCOMING_USER || '',
        pass: secrets.EMAIL_INCOMING_PASS || '',
      },
    };

    // Create decrypted character for plugin initialization
    const decryptedCharacter: Character = {
      ...character,
      settings: {
        ...character.settings,
        secrets,
        secretsDynamic: decryptedDynamicSecrets,
        email: emailSettings,
      },
    };

    // Initialize agent runtime with token
    const token = getTokenForProvider(decryptedCharacter.modelProvider, decryptedCharacter);
    const runtime: AgentRuntime = await createAgent(decryptedCharacter, token);

    // Override runtime.getSetting to access decrypted secrets
    const originalGetSetting = runtime.getSetting.bind(runtime);
    runtime.getSetting = (key: string) => decryptedCharacter.settings?.secrets?.[key] || originalGetSetting(key);

    // Initialize database adapter
    db = await findDatabaseAdapter(runtime);
    runtime.databaseAdapter = db;

    // Initialize cache
    const cache = initializeCache(
      process.env.CACHE_STORE ?? CacheStore.DATABASE,
      decryptedCharacter,
      process.env.CACHE_DIR ?? '',
      db
    );
    runtime.cacheManager = cache;

    // Initialize services and plugins (managed via Sanity CMS)
    await initializeServices(decryptedCharacter, runtime);
    await runtime.initialize();

    // Initialize clients (integrated with Supertokens for user management)
    runtime.clients = await initializeClients(decryptedCharacter, runtime);

    // Register agent with direct client (Stripe payments handled externally)
    directClient.registerAgent(runtime);

    elizaLogger.debug(`Started ${decryptedCharacter.name} as ${runtime.agentId}`);
    return runtime;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}`, { error: error.message });
    if (db) await db.close();
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer();

        server.once("error", (err: NodeJS.ErrnoException) => {
            if (err.code === "EADDRINUSE") {
                resolve(false);
            }
        });

        server.once("listening", () => {
            server.close();
            resolve(true);
        });

        server.listen(port);
    });
};

const hasValidRemoteUrls = () =>
    process.env.REMOTE_CHARACTER_URLS &&
    process.env.REMOTE_CHARACTER_URLS !== "" &&
    process.env.REMOTE_CHARACTER_URLS.startsWith("http");

    const startAgents = async () => {
        try {
            elizaLogger.debug("Starting agents...");
          const directClient = new DirectClient();
          let serverPort = Number.parseInt(settings.SERVER_PORT || "3000");
          const args = parseArguments();
          elizaLogger.debug("Parsed arguments:", args);
          const charactersArg = args.characters || args.character;
      
          // Log environment variables for debugging
          elizaLogger.debug("Environment variables:", {
            REMOTE_CHARACTER_URLS: process.env.REMOTE_CHARACTER_URLS,
            USE_CHARACTER_STORAGE: process.env.USE_CHARACTER_STORAGE,
            SANITY_PROJECT_ID: process.env.SANITY_PROJECT_ID,
            SANITY_DATASET: process.env.SANITY_DATASET,
          });
      
          // Load all characters
          let characters: Character[] = [];
          try {
            elizaLogger.debug("Loading characters...");
            characters = await loadCharacters(charactersArg);
            elizaLogger.debug(`Loaded ${characters.length} characters`);
          } catch (error) {
            elizaLogger.error("Failed to load characters:", {
              error: error.message,
              stack: error.stack,
            });
            process.exit(1);
          }
      
          // Log detailed contents of characters array
          elizaLogger.debug("Loaded characters array:", {
            count: characters.length,
            characters: characters.map((char) => ({
              id: char.id || stringToUuid(char.name),
              name: char.name,
              knowledge: char.knowledge || [],
            })),
          });
      
          // Declare runtimes at the function scope
          const runtimes: AgentRuntime[] = [];
      
          // Start agents for each character
          if (characters.length === 0) {
            elizaLogger.warn("No characters to start");
          } else {
            for (const character of characters) {
              elizaLogger.debug(`Starting agent for character: ${character.name}`);
              try {
                const runtime = await startAgent(character, directClient); // Capture the runtime
                runtimes.push(runtime); // Add it to the array
              } catch (error) {
                elizaLogger.error(`Failed to start agent for ${character.name}:`, {
                  error: error.message,
                  stack: error.stack,
                  character: { name: character.name, id: character.id },
                });
                // Continue with next character
              }
            }
          }
      
          // Find available port
          while (!(await checkPortAvailable(serverPort))) {
            elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
            serverPort++;
          }
      
          // Upload some agent functionality into directClient
          directClient.startAgent = async (character) => {
            try {
              // Handle plugins
              character.plugins = await handlePluginImporting(character.plugins);
              return startAgent(character, directClient);
            } catch (error) {
              elizaLogger.error("Failed to start agent via directClient.startAgent:", {
                error: error.message,
                stack: error.stack,
                character: { name: character.name, id: character.id },
              });
              throw error;
            }
          };
          directClient.loadCharacterTryPath = loadCharacterTryPath;
          directClient.jsonToCharacter = jsonToCharacter;
      
          // Start the server
          try {
            directClient.start(serverPort);
            elizaLogger.debug(`DirectClient server started on port ${serverPort}`);
          } catch (error) {
            elizaLogger.error("Failed to start DirectClient server:", {
              error: error.message,
              stack: error.stack,
              port: serverPort,
            });
            throw error;
          }
      
          if (serverPort !== Number.parseInt(settings.SERVER_PORT || "3000")) {
            elizaLogger.log(`Server started on alternate port ${serverPort}`);
          }
      
          elizaLogger.debug(
            "Run `pnpm start:client` to start the client and visit the outputted URL (http://localhost:5173) to chat with your agents. When running multiple agents, use client with different port `SERVER_PORT=3001 pnpm start:client`"
          );
      
          // Add knowledge after runtime creation
          for (const runtime of runtimes) {
            try {
              if (runtime.character.settings?.ragKnowledge) {
                // String knowledge
                // await runtime.addKnowledge("agentVooc does supports dynamic knowledge addition.", false);
      
                const knowledgeRoot = path.resolve(__dirname, "..", "characters", "knowledge");
for (const knowledgeItem of runtime.character.knowledge || []) {
    if (
        typeof knowledgeItem === "object" &&
        knowledgeItem !== null &&
        "type" in knowledgeItem &&
        knowledgeItem.type === "directory" &&
        "directory" in knowledgeItem &&
        typeof (knowledgeItem as any).directory === "string"
    ) {
        const dirPath = path.resolve(knowledgeRoot, (knowledgeItem as any).directory);
        if (fs.existsSync(dirPath)) {
            const files = await fs.promises.readdir(dirPath);
            for (const file of files) {
                if (file.match(/\.(txt|md|pdf)$/i)) {
                    const filePath = path.join((knowledgeItem as any).directory, file);
                    const fullPath = path.resolve(knowledgeRoot, filePath);
                    if (fs.existsSync(fullPath)) {
                        await runtime.addKnowledge({ path: filePath }, (knowledgeItem as any).shared);
                        elizaLogger.debug(`[RAG Directory] Added knowledge file: ${filePath} for ${runtime.character.name}`);
                    } else {
                        elizaLogger.warn(`[RAG Directory] Knowledge file not found at: ${fullPath}`);
                    }
                }
            }
            elizaLogger.debug(`[RAG Directory] Processed ${files.length} files in ${(knowledgeItem as any).directory} for ${runtime.character.name}`);
        } else {
            elizaLogger.warn(`[RAG Directory] Directory not found at: ${dirPath}`);
        }
    }
}
      
                // Sanity CMS knowledge
                try {
                  const sanityItems = await loadSanityKnowledge({
                    agentId: runtime.agentId,
                  });
                  elizaLogger.debug(`Fetched Sanity items for ${runtime.character.name}:`, {
                    count: sanityItems.length,
                    items: sanityItems.map((item) => ({
                      id: item.id,
                      text: item.content.text.slice(0, 50),
                    })),
                  });
                  if (sanityItems.length > 0) {
                    await runtime.addKnowledge(
                      {
                        sanity: {
                          query: `*[_type == "knowledge" && agentId == "${runtime.agentId}"]`,
                          projectId: process.env.SANITY_PROJECT_ID,
                          dataset: process.env.SANITY_DATASET,
                        },
                        items: sanityItems,
                      },
                      false
                    );
                  } else {
                    elizaLogger.warn(`No Sanity knowledge found for agent ${runtime.agentId}`);
                  }
                } catch (error) {
                  elizaLogger.error(`Failed to load Sanity knowledge for ${runtime.character.name}:`, {
                    error: error.message,
                    stack: error.stack,
                  });
                }
      
                elizaLogger.debug(`Successfully added knowledge for ${runtime.character.name}`);
              } else {
                elizaLogger.debug(`RAG disabled for ${runtime.character.name}, skipping knowledge addition`);
              }
            } catch (error) {
              elizaLogger.error(`Failed to add knowledge for ${runtime.character.name}:`, {
                error: error.message,
                stack: error.stack,
              });
            }
          }
          // Set up file watcher for dynamic knowledge updates
// Set up Chokidar file watcher for dynamic knowledge updates
        const knowledgeRoot = path.join(process.cwd(),  'characters', 'knowledge');
        const normalizedKnowledgeRoot = path.normalize(knowledgeRoot).replace(/\\/g, '/');
        elizaLogger.debug(`Setting up Chokidar file watcher for knowledge directory: ${normalizedKnowledgeRoot}`);

        const watcher = chokidar.watch(normalizedKnowledgeRoot, {
            persistent: true,
            ignoreInitial: false, // Set to false to debug initial files
            depth: 99,
            usePolling: true, // Required for Docker volume mounts
            interval: 500, // Faster polling for responsiveness
            binaryInterval: 500,
            alwaysStat: true,
            awaitWriteFinish: {
                stabilityThreshold: 1000, // Reduced for faster detection
                pollInterval: 100
            },
            ignored: ['**/node_modules/**', '**/.git/**', '**/*.tmp', '**/*.bak']
        });

        const debouncedUpdate = debounce(async (event: string, filePath: string) => {
            if (!filePath) return;
            elizaLogger.debug(`Processing chokidar event: ${event} on ${filePath}`);
            for (const runtime of runtimes) {
                await updateAgentKnowledge(runtime, event, filePath);
            }
        }, 1000);

        watcher
            .on('all', (event, filePath, stats) => {
                elizaLogger.debug(`Chokidar raw event: ${event} on ${filePath}`, { stats });
                if (['add', 'change'].includes(event)) {
                    debouncedUpdate(event, filePath);
                }
            })
            .on('error', (error) => {
                if (error instanceof Error) {
                    elizaLogger.error(`Chokidar error: ${error.message}`, { stack: error.stack });
                } else {
                    elizaLogger.error(`Chokidar error: ${String(error)}`);
                }
            })
            .on('ready', () => {
                elizaLogger.debug(`Chokidar watcher is ready for ${normalizedKnowledgeRoot}`);
            });

        elizaLogger.debug(`Chokidar file watcher set up for ${normalizedKnowledgeRoot}`);
      
          return runtimes;
        } catch (error) {
          elizaLogger.error("Unhandled error in startAgents:", {
            error: error.message,
            stack: error.stack,
          });
          throw error;
        }
      };
      
      // Main execution with enhanced error logging
      (async () => {
        try {
          await startAgents();
        } catch (error) {
          elizaLogger.error("Failed to execute startAgents:", {
            error: error.message,
            stack: error.stack,
          });
          process.exit(1);
        }
      })();
      
    
// Prevent unhandled exceptions from crashing the process if desired
if (
    process.env.PREVENT_UNHANDLED_EXIT &&
    parseBooleanFromText(process.env.PREVENT_UNHANDLED_EXIT)
) {
    // Handle uncaught exceptions to prevent the process from crashing
    process.on("uncaughtException", (error) => {
        elizaLogger.error("Uncaught Exception:", {
          error: error.message,
          stack: error.stack,
        });
      });
    // Handle unhandled rejections to prevent the process from crashing
    process.on("unhandledRejection", (reason, promise) => {
        elizaLogger.error("Unhandled Rejection at:", {
          promise,
          reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
        });
      });
}