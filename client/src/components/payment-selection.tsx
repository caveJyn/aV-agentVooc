import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StripePayment from "@/components/stripe-payment";
import { Item } from "@/types/index.ts";

interface PaymentSectionProps {
  user: { userId?: string; userType?: string } | null;
  items: Item[];
  itemsQuery: ReturnType<typeof useQuery>;
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
  const handleItemSelect = (item: Item) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  if (!user || !user.userId || !user.userType) {
    console.log("[PAYMENT_SECTION] No user or missing userId/userType, skipping render");
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-4">Select Items to Purchase</h3>
      {itemsQuery.isLoading && (
        <div className="text-gray-500 flex items-center">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading items...
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {items.map((item: Item) => (
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
      <StripePayment
        userId={user.userId}
        userType={user.userType}
        selectedItems={selectedItems}
      />
      {user.userType === "crypto" && (
        <p className="mt-4 text-gray-600">
          Crypto payments via Phantom Wallet are coming soon!
        </p>
      )}
    </div>
  );
}