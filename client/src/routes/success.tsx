// client/src/routes/success.tsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import dayjs from "dayjs";
import { Item } from "@/types/index.ts";
import { useUser } from "@clerk/clerk-react"; // ✅ Clerk

interface PaymentData {
  amount: number;
  currency: string;
  orderId: string;
  email: string;
  items: Array<{
    content_id: string;
    content_name: string;
    content_type: string;
    num_items: number;
    content_price: number;
    content_group_id?: string | null;
  }>;
}

interface Invoice {
  _id: string;
  stripeInvoiceId: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  createdAt: string;
  dueDate: string | null;
  invoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  lineItems: Array<{
    _key: string;
    description: string;
    amount: number;
    currency: string;
    quantity: number;
    period: { start: string | null; end: string | null };
    productName: string;
  }>;
}

export default function SuccessPage() {
  const { isSignedIn, user } = useUser(); // ✅ Clerk user
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const maxRetries = 10;
  const retryDelay = 2000; // 2 seconds
  const queryClient = useQueryClient();

  useEffect(() => {
    async function checkSessionAndFetchData() {
      if (!sessionId) {
        setError("Invalid payment session. Please try again or contact support.");
        return;
      }

      if (!isSignedIn || !user) {
        setError("No active session found. Please log in to continue.");
        window.location.href = "/auth";
        return;
      }

      try {
        // Fetch user data (from your backend API, which should now accept Clerk JWT)
        const userResponse = await apiClient.getUser();
        const userData = {
          userId: user.id,
          userType: "clerk", // you can adjust depending on backend
          email: user.primaryEmailAddress?.emailAddress || undefined,
          subscriptionStatus: userResponse.user.subscriptionStatus,
        };

        // Fetch invoice data
        const invoiceResponse = await apiClient.getInvoiceBySessionId(sessionId);
        setInvoice(invoiceResponse.invoice);

        // Get selected items from sessionStorage
        const selectedItemsJson = sessionStorage.getItem("selectedItems");
        const selectedItems: Item[] = selectedItemsJson ? JSON.parse(selectedItemsJson) : [];
        if (!selectedItems.length) {
          setError("No payment details found. Please try again or contact support.");
          return;
        }

        const totalAmount = selectedItems.reduce((sum, item) => sum + item.price, 0) / 100;

        setPaymentData({
          amount: totalAmount,
          currency: "USD",
          orderId: sessionId || `order_${Date.now()}`,
          email: userData.email || "unknown",
          items: selectedItems.map((item) => ({
            content_id: item.id,
            content_name: item.name,
            content_type: item.itemType === "base" ? "subscription" : "plugin",
            num_items: 1,
            content_price: item.price / 100,
            content_group_id: item.itemType === "base" ? "base_subscription" : "plugin",
          })),
        });

        if (
          userData.subscriptionStatus === "active" ||
          userData.subscriptionStatus === "trialing"
        ) {
          queryClient.invalidateQueries({ queryKey: ["subscription-status", userData.userId] });
          // Fire X purchase event
          window.twq?.("event", "tw-q5y7y-q5y7z", {
            value: totalAmount,
            currency: "USD",
            contents: selectedItems.map((item) => ({
              content_id: item.id,
              content_name: item.name,
              content_type: item.itemType === "base" ? "subscription" : "plugin",
              num_items: 1,
              content_price: item.price / 100,
              content_group_id: item.itemType === "base" ? "base_subscription" : "plugin",
            })),
            conversion_id: sessionId || `order_${Date.now()}`,
            email_address: userData.email || "unknown",
          });
          // Clear sessionStorage
          sessionStorage.removeItem("selectedItems");
        } else if (retryCount < maxRetries) {
          setTimeout(() => {
            setRetryCount(retryCount + 1);
          }, retryDelay);
        } else {
          setError("Subscription not activated. Please try again or contact support.");
        }
      } catch (err: any) {
        console.error("[SUCCESS_PAGE] Failed to fetch data:", err.message);
        setError("Failed to load data. Please log in again.");
        if (err.status === 401) {
          window.location.href = "/auth";
        }
      }
    }

    checkSessionAndFetchData();
  }, [retryCount, sessionId, queryClient, isSignedIn, user]);

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-screen">
        <Helmet>
          <title>Payment Error | agentVooc</title>
          <meta name="description" content="An error occurred during payment processing." />
        </Helmet>
        <h1 className="text-2xl font-semibold text-red-600 mb-4">Error</h1>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link to="/auth" className="text-blue-500">
            <Button variant="outline">Log In</Button>
          </Link>
          <Button
            onClick={() => {
              setRetryCount(0);
              setError(null);
            }}
          >
            Retry
          </Button>
          <a
            href="mailto:support@elizaos.com"
            className="text-blue-500 hover:underline flex items-center"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  if (!user || !paymentData || !invoice) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-screen">
        <Helmet>
          <title>Verifying Subscription | agentVooc</title>
          <meta name="description" content="Verifying your subscription with AgentVooc." />
        </Helmet>
        <h1 className="text-2xl font-semibold mb-4">Verifying Subscription...</h1>
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-gray-600">Please wait while we confirm your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col items-center justify-center min-h-screen">
      <Helmet>
        <title>Payment Success | agentVooc</title>
        <meta name="description" content="Thank you for your subscription with AgentVooc." />
      </Helmet>
      <h1 className="text-2xl font-semibold mb-4">Payment Successful</h1>
      <p className="text-gray-600 mb-2">
        Thank you for your subscription,{" "}
        {user.primaryEmailAddress?.emailAddress || user.id}!
      </p>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Invoice {invoice.stripeInvoiceId}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              <strong>Status:</strong>{" "}
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </p>
            <p>
              <strong>Amount Due:</strong> ${(invoice.amountDue || 0).toFixed(2)}{" "}
              {invoice.currency.toUpperCase()}
            </p>
            <p>
              <strong>Amount Paid:</strong> ${(invoice.amountPaid || 0).toFixed(2)}{" "}
              {invoice.currency.toUpperCase()}
            </p>
            <p>
              <strong>Created:</strong>{" "}
              {dayjs(invoice.createdAt).format("MMMM D, YYYY")}
            </p>
            {invoice.dueDate && (
              <p>
                <strong>Due Date:</strong>{" "}
                {dayjs(invoice.dueDate).format("MMMM D, YYYY")}
              </p>
            )}
            {invoice.periodStart && invoice.periodEnd && (
              <p>
                <strong>Billing Period:</strong>{" "}
                {dayjs(invoice.periodStart).format("MMMM D, YYYY")} -{" "}
                {dayjs(invoice.periodEnd).format("MMMM D, YYYY")}
              </p>
            )}
            {invoice.lineItems && invoice.lineItems.length > 0 && (
              <div className="mt-2">
                <p>
                  <strong>Items:</strong>
                </p>
                <ul className="list-disc pl-5">
                  {invoice.lineItems.map((item, index) => (
                    <li key={index}>
                      {item.productName} - {item.quantity} x $
                      {item.amount.toFixed(2)} {item.currency.toUpperCase()}
                      {item.period.start && item.period.end && (
                        <span>
                          {" "}
                          ({dayjs(item.period.start).format("MMM D, YYYY")} -{" "}
                          {dayjs(item.period.end).format("MMM D, YYYY")})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {paymentData.items && paymentData.items.length > 0 && (
              <div className="mt-2">
                <p>
                  <strong>Selected Items:</strong>
                </p>
                <ul className="list-disc pl-5">
                  {paymentData.items.map((item, index) => (
                    <li key={index}>
                      {item.content_name} - {item.num_items} x $
                      {item.content_price.toFixed(2)} {paymentData.currency}
                      {item.content_type === "subscription"
                        ? " (Base Subscription)"
                        : " (Plugin)"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex flex-col sm:flex-row gap-4">
              {invoice.invoiceUrl && (
                <Button
                  variant="link"
                  onClick={() =>
                    invoice.invoiceUrl && window.open(invoice.invoiceUrl, "_blank")
                  }
                >
                  View Invoice Online
                </Button>
              )}
              {invoice.invoicePdf && (
                <Button
                  variant="link"
                  onClick={() =>
                    invoice.invoicePdf && window.open(invoice.invoicePdf, "_blank")
                  }
                >
                  Download PDF
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <Link to="/invoices">
          <Button>View Invoices</Button>
        </Link>
        <Link to="/home">
          <Button variant="outline">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
