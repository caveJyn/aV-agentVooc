import { useParams } from "react-router-dom";
import ManageEmailTemplate from "@/components/manage-email-template";

export default function EmailVault() {
  const { agentId } = useParams<{ agentId: string }>();
  if (!agentId) return <p>Invalid agent ID</p>;
  return <ManageEmailTemplate agentId={agentId} />;
}