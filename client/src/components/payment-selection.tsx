// client/src/components/payment-selection.tsx
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StripePayment from "@/components/stripe-payment";
import { Item } from "@/types/index.ts";

interface PaymentSectionProps {
  user: { userId?: string; userType?: string } | null;
  items: Item[];
  itemsQuery: any;
  selectedItems: Item[];
  setSelectedItems: React.Dispatch<React.SetStateAction<Item[]>>;
}

export default function PaymentSection({
  user,
  items,
  itemsQuery,
  selectedItems,
  setSelectedItems,
}: PaymentSectionProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const baseItems = selectedItems.filter((item) => item.itemType === "base");
    if (baseItems.length > 1) {
      setError("Please select exactly one base subscription.");
    } else {
      setError(null);
    }
  }, [selectedItems]);

  const handleItemSelect = (item: Item) => {
    if (item.itemType === "base") {
      // Replace any existing base subscription
      setSelectedItems((prev) =>
        prev.filter((i) => i.itemType !== "base").concat(item)
      );
    } else {
      // Toggle plugin items
      setSelectedItems((prev) =>
        prev.some((i) => i.id === item.id)
          ? prev.filter((i) => i.id !== item.id)
          : [...prev, item]
      );
    }
  };

  if (!user || !user.userId || !user.userType) {
    return null;
  }

  const baseItems = items.filter((item) => item.itemType === "base");
  const pluginItems = items.filter((item) => item.itemType === "plugin");

  return (
    <div className="mt-4">
      {itemsQuery.isLoading ? (
        <div className="text-gray-500 flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading items...
        </div>
      ) : (
        <>
          <h3 className="text-lg font-semibold mb-4">Select a Base Subscription (Required)</h3>
          <p className="text-sm text-gray-600 mb-2">Choose one base subscription plan.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {baseItems.map((item) => (
              <Card
                key={item.id}
                className={`w-60cursor-pointer ${
                  selectedItems.some((i) => i.id === item.id)
                    ? "border-blue-500 border-2"
                    : ""
                }`}
                onClick={() => handleItemSelect(item)}
              >
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{item.description}</p>
                  <p className="font-semibold">${(item.price / 100).toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <h3 className="text-lg font-semibold mb-4">Select Plugins (Optional)</h3>
          <p className="text-sm text-gray-600 mb-2">Add any additional plugins you want.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {pluginItems.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer ${
                  selectedItems.some((i) => i.id === item.id)
                    ? "border-blue-500 border-2"
                    : ""
                }`}
                onClick={() => handleItemSelect(item)}
              >
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{item.description}</p>
                  <p className="font-semibold">${(item.price / 100).toFixed(2)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {error && <p className="text-red-500 mb-2">{error}</p>}
          <StripePayment
            userId={user.userId}
            userType={user.userType}
            selectedItems={selectedItems}
          />
        </>
      )}
    </div>
  );
}