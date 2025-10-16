// client/src/routes/invoices.tsx
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import InvoiceHistory from "@/components/invoice-history";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function InvoicesPage() {
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const data = await apiClient.getUser();
      return data.user;
    },
  });

  if (userQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!userQuery.data) {
    return <Navigate to="/auth" replace />;
  }

  return <InvoiceHistory userId={userQuery.data.userId} />;
}