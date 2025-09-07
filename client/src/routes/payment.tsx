import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StripePayment from "@/components/stripe-payment";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  itemType: string;
}

export default function Payment() {
  const location = useLocation();
  const initialSelectedItem = location.state?.selectedItem as Item | undefined;
  const [selectedItems, setSelectedItems] = useState<Item[]>(
    initialSelectedItem ? [initialSelectedItem] : []
  );
  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const data = await apiClient.getUser();
      return data.user;
    },
  });

  const itemsQuery = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const data = await apiClient.getItems({ itemType: "subscription" });
      console.log("[PAYMENT] Fetched subscription items:", data.items);
      return data.items;
    },
  });

  const handleItemSelect = (item: Item) => {
    setSelectedItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, item]
    );
  };

  if (userQuery.isLoading || itemsQuery.isLoading) {
    return (
      <div className="text-gray-500 flex items-center p-4">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  if (!userQuery.data) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold">Please Log In</h1>
        <p>You need to be logged in to subscribe.</p>
        <NavLink
          to="/auth/email"
          state={{ defaultIsSignUp: true, selectedItem: initialSelectedItem }}
        >
          <Button className="mt-4">Log In or Sign Up</Button>
        </NavLink>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Choose a Subscription Plan</h1>
      {itemsQuery.data?.length === 0 ? (
        <p>No subscription plans available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {itemsQuery.data?.map((item: Item) => (
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
                <p className="font-semibold">${(item.price / 100).toFixed(2)}/month</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <StripePayment
        userId={userQuery.data.userId}
        userType={userQuery.data.userType}
        selectedItems={selectedItems}
      />
    </div>
  );
}