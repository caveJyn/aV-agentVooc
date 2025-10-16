// import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
// import { useParams } from "react-router-dom";
// import { apiClient } from "@/lib/api";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { useState } from "react";
// import { Loader2 } from "lucide-react";
// import type { UUID } from "@elizaos/core";

// interface Knowledge {
//   id: string;
//   name: string;
//   text: string;
//   agentId: string;
//   createdAt: string;
// }

// interface CharacterSettings {
//   ragKnowledge?: boolean;
//   secrets?: { dynamic?: Array<{ key: string; value: string }> };
//   voice?: { model?: string };
// }

// interface Character {
//   id: UUID; // Override @elizaos/core Character to make id required
//   name: string;
//   settings?: CharacterSettings;
// }

// interface CharacterResponse {
//   id: UUID;
//   character: Character;
// }

// export default function CharacterSettings() {
//   const { agentId } = useParams<{ agentId: string }>();
//   const queryClient = useQueryClient();
//   const [newKnowledge, setNewKnowledge] = useState({ name: "", text: "" });

//   // Fetch character details
//   const { data: characterData, isLoading: characterLoading } = useQuery<CharacterResponse, Error>({
//     queryKey: ["character", agentId],
//     queryFn: () => apiClient.getAgent(agentId!),
//     enabled: !!agentId,
//   });

//   // Fetch knowledge entries
//   const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery<{ knowledge: Knowledge[] }, Error>({
//     queryKey: ["knowledge", agentId],
//     queryFn: () => apiClient.getKnowledge(agentId!),
//     enabled: !!agentId && !!characterData?.character?.settings?.ragKnowledge,
//   });

//   // Mutation for creating knowledge
//   const createKnowledgeMutation = useMutation({
//     mutationFn: (knowledge: { agentId: string; name: string; text: string }) =>
//       apiClient.createKnowledge(knowledge),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
//       setNewKnowledge({ name: "", text: "" });
//     },
//     onError: (error: any) => {
//       console.error("Error creating knowledge:", error);
//       alert(`Failed to create knowledge: ${error.message}`);
//     },
//   });

//   // Mutation for deleting knowledge
//   const deleteKnowledgeMutation = useMutation({
//     mutationFn: (id: string) => apiClient.deleteKnowledge(id),
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
//     },
//     onError: (error: any) => {
//       console.error("Error deleting knowledge:", error);
//       alert(`Failed to delete knowledge: ${error.message}`);
//     },
//   });

//   if (characterLoading) {
//     return (
//       <div className="p-4 flex items-center">
//         <Loader2 className="h-6 w-6 animate-spin" />
//         <span className="ml-2">Loading character...</span>
//       </div>
//     );
//   }

//   if (!characterData || !characterData.character) {
//     return (
//       <div className="p-4">
//         <h1 className="text-2xl font-bold">Character Settings</h1>
//         <p>Character not found.</p>
//       </div>
//     );
//   }

//   const character = characterData.character;

//   if (!character.settings?.ragKnowledge) {
//     return (
//       <div className="p-4">
//         <h1 className="text-2xl font-bold">Character Settings</h1>
//         <p>RAG Knowledge is not enabled for this character. Please upgrade your subscription or enable it during character creation.</p>
//       </div>
//     );
//   }

//   const handleAddKnowledge = () => {
//     if (!newKnowledge.name || !newKnowledge.text) {
//       alert("Please provide both a name and text for the knowledge entry.");
//       return;
//     }
//     createKnowledgeMutation.mutate({ agentId: agentId!, ...newKnowledge });
//   };

//   return (
//     <div className="p-4">
//       <h1 className="text-2xl font-bold mb-4">Character Settings: {character.name}</h1>

//       <section className="mb-8">
//         <h2 className="text-xl font-semibold mb-2">Knowledge Vault</h2>
//         <p className="text-sm text-gray-600 mb-4">
//           Add knowledge entries to provide your character with specific information or context that it can use in conversations.
//         </p>

//         {knowledgeLoading ? (
//           <div className="flex items-center">
//             <Loader2 className="h-6 w-6 animate-spin" />
//             <span className="ml-2">Loading knowledge entries...</span>
//           </div>
//         ) : (
//           <div className="space-y-4">
//             {knowledgeData?.knowledge.length === 0 ? (
//               <p>No knowledge entries found. Add one below!</p>
//             ) : (
//               knowledgeData?.knowledge.map((entry: Knowledge) => (
//                 <Card key={entry.id} className="border border-gray-200">
//                   <CardHeader>
//                     <CardTitle>{entry.name}</CardTitle>
//                   </CardHeader>
//                   <CardContent>
//                     <p className="text-sm text-gray-700">{entry.text.substring(0, 100)}...</p>
//                   </CardContent>
//                   <CardContent>
//                     <Button
//                       variant="destructive"
//                       onClick={() => deleteKnowledgeMutation.mutate(entry.id)}
//                       disabled={deleteKnowledgeMutation.isPending}
//                     >
//                       {deleteKnowledgeMutation.isPending ? "Deleting..." : "Delete"}
//                     </Button>
//                   </CardContent>
//                 </Card>
//               ))
//             )}
//           </div>
//         )}

//         <div className="mt-6">
//           <h3 className="text-lg font-medium mb-2">Add New Knowledge Entry</h3>
//           <Input
//             placeholder="Name (e.g., 'Historical Facts')"
//             value={newKnowledge.name}
//             onChange={(e) => setNewKnowledge({ ...newKnowledge, name: e.target.value })}
//             className="mb-2"
//           />
//           <Textarea
//             placeholder="Enter the knowledge content here..."
//             value={newKnowledge.text}
//             onChange={(e) => setNewKnowledge({ ...newKnowledge, text: e.target.value })}
//             className="mb-2"
//           />
//           <Button
//             onClick={handleAddKnowledge}
//             disabled={createKnowledgeMutation.isPending}
//           >
//             {createKnowledgeMutation.isPending ? "Adding..." : "Add Knowledge"}
//           </Button>
//         </div>
//       </section>
//     </div>
//   );
// }