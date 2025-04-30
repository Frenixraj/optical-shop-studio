"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Edit, Trash2 } from "lucide-react";

import useAuth from '@/hooks/useAuth';
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getCustomerDetails, deleteCustomer } from "@/lib/db"; // Placeholder DB functions
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge"; // Import Badge

// Define interfaces for the detailed data
interface ProductDetail {
  invoiceId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface InvoiceDetail {
  invoiceId: number;
  customerId: number;
  billNumber: string;
  dateTime: Date;
  discount: number;
  netPrice: number;
  advanceAmount: number;
  balanceAmount: number;
  products?: ProductDetail[];
}

interface PrescriptionDetail {
  customerId: number;
  sph_re: number | null;
  cyl_re: number | null;
  axis_re: number | null;
  add_re: number | null;
  pd_re: number | null;
  sph_le: number | null;
  cyl_le: number | null;
  axis_le: number | null;
  add_le: number | null;
  pd_le: number | null;
   // Add a date field if prescriptions are timestamped in your DB
   prescriptionDate?: Date;
}

interface TransactionDetail {
  customerId: number;
  date: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
}

interface CustomerFullDetails {
  id: number;
  name: string;
  phone: string;
  prescriptions?: PrescriptionDetail[];
  invoices?: InvoiceDetail[];
  transactions?: TransactionDetail[];
}

export default function ViewCustomerPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = parseInt(params.id as string, 10);
  const { toast } = useToast();
  const [customerData, setCustomerData] = React.useState<CustomerFullDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!customerId) {
        toast({ title: "Error", description: "Invalid customer ID.", variant: "destructive" });
        router.push('/search-customers');
        return;
      }
      setIsLoading(true);
      try {
        const data = await getCustomerDetails(customerId);
        if (!data) {
          toast({ title: "Not Found", description: "Customer not found.", variant: "destructive" });
          router.push('/search-customers');
        } else {
          // Process dates correctly
           const processedData = {
                ...data,
                prescriptions: data.prescriptions?.map(p => ({ ...p, prescriptionDate: p.prescriptionDate ? new Date(p.prescriptionDate) : undefined })) || [],
                invoices: data.invoices?.map(inv => ({ ...inv, dateTime: new Date(inv.dateTime) })) || [],
                transactions: data.transactions?.map(t => ({ ...t, date: new Date(t.date) })) || [],
           };
          setCustomerData(processedData as CustomerFullDetails); // Cast after processing
        }
      } catch (error) {
        console.error("Failed to fetch customer details:", error);
        toast({ title: "Error", description: "Could not load customer data.", variant: "destructive" });
        router.push('/search-customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, router, toast]);

   const handleDeleteCustomer = async () => {
        setIsDeleting(true);
        try {
            await deleteCustomer(customerId);
            toast({ title: "Success", description: "Customer deleted successfully." });
            router.push('/search-customers');
        } catch (error) {
            console.error("Delete Error:", error);
            toast({ title: "Error", description: "Failed to delete customer.", variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

  if (isLoading) {
    return (
      <PageWrapper title="Loading Customer Details...">
        <div className="space-y-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-10 w-full" /></CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
           <Card>
            <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
            <CardContent><Skeleton className="h-32 w-full" /></CardContent>
          </Card>
        </div>
      </PageWrapper>
    );
  }

  if (!customerData) {
     // This case should ideally be handled by the redirect in useEffect, but added for safety
      return <PageWrapper title="Customer Not Found"></PageWrapper>;
  }

  return (
    <PageWrapper title={`Details for ${customerData.name}`}>
      <div className="space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Customer Information</CardTitle>
                <CardDescription>ID: {customerData.id}</CardDescription>
            </div>
            <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={() => router.push(`/edit-customer/${customerId}`)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit
                 </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" size="sm" disabled={isDeleting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action is permanent. Are you sure you want to delete this customer and all associated data?
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteCustomer} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><span className="font-semibold">Name:</span> {customerData.name}</div>
            <div><span className="font-semibold">Phone:</span> {customerData.phone}</div>
          </CardContent>
        </Card>

        {/* Prescription History */}
         {customerData.prescriptions && customerData.prescriptions.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Prescription History</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            {/* Optional: Add Date if available */}
                            {/* <TableHead>Date</TableHead> */}
                            <TableHead className="text-center">Eye</TableHead>
                            <TableHead className="text-center">SPH</TableHead>
                            <TableHead className="text-center">CYL</TableHead>
                            <TableHead className="text-center">Axis</TableHead>
                            <TableHead className="text-center">Add</TableHead>
                            <TableHead className="text-center">PD</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {customerData.prescriptions.map((p, index) => (
                            <React.Fragment key={`pres-${index}`}>
                                <TableRow>
                                    {/* {p.prescriptionDate && <TableCell rowSpan={2}>{format(p.prescriptionDate, "PP")}</TableCell>} */}
                                    <TableCell className="font-semibold text-center">RE</TableCell>
                                    <TableCell className="text-center">{p.sph_re?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.cyl_re?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.axis_re ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.add_re?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.pd_re?.toFixed(1) ?? '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                     {/* {!p.prescriptionDate && <TableCell></TableCell>} Placeholder if no date */}
                                    <TableCell className="font-semibold text-center">LE</TableCell>
                                    <TableCell className="text-center">{p.sph_le?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.cyl_le?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.axis_le ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.add_le?.toFixed(2) ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.pd_le?.toFixed(1) ?? '-'}</TableCell>
                                </TableRow>
                                {index < customerData.prescriptions!.length - 1 && (
                                     <TableRow><TableCell colSpan={7} className="p-0"><hr className="my-2 border-border"/></TableCell></TableRow> // Separator
                                )}
                            </React.Fragment>
                        ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
         )}

        {/* Invoice History */}
        {customerData.invoices && customerData.invoices.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Invoice History</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {customerData.invoices.map((invoice) => (
                        <Card key={invoice.invoiceId} className="bg-muted/50">
                            <CardHeader className="flex flex-row justify-between items-start pb-2">
                                <div>
                                    <CardTitle className="text-lg">{invoice.billNumber}</CardTitle>
                                    <CardDescription>{format(invoice.dateTime, "PPP p")}</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => router.push(`/print?invoiceId=${invoice.invoiceId}&customerId=${customerId}`)}>
                                    View/Print
                                </Button>
                            </CardHeader>
                            <CardContent className="pt-2">
                                {invoice.products && invoice.products.length > 0 && (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                                <TableHead className="text-right">Qty</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {invoice.products.map((prod, idx) => (
                                                <TableRow key={`${invoice.invoiceId}-prod-${idx}`}>
                                                    <TableCell>{prod.name}</TableCell>
                                                    <TableCell className="text-right">{prod.price.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">{prod.quantity}</TableCell>
                                                    <TableCell className="text-right">{prod.total.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                                <div className="grid grid-cols-2 gap-x-4 mt-4 pt-4 border-t">
                                    <div className="text-right font-semibold">Discount:</div>
                                    <div className="text-right">{invoice.discount.toFixed(2)}</div>
                                    <div className="text-right font-semibold">Net Price:</div>
                                    <div className="text-right">{invoice.netPrice.toFixed(2)}</div>
                                    <div className="text-right font-semibold">Advance Paid:</div>
                                    <div className="text-right">{invoice.advanceAmount.toFixed(2)}</div>
                                    <div className="text-right font-semibold">Balance Due:</div>
                                    <div className="text-right font-semibold">{invoice.balanceAmount.toFixed(2)}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>
        )}

        {/* Transaction History */}
        {customerData.transactions && customerData.transactions.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Transaction History</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customerData.transactions.map((t, index) => (
                                <TableRow key={`txn-${index}`}>
                                    <TableCell>{format(t.date, "PP")}</TableCell>
                                    <TableCell>{t.description}</TableCell>
                                    <TableCell>
                                        <Badge variant={t.type === 'credit' ? 'default' : 'secondary'} className={t.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                            {t.type === 'credit' ? 'Credit' : 'Debit'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-medium ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                                       {t.type === 'credit' ? '+' : '-'}{t.amount.toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableCaption>Overview of financial transactions.</TableCaption>
                    </Table>
                </CardContent>
            </Card>
        )}

      </div>
    </PageWrapper>
  );
}
