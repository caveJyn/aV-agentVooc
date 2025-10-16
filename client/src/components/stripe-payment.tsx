// client/src/components/stripe-payment.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { Item } from "@/types/index.ts";

interface StripePaymentProps {
  userId?: string;
  userType?: string;
  selectedItems: Item[];
}

const CheckoutForm: React.FC<{ userId: string; selectedItems: Item[] }> = ({ userId, selectedItems }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const baseItems = selectedItems.filter((item) => item.itemType === "base");
    if (baseItems.length !== 1) {
      setValidationError("Please select exactly one base subscription.");
    } else {
      setValidationError(null);
    }
  }, [selectedItems]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    if (validationError) {
      toast({
        variant: "destructive",
        title: "Error",
        description: validationError,
      });
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.createCheckoutSession({
        userId,
        items: selectedItems.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          itemType: item.itemType,
        })),
      });

      if (!response.checkoutUrl) {
        throw new Error("Checkout URL is missing in response");
      }

      // Store selectedItems in sessionStorage
      sessionStorage.setItem("selectedItems", JSON.stringify(selectedItems));
      window.location.href = response.checkoutUrl;
    } catch (error: any) {
      const errorMessage = error.message || "Failed to initiate checkout";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {validationError && <p className="text-red-500 mb-2">{validationError}</p>}
      <Button
        type="submit"
        disabled={loading || !!validationError}
        className="bg-green-500 hover:bg-green-600 text-white"
      >
        {loading ? "Processing..." : `Proceed to Checkout (${selectedItems.length} items)`}
      </Button>
    </form>
  );
};

export default function StripePayment({ userId, userType, selectedItems }: StripePaymentProps) {
  if (!userId || !userType) {
    return <p>Please log in to access payment features.</p>;
  }

  if (userType !== "email") {
    return <p>Stripe payments are only available for email users.</p>;
  }

  return <CheckoutForm userId={userId} selectedItems={selectedItems} />;
}
