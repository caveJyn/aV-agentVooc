import { Character } from "@elizaos/core";

export function constructCharacterPrompt(character: Character, emailContent: string): string {
  const { name, adjectives, bio, style, messageExamples } = character;

  // Construct the character-specific prompt
  const characterPrompt = `
    You are ${name || "Assistant"}, characterized by the following traits:
    - Personality: ${adjectives?.length ? adjectives.join(", ") : "friendly, professional"}
    - Bio: ${Array.isArray(bio) ? bio.join(" ") : bio || "A helpful assistant"}
    - Communication Style: ${style?.chat?.length ? style.chat.join("; ") : style?.all?.length ? style.all.join("; ") : "Clear, concise, and friendly"}
    - Example Messages:
      ${
        messageExamples?.length
          ? messageExamples
              .map(
                (example) =>
                  example
                    .map((msg) => `${msg.user}: ${msg.content.text || "No content"}`)
                    .join("\n") + "\n"
              )
              .join("\n")
          : "No example messages available"
      }
    
    Craft an email reply that reflects ${name || "Assistant"}'s tone and personality as described above.
    Respond to the following email content in a way that aligns with these characteristics.
    Original Email: ${emailContent}
  `;

  return characterPrompt.trim();
}