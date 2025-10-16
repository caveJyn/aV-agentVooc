// client/src/components/invoice-history.tsx
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs"; // Use dayjs instead of date-fns

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

  if (invoicesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        <p>Loading invoices...</p>
      </div>
    );
  }

  if (invoicesQuery.error) {
    return (
      <div className="p-4">
        <p className="text-red-500">
          Error loading invoices: {(invoicesQuery.error as Error).message}
        </p>
      </div>
    );
  }

  const { invoices, subscriptionId } = invoicesQuery.data || { invoices: [], subscriptionId: null };

  return (
    <section className="p-4">
      <h2 className="text-2xl font-bold mb-4">Invoice History</h2>
      <p>
        <strong>Subscription ID:</strong> {subscriptionId || "N/A"}
      </p>
      {invoices.length === 0 ? (
        <p>No invoices found.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {invoices.map((invoice) => (
            <Card key={invoice._id}>
              <CardHeader>
                <CardTitle>Invoice {invoice.stripeInvoiceId}</CardTitle>
              </CardHeader>
              <CardContent>
  <p><strong>Status:</strong> {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</p>
  <p><strong>Amount Due:</strong> ${(invoice.amountDue || 0).toFixed(2)} {invoice.currency.toUpperCase()}</p>
  <p><strong>Amount Paid:</strong> ${(invoice.amountPaid || 0).toFixed(2)} {invoice.currency.toUpperCase()}</p>
  <p><strong>Created:</strong> {dayjs(invoice.createdAt).format("MMMM D, YYYY")}</p>
  {invoice.dueDate && (
    <p><strong>Due Date:</strong> {dayjs(invoice.dueDate).format("MMMM D, YYYY")}</p>
  )}
  {invoice.periodStart && invoice.periodEnd && (
    <p><strong>Billing Period:</strong> {dayjs(invoice.periodStart).format("MMMM D, YYYY")} - {dayjs(invoice.periodEnd).format("MMMM D, YYYY")}</p>
  )}
  {invoice.lineItems && invoice.lineItems.length > 0 && (
    <div className="mt-2">
      <p><strong>Items:</strong></p>
      <ul className="list-disc pl-5">
        {invoice.lineItems.map((item, index) => (
          <li key={index}>
            {item.productName} - {item.quantity} x ${(item.amount).toFixed(2)} {item.currency.toUpperCase()}
            {item.period.start && item.period.end && (
              <span> ({dayjs(item.period.start).format("MMM D, YYYY")} - {dayjs(item.period.end).format("MMM D, YYYY")})</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )}
  {invoice.invoiceUrl && (
    <Button
      variant="link"
      className="mt-2"
      onClick={() => invoice.invoiceUrl && window.open(invoice.invoiceUrl, "_blank")}
    >
      View Invoice
    </Button>
  )}
  {invoice.invoicePdf && (
    <Button
      variant="link"
      className="mt-2 ml-2"
      onClick={() => invoice.invoicePdf && window.open(invoice.invoicePdf, "_blank")}
    >
      Download PDF
    </Button>
  )}
</CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}