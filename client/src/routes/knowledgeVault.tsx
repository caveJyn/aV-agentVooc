import { useParams } from "react-router-dom";
import ManageKnowledge from "@/components/manage-knowledge";

export default function KnowledgeVault() {
  const { agentId } = useParams<{ agentId: string }>();
  // console.log("[KnowledgeVaultRoute] Rendering for agentId:", agentId);
  if (!agentId) return <p>Invalid agent ID</p>;
  return <ManageKnowledge agentId={agentId} />;
}