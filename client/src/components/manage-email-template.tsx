import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface EmailTemplate {
  _id: string;
  agentId: string;
  position: string;
  emailAddress: string;
  companyName: string;
  instructions: string;
  bestRegard: string;
  template: string;
}

interface ManageEmailTemplateProps {
  agentId: string;
}

export default function ManageEmailTemplate({ agentId }: ManageEmailTemplateProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [template, setTemplate] = useState<Partial<EmailTemplate>>({
    agentId,
    position: "",
    emailAddress: "",
    companyName: "",
    instructions: "",
    bestRegard: "",
    template: "Dear {{sender}},\n\n{{body}}\n\n{{bestRegard}},\n{{agentName}}",
  });
  const [preview, setPreview] = useState<string>("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["emailTemplate", agentId],
    queryFn: async () => {
      const response = await apiClient.getEmailTemplate(agentId);
      return response.emailTemplate;
    },
  });

  useEffect(() => {
    if (data) {
      setTemplate(data);
    }
  }, [data]);

  // Generate preview of email based on current template
  useEffect(() => {
    const sampleBody = "This is a sample email body.";
    const sampleSender = "recipient@example.com";
    const sampleAgentName = "Agent Name";
    const previewText = template.template
      ?.replace("{{sender}}", sampleSender.split("@")[0] || "Recipient")
      ?.replace("{{body}}", sampleBody)
      ?.replace("{{agentName}}", sampleAgentName)
      ?.replace("{{position}}", template.position || "")
      ?.replace("{{emailAddress}}", template.emailAddress || "")
      ?.replace("{{companyName}}", template.companyName || "")
      ?.replace("{{bestRegard}}", template.bestRegard || "");
    setPreview(previewText || "");
  }, [template]);

  const updateTemplateMutation = useMutation({
    mutationFn: (updatedTemplate: Partial<EmailTemplate>) => {
      if (!updatedTemplate.template?.includes("{{body}}")) {
        throw new Error("Template must include {{body}} placeholder");
      }
      return apiClient.updateEmailTemplate(agentId, updatedTemplate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplate", agentId] });
      toast({
        title: "Success",
        description: "Email template updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update email template.",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setTemplate((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTemplateMutation.mutate(template);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-agentvooc-secondary-bg px-4 sm:px-6 lg:px-8">
        <p className="text-agentvooc-secondary">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-agentvooc-secondary-bg px-4 sm:px-6 lg:px-8">
        <p className="text-red-500">Error: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6  border border-agentvooc-accent/30 rounded-xl  w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-xl font-bold mb-4 text-agentvooc-primary">Manage Email Template</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="template" className="block text-sm font-medium text-agentvooc-secondary">
            Email Template Structure
          </label>
          <Textarea
            id="template"
            name="template"
            value={template.template || ""}
            onChange={handleInputChange}
            placeholder="Use placeholders: {{sender}}, {{body}}, {{agentName}}, {{position}}, {{emailAddress}}, {{companyName}}, {{bestRegard}}"
            rows={6}
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
          <p className="text-sm text-agentvooc-secondary mt-1">
            Define the email structure. Required: {'{{body}}'}. Optional: {'{{sender}}'}, {'{{agentName}}'}, {'{{position}}'}, {'{{emailAddress}}'}, {'{{companyName}}'}, {'{{bestRegard}}'}.
          </p>
        </div>
        <div>
          <label htmlFor="instructions" className="block text-sm font-medium text-agentvooc-secondary">
            Instructions
          </label>
          <Textarea
            id="instructions"
            name="instructions"
            value={template.instructions || ""}
            onChange={handleInputChange}
            placeholder="Instructions for generating the email body (e.g., tone, content guidelines)"
            rows={4}
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="bestRegard" className="block text-sm font-medium text-agentvooc-secondary">
            Best Regard
          </label>
          <Input
            id="bestRegard"
            name="bestRegard"
            value={template.bestRegard || ""}
            onChange={handleInputChange}
            placeholder="e.g., Best regards"
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="position" className="block text-sm font-medium text-agentvooc-secondary">
            Position
          </label>
          <Input
            id="position"
            name="position"
            value={template.position || ""}
            onChange={handleInputChange}
            placeholder="e.g., Assistant"
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="emailAddress" className="block text-sm font-medium text-agentvooc-secondary">
            Email Address
          </label>
          <Input
            id="emailAddress"
            name="emailAddress"
            value={template.emailAddress || ""}
            onChange={handleInputChange}
            placeholder="e.g., user@gmail.com"
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
        </div>
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-agentvooc-secondary">
            Company Name
          </label>
          <Input
            id="companyName"
            name="companyName"
            value={template.companyName || ""}
            onChange={handleInputChange}
            placeholder="e.g., agentVooc"
            className="text-agentvooc-primary bg-agentvooc-secondary-bg border-agentvooc-accent/30 focus:ring-agentvooc-accent focus:border-agentvooc-accent placeholder-agentvooc-secondary/50 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-agentvooc-secondary">Preview</label>
          <div className="p-4 rounded whitespace-pre-line bg-agentvooc-secondary-bg border-agentvooc-accent/30 text-agentvooc-primary">
            {preview || "No preview available"}
          </div>
        </div>
        <Button
          type="submit"
          className="bg-agentvooc-button-bg text-agentvooc-accent hover:bg-agentvooc-accent hover:text-agentvooc-secondary-bg shadow-agentvooc-glow rounded-lg"
        >
          Save Changes
        </Button>
      </form>
    </div>
  );
}