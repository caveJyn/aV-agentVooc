import { useState } from "react";
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    if (selectedItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one item to proceed to checkout.",
      });
      setLoading(false);
      return;
    }

    try {
      console.log("[CHECKOUT_FORM] Fetching checkout session for userId:", userId, "Items:", selectedItems);
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
      console.log("[CHECKOUT_FORM] Raw response from createCheckoutSession:", response);

      if (!response) {
        console.error("[CHECKOUT_FORM] Response is undefined");
        throw new Error("Response from createCheckoutSession is undefined");
      }

      if (!response.checkoutUrl) {
        console.error("[CHECKOUT_FORM] checkoutUrl is missing in response:", response);
        throw new Error("Checkout URL is missing in response");
      }

      console.log("[CHECKOUT_FORM] Redirecting to Stripe Checkout:", response.checkoutUrl);
      window.location.href = response.checkoutUrl;
    } catch (error: any) {
      console.error("[CHECKOUT_FORM] Error in handleSubmit:", error);
      const errorMessage = error.message || "Failed to initiate checkout";
      if (errorMessage.includes("already subscribed")) {
        toast({
          variant: "destructive",
          title: "Already Subscribed",
          description: "You already have an active subscription. Manage it from the dashboard.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Button
        type="submit"
        disabled={loading || selectedItems.length === 0}
        className="bg-green-500 hover:bg-green-600 text-white"
      >
        {loading ? "Processing..." : `Proceed to Checkout (${selectedItems.length} items)`}
      </Button>
    </form>
  );
};

export default function StripePayment({ userId, userType, selectedItems }: StripePaymentProps) {
  console.log("[STRIPE_PAYMENT] Rendering StripePayment with props:", { userId, userType, selectedItems });

  if (!userId || !userType) {
    console.log("[STRIPE_PAYMENT] Missing userId or userType, rendering fallback message");
    return <p>Please log in to access payment features.</p>;
  }

  if (userType !== "email") {
    console.log("[STRIPE_PAYMENT] User type is not email, rendering fallback message");
    return <p>Stripe payments are only available for email users.</p>;
  }

  return <CheckoutForm userId={userId} selectedItems={selectedItems} />;
}