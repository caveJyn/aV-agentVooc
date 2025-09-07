# Sanity Blogging Content Studio

Congratulations, you have now installed the Sanity Content Studio, an open-source real-time content editing environment connected to the Sanity backend.

Now you can do the following things:

- [Read “getting started” in the docs](https://www.sanity.io/docs/introduction/getting-started?utm_source=readme)
- Check out the example frontend: [React/Next.js](https://github.com/sanity-io/tutorial-sanity-blog-react-next)
- [Read the blog post about this template](https://www.sanity.io/blog/build-your-own-blog-with-sanity-and-next-js?utm_source=readme)
- [Join the community Slack](https://slack.sanity.io/?utm_source=readme)
- [Extend and build plugins](https://www.sanity.io/docs/content-studio/extending?utm_source=readme)


# Introduction

## ElizaOS with sanity
* Clone the plugin, 
* Add workspace in agent/src/packages.json
* Import the characters from sanity into the agent
    * `import { loadEnabledSanityCharacters } from "@elizaos-plugins/plugin-sanity";`
* Update loadCharaters() in agent to load the characters from sanity into the agent
```typescript
 // Load from Sanity if no CLI args or remote URLs
    if (!charactersArg && !hasValidRemoteUrls()) {
      elizaLogger.debug("Fetching enabled characters from Sanity");
      try {
        const sanityCharacters = await loadEnabledSanityCharacters();
        loadedCharacters.push(...sanityCharacters);
        elizaLogger.info(`Loaded ${sanityCharacters.length} characters from Sanity`);
      } catch (e) {
        elizaLogger.error(`Failed to load characters from Sanity: ${e}`);
      }
    }
```
* Now Inject the loaded characters into startAgents() for multiple agents.
    * Use the following code:
```typescript
    // Load all characters
        let characters: Character[] = [];
        try {
            characters = await loadCharacters(charactersArg);
        } catch (error) {
            elizaLogger.error("Failed to load characters:", error);
            process.exit(1);
        }
    // Log detailed contents of characters array
    elizaLogger.info("Loaded characters array:", {
        count: characters.length,
        characters: characters.map((char, index) => ({
          index,
          _id: char._id,
          id: char.id,
          name: char.name,
          username: char.username,
          modelProvider: char.modelProvider,
          plugins: char.plugins?.map(p => p.name) || [],
          bio: char.bio,
          lore: char.lore,
          topics: char.topics,
          adjectives: char.adjectives,
          style: char.style,
          settings: {
            secrets: Object.keys(char.settings?.secrets || {}),
            voice: char.settings?.voice,
            ragKnowledge: char.settings?.ragKnowledge,
          },
          knowledge: char.knowledge?.map(k => ({
            id: k.id,
            agentId: k.agentId,
            content: {
              text: k.content.text || "(empty)", // Removed truncation
              metadata: k.content.metadata,
            },
            createdAt: k.createdAt,
          })) || [],
          messageExamples: char.messageExamples,
          postExamples: char.postExamples,
          system: char.system,
          templates: char.templates,
          profile: char.profile,
        })),
      });
      // Declare runtimes at the function scope
    const runtimes: AgentRuntime[] = [];
        // Start agents for each character
        if (characters.length === 0) {
            elizaLogger.warn("No characters to start");
        } else {
            for (const character of characters) {
                elizaLogger.info(`Starting agent for character: ${character.name}`);
                try {
                    const runtime = await startAgent(character, directClient); // Capture the runtime
                    runtimes.push(runtime); // Add it to the array
                    await startAgent(character, directClient);
                } catch (error) {
                    elizaLogger.error(`Failed to start agent for ${character.name}:`, error);
                    // Continue with next character
                }
            }
        }


```
Instead of this in startAgents():

```typescript
if ((charactersArg) || hasValidRemoteUrls()) {
        characters = await loadCharacters(charactersArg);
    }

    try {
        for (const character of characters) {
            await startAgent(character, directClient);
        }
    } catch (error) {
        elizaLogger.error("Error starting agents:", error);
    }

```