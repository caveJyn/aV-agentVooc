// client/src/components/invoice-history.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import dayjs from "dayjs";

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

interface InvoiceHistoryProps {
  userId: string;
}

export default function InvoiceHistory({ userId }: InvoiceHistoryProps) {
  const [sortBy, setSortBy] = useState<"createdAt" | "status">("createdAt");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "paid" | "open" | "draft" | "void" | "uncollectible"
  >("all");

  const invoicesQuery = useQuery({
    queryKey: ["invoices", userId],
    queryFn: async () => {
      const response = await apiClient.getInvoices();
      console.log("[InvoiceHistory] Fetched invoices:", {
        subscriptionId: response.subscriptionId,
        invoiceCount: response.invoices.length,
        invoices: response.invoices.map((inv: Invoice) => ({
          stripeInvoiceId: inv.stripeInvoiceId,
          status: inv.status,
        })),
      });
      return response as { invoices: Invoice[]; subscriptionId: string | null };
    },
    enabled: !!userId,
  });

  // Sort and filter invoices
  const sortedAndFilteredInvoices = invoicesQuery.data?.invoices
    ?.filter((invoice) =>
      statusFilter === "all" ? true : invoice.status === statusFilter
    )
    ?.sort((a, b) => {
      if (sortBy === "createdAt") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else {
        return a.status.localeCompare(b.status);
      }
    });

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status.toLowerCase()) {
      case "paid":
        return "default"; // Using default for paid (green-like in many themes)
      case "open":
        return "outline"; // Outline for open (neutral, visible)
      case "draft":
        return "secondary"; // Secondary for draft (subtle)
      case "void":
      case "uncollectible":
        return "destructive"; // Destructive for void/uncollectible (red)
      default:
        return "secondary";
    }
  };

  if (invoicesQuery.isLoading) {
    return (
      <section className="p-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-1/3 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-6" />
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3 mb-2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (invoicesQuery.error) {
    return (
      <section className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Invoice History</h2>
        <p className="text-red-500" role="alert">
          Error loading invoices: {(invoicesQuery.error as Error).message}
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => invoicesQuery.refetch()}
          aria-label="Retry loading invoices"
        >
          Retry
        </Button>
      </section>
    );
  }

  const { subscriptionId } = invoicesQuery.data || { invoices: [], subscriptionId: null };

  return (
    <section className="p-6 max-w-4xl mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl">Invoice History</CardTitle>
          <CardDescription>
            View and manage your billing history for Subscription ID:{" "}
            {subscriptionId || "N/A"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div>
              <label htmlFor="sortBy" className="text-sm font-medium mr-2">
                Sort by:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSortBy(e.target.value as "createdAt" | "status")
                }
                className="w-[180px] border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Sort invoices"
              >
                <option value="createdAt">Date (Newest First)</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div>
              <label htmlFor="statusFilter" className="text-sm font-medium mr-2">
                Filter by status:
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setStatusFilter(
                    e.target.value as "all" | "paid" | "open" | "draft" | "void" | "uncollectible"
                  )
                }
                className="w-[180px] border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter invoices by status"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="open">Open</option>
                <option value="draft">Draft</option>
                <option value="void">Void</option>
                <option value="uncollectible">Uncollectible</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {sortedAndFilteredInvoices?.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">No invoices found.</p>
            <Link to="/pricing">
              <Button variant="outline" aria-label="Explore subscription plans">
                Explore Subscription Plans
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedAndFilteredInvoices?.map((invoice) => (
            <Card
              key={invoice._id}
              className="hover:shadow-lg transition-shadow duration-200"
            >
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Invoice {invoice.stripeInvoiceId}</CardTitle>
                  <Badge
                    variant={getStatusBadgeVariant(invoice.status)}
                    aria-label={`Invoice status: ${invoice.status}`}
                  >
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                </div>
                <CardDescription>
                  Created on {dayjs(invoice.createdAt).format("MMMM D, YYYY")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <p>
                      <strong>Amount Paid:</strong> $
                      {(invoice.amountPaid || 0).toFixed(2)}{" "}
                      {invoice.currency.toUpperCase()}
                    </p>
                    <p>
                      {/* <strong>Amount Due:</strong> $
                      {(invoice.amountDue || 0).toFixed(2)}{" "}
                      {invoice.currency.toUpperCase()} */}
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
                  </div>
                  {invoice.lineItems && invoice.lineItems.length > 0 && (
                    <div>
                      <p className="font-medium mb-2">Items:</p>
                      <div className="border rounded-md">
                        <div className="grid grid-cols-4 gap-2 p-2 bg-gray-50 text-sm font-medium text-gray-700">
                          <div className="col-span-2">Product</div>
                          <div>Quantity</div>
                          <div>Amount</div>
                        </div>
                        <Separator />
                        {invoice.lineItems.map((item) => (
                          <div key={item._key}>
                            <div className="grid grid-cols-4 gap-2 p-2 text-sm">
                              <div className="col-span-2">
                                {item.productName}
                                {item.period.start && item.period.end && (
                                  <span className="block text-xs text-gray-500">
                                    {dayjs(item.period.start).format("MMM D, YYYY")} -{" "}
                                    {dayjs(item.period.end).format("MMM D, YYYY")}
                                  </span>
                                )}
                              </div>
                              <div>{item.quantity}</div>
                              <div>
                                ${(item.amount).toFixed(2)}{" "}
                                {item.currency.toUpperCase()}
                              </div>
                            </div>
                            <Separator />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    {invoice.invoiceUrl && (
                      <Button
                        variant="default"
                        onClick={() =>
                          invoice.invoiceUrl &&
                          window.open(invoice.invoiceUrl, "_blank")
                        }
                        aria-label={`View invoice ${invoice.stripeInvoiceId} online`}
                      >
                        View Invoice
                      </Button>
                    )}
                    {invoice.invoicePdf && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          invoice.invoicePdf &&
                          window.open(invoice.invoicePdf, "_blank")
                        }
                        aria-label={`Download PDF for invoice ${invoice.stripeInvoiceId}`}
                      >
                        Download PDF
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}