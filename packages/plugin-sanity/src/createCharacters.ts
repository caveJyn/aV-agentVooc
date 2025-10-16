// /home/caveman/projects/Bots/eliza-mainn/scripts/create-character.ts
import { createClient } from "@sanity/client";
import { stringToUuid } from "@elizaos/core";

 const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID ,
  dataset: process.env.SANITY_DATASET,
  apiVersion: process.env.SANITY_API_VERSION,
  useCdn: false,
  token: process.env.SANITY_API_TOKEN,
});

interface CharacterFields {
  id?: string;
  username?: string;
  system?: string;
  bio?: string[];
  lore?: string[];
  plugins?: string[];
  modelProvider?: "OPENAI" | "OLLAMA" | "CUSTOM";
  enabled?: boolean;
  knowledge?: Array<{ _type: "directoryItem"; directory: string; shared: boolean } | { _type: "reference"; _ref: string }>;
}

async function createCharacter(name: string, fields: CharacterFields = {}) {
  const id = stringToUuid(name); // Generate UUID from name
  const doc = {
    _type: "character",
    id,
    name,
    username: fields.username || name.toLowerCase(),
    system: fields.system || `You are ${name}, a helpful AI assistant.`,
    bio: fields.bio || [],
    lore: fields.lore || [],
    plugins: fields.plugins || [],
    modelProvider: fields.modelProvider || "OPENAI",
    enabled: fields.enabled !== undefined ? fields.enabled : true,
    knowledge: fields.knowledge || [
      {
        _type: "directoryItem",
        directory: name.toLowerCase(),
        shared: false,
      },
    ],
    createdBy: {
      _type: "reference",
      _ref: fields.id,
    },
  };
  try {
    const result = await client.create(doc);
    console.log(`Created character "${name}" with id ${id}`);
    return result;
  } catch (error) {
    console.error(`Failed to create character "${name}":`, error);
    throw error;
  }
}

// Example usage
createCharacter("Kaleem", {
  username: "kaleem",
  system: "You are Kaleem, a knowledgeable AI.",
  plugins: ["telegram", "solana"],
  knowledge: [
    {
      _type: "reference",
      _ref: "4694d738-583f-4d0a-893f-80ff4579d2ab",
    },
    {
      _type: "directoryItem",
      directory: "degennn",
      shared: false,
    },
  ],
}).catch(err => process.exit(1));

// CLI handling
const args = process.argv.slice(2);
if (args.length > 0) {
  const name = args[0];
  const fields: CharacterFields = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (key === "--username") fields.username = value;
    if (key === "--system") fields.system = value;
    if (key === "--plugins") fields.plugins = value.split(",");
    if (key === "--knowledge-ref") {
      fields.knowledge = fields.knowledge || [];
      fields.knowledge.push({ _type: "reference", _ref: value });
    }
  }
  createCharacter(name, fields).catch(err => process.exit(1));
} else {
  console.log("Usage: node create-character.ts <name> [--username <username>] [--system <system>] [--plugins <plugin1,plugin2>] [--knowledge-ref <ref_id>]");
  process.exit(1);
}


// Example Usage
/* node scripts/create-character.ts Kaleem --username kaleem --system "You are Kaleem, a knowledgeable AI." --plugins telegram,solana --knowledge-ref 4694d738-583f-4d0a-893f-80ff4579d2ab
node scripts/create-character.ts agentVooc --username eliza --plugins telegram
 */


// node scripts/create-character.ts Kaleem --username kaleem --system "You are Kaleem, a knowledgeable AI." --plugins telegram,solana
// Created character "Kaleem" with id <UUID>
// node scripts/create-character.ts agentVooc --username eliza --plugins telegram



/* 3. Implementing Character Creation in a Front-End Dashboard
To create characters via a front-end dashboard (e.g., a React, Vue, or vanilla JavaScript web app), you’ll need:
A form to collect user input (e.g., name, username, system, plugins).

A Sanity client to send the creation request.

The @elizaos/core library to generate stringToUuid (or a similar UUID function).

I’ll assume you have a web app (e.g., a React dashboard) and want to add a "Create Character" feature. If you’re using another framework or plain JavaScript, let me know, and I can adjust the example.
Prerequisites
Sanity Client: Install the Sanity JavaScript client in your front-end project.

Authentication: Use a Sanity API token with write access, securely managed (e.g., via environment variables or a backend proxy for security).

UUID Generation: Either bundle @elizaos/core or use a lightweight UUID library like uuid.

 */


/* Create Front-End Form (React Example):
Create a component for character creation:
jsx

// /home/caveman/projects/Bots/eliza-mainn/dashboard/src/CreateCharacter.js
import React, { useState } from "react";
import axios from "axios";

function CreateCharacter() {
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    system: "",
    plugins: "",
  });
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:3001/create-character", {
        name: formData.name,
        username: formData.username,
        system: formData.system,
        plugins: formData.plugins.split(",").filter(p => p.trim()),
      });
      setMessage(`Character created: ${response.data.character.name} (ID: ${response.data.character.id})`);
      setFormData({ name: "", username: "", system: "", plugins: "" });
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div>
      <h2>Create Character</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>System Prompt:</label>
          <textarea
            name="system"
            value={formData.system}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>Plugins (comma-separated):</label>
          <input
            type="text"
            name="plugins"
            value={formData.plugins}
            onChange={handleChange}
            placeholder="telegram,solana"
          />
        </div>
        <button type="submit">Create</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}

export default CreateCharacter;

Add to your app:
jsx

// /home/caveman/projects/Bots/eliza-mainn/dashboard/src/App.js
import CreateCharacter from "./CreateCharacter";

function App() {
  return (
    <div>
      <h1>agentVooc Dashboard</h1>
      <CreateCharacter />
    </div>
  );
}

export default App;

 */