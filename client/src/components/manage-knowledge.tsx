import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { UUID, Character } from "@elizaos/core";
import { Trash2, Edit2, Save, X } from "lucide-react";

interface KnowledgeVaultProps {
  agentId: string;
}

interface CharacterResponse {
  id: UUID;
  character: Character;
}

interface Knowledge {
  _id: string;
  id: string;
  name: string;
  text: string;
  metadata?: object;
}

interface KnowledgeResponse {
  knowledge: Knowledge[];
}

export default function ManageKnowledge({ agentId }: KnowledgeVaultProps) {
  console.log("[KnowledgeVault] Rendering for agentId:", agentId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newKnowledge, setNewKnowledge] = useState({ name: "", text: "", metadata: {} });
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);

  const characterQuery = useQuery<CharacterResponse, Error>({
    queryKey: ["character", agentId],
    queryFn: () => apiClient.getAgent(agentId),
  });

  const knowledgeQuery = useQuery<KnowledgeResponse, Error>({
    queryKey: ["knowledge", agentId],
    queryFn: () => apiClient.getKnowledge(agentId),
    enabled: !!characterQuery.data?.character?.settings?.ragKnowledge,
  });

  const createKnowledgeMutation = useMutation({
    mutationFn: (knowledge: { name: string; text: string; metadata?: object }) =>
      apiClient.createKnowledge(agentId, knowledge),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      setNewKnowledge({ name: "", text: "", metadata: {} });
      toast({
        title: "Success",
        description: "Knowledge item created successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating knowledge:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create knowledge item.",
      });
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: (knowledge: { name?: string; text?: string; metadata?: object }) => {
      console.log("[updateKnowledgeMutation] Sending knowledge:", knowledge);
      return apiClient.updateKnowledge(agentId, editingKnowledge!.id, knowledge);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      setEditingKnowledge(null);
      toast({
        title: "Success",
        description: "Knowledge item updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Error updating knowledge:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update knowledge item.",
      });
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: (knowledgeId: string) => apiClient.deleteKnowledge(agentId, knowledgeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      toast({
        title: "Success",
        description: "Knowledge item deleted successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Error deleting knowledge:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete knowledge item.",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    console.log("[handleInputChange] Input change:", { name, value });
    if (editingKnowledge) {
      setEditingKnowledge((prev) => {
        if (!prev) return prev; // Guard against null/undefined
        const updated = { ...prev, [name]: value };
        console.log("[handleInputChange] Updated editingKnowledge:", updated);
        return updated;
      });
    } else {
      setNewKnowledge((prev) => {
        const updated = { ...prev, [name]: value };
        console.log("[handleInputChange] Updated newKnowledge:", updated);
        return updated;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingKnowledge) {
      const knowledgeToUpdate = {
        name: editingKnowledge.name,
        text: editingKnowledge.text,
        metadata: editingKnowledge.metadata,
      };
      console.log("[handleSubmit] Submitting knowledge update:", knowledgeToUpdate);
      // Validate that at least one field is non-empty
      if (!knowledgeToUpdate.name && !knowledgeToUpdate.text && Object.keys(knowledgeToUpdate.metadata || {}).length === 0) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "At least one field (name, text, or metadata) is required.",
        });
        return;
      }
      updateKnowledgeMutation.mutate(knowledgeToUpdate);
    } else {
      if (!newKnowledge.name || !newKnowledge.text) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Name and text are required for new knowledge.",
        });
        return;
      }
      createKnowledgeMutation.mutate(newKnowledge);
    }
  };

  const handleEdit = (knowledge: Knowledge) => {
    console.log("[handleEdit] Setting editingKnowledge:", knowledge);
    setEditingKnowledge(knowledge);
  };

  const handleCancelEdit = () => {
    setEditingKnowledge(null);
  };

  const handleDelete = (knowledgeId: string) => {
    if (window.confirm("Are you sure you want to delete this knowledge item?")) {
      deleteKnowledgeMutation.mutate(knowledgeId);
    }
  };

  if (characterQuery.isLoading) {
    return <p>Loading character settings...</p>;
  }

  if (characterQuery.isError) {
    return <p>Error loading character: {characterQuery.error.message}</p>;
  }

  if (!characterQuery.data?.character?.settings?.ragKnowledge) {
    return <p>Knowledge feature is not enabled for this character.</p>;
  }

  return (
    <div className="p-4 bg-white border rounded">
      <h2 className="text-xl font-bold mb-4">Knowledge Vault</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Knowledge Name
          </label>
          <Input
            id="name"
            name="name"
            value={editingKnowledge ? editingKnowledge.name : newKnowledge.name}
            onChange={handleInputChange}
            placeholder="Enter knowledge name"
            required
          />
        </div>
        <div>
          <label htmlFor="text" className="block text-sm font-medium text-gray-700">
            Content
          </label>
          <Textarea
            id="text"
            name="text"
            value={editingKnowledge ? editingKnowledge.text : newKnowledge.text}
            onChange={handleInputChange}
            placeholder="Enter knowledge content"
            required
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="bg-blue-500 text-white hover:bg-blue-600"
            disabled={createKnowledgeMutation.isPending || updateKnowledgeMutation.isPending}
          >
            {editingKnowledge ? (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Changes
              </>
            ) : (
              "Add Knowledge"
            )}
          </Button>
          {editingKnowledge && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelEdit}
              className="border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
          )}
        </div>
      </form>
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Existing Knowledge</h3>
        {knowledgeQuery.isLoading ? (
          <p>Loading knowledge...</p>
        ) : knowledgeQuery.isError ? (
          <p>Error loading knowledge: {knowledgeQuery.error.message}</p>
        ) : !knowledgeQuery.data || knowledgeQuery.data.knowledge.length === 0 ? (
          <p>No knowledge entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {knowledgeQuery.data.knowledge.map((item) => (
              <li key={item._id} className="border p-2 rounded flex justify-between items-center">
                <div>
                  <strong>{item.name}</strong>: {item.text}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(item)}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                    className="bg-red-500 text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}