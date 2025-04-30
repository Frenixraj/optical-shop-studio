
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Edit, Trash2, Printer } from "lucide-react"; // Added Printer

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
// Import Firestore functions and types
import { getCustomerDetails, deleteCustomer, FullCustomerData, PrescriptionDetail, InvoiceDetail } from "@/lib/db";
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
// Badge not currently used, can be removed if not needed later
// import { Badge } from "@/components/ui/badge";

// Interfaces for detailed data are imported from db.ts

export default function ViewCustomerPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string; // Firestore ID is string
  const { toast } = useToast();
  const [customerData, setCustomerData] = React.useState<FullCustomerData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!customerId) { // Basic check for non-empty ID
        toast({ title: "Error", description: "Invalid customer ID provided.", variant: "destructive" });
        router.push('/search-customers');
        return;
      }
      setIsLoading(true);
      try {
        // Fetch data using Firestore function
        const data: FullCustomerData | null = await getCustomerDetails(customerId);
        if (!data) {
          toast({ title: "Not Found", description: "Customer not found.", variant: "destructive" });
          router.push('/search-customers');
        } else {
          // Data from getCustomerDetails should already have Dates converted
          setCustomerData(data);
        }
      } catch (error) {
        console.error("Failed to fetch customer details:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Error", description: `Could not load customer data: ${errorMessage}`, variant: "destructive" });
        router.push('/search-customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, router, toast]); // customerId is string

   const handleDeleteCustomer = async () => {
        if (!customerId) return; // Safety check
        setIsDeleting(true);
        try {
            await deleteCustomer(customerId); // Use Firestore delete
            toast({ title: "Success", description: "Customer deleted successfully." });
            router.push('/search-customers');
        } catch (error) {
            console.error("Delete Error:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            toast({ title: "Error", description: `Failed to delete customer: ${errorMessage}`, variant: "destructive" });
        } finally {
            setIsDeleting(false);
        }
    };

     const handlePrintInvoice = (invoiceId: string) => {
        if (!customerId) return;
        router.push(`/print?invoiceId=${invoiceId}&customerId=${customerId}`);
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
      return <PageWrapper title="Customer Not Found">
          <p className="text-center text-muted-foreground">The requested customer could not be found.</p>
          <div className="text-center mt-4">
             <Button onClick={() => router.push('/search-customers')}>Go to Search</Button>
          </div>
      </PageWrapper>;
  }

  // Filter out placeholder invoices created during 'Add Customer'
   const validInvoices = customerData.invoices?.filter(inv => !inv.billNumber.startsWith('CUST_ADD_')) || [];
   const sortedPrescriptions = customerData.prescriptions?.sort((a, b) => (b.prescriptionDate?.getTime() ?? 0) - (a.prescriptionDate?.getTime() ?? 0)) || [];
   const sortedValidInvoices = validInvoices.sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime());

  return (
    <PageWrapper title={`Details for ${customerData.name}`}>
      <div className="space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Customer Information</CardTitle>
                {/* <CardDescription>ID: {customerData.id}</CardDescription> */}
                 <CardDescription>
                    Customer Since: {customerData.createdAt ? format(customerData.createdAt, 'PPP') : 'N/A'}
                 </CardDescription>
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
                            This action is permanent. Are you sure you want to delete this customer and all associated data (prescriptions, invoices)?
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
         {sortedPrescriptions.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Prescription History</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                             {/* Add Date column only if dates exist */}
                             {sortedPrescriptions.some(p => p.prescriptionDate) && <TableHead>Date</TableHead>}
                            <TableHead className="text-center">Eye</TableHead>
                            <TableHead className="text-center">SPH</TableHead>
                            <TableHead className="text-center">CYL</TableHead>
                            <TableHead className="text-center">Axis</TableHead>
                            <TableHead className="text-center">Add</TableHead>
                            <TableHead className="text-center">PD</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {sortedPrescriptions.map((p, index) => (
                            <React.Fragment key={p.id}> {/* Use prescription ID */}
                                <TableRow>
                                     {/* Add rowspan only if date column exists */}
                                     {sortedPrescriptions.some(pr => pr.prescriptionDate) && (
                                          <TableCell rowSpan={2} className="align-top pt-4">
                                             {p.prescriptionDate ? format(p.prescriptionDate, "PP") : 'N/A'}
                                          </TableCell>
                                     )}
                                    <TableCell className="font-semibold text-center">RE</TableCell>
                                    <TableCell className="text-center">{p.sph_re != null ? Number(p.sph_re).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.cyl_re != null ? Number(p.cyl_re).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.axis_re ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.add_re != null ? Number(p.add_re).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.pd_re != null ? Number(p.pd_re).toFixed(1) : '-'}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="font-semibold text-center">LE</TableCell>
                                    <TableCell className="text-center">{p.sph_le != null ? Number(p.sph_le).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.cyl_le != null ? Number(p.cyl_le).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.axis_le ?? '-'}</TableCell>
                                    <TableCell className="text-center">{p.add_le != null ? Number(p.add_le).toFixed(2) : '-'}</TableCell>
                                    <TableCell className="text-center">{p.pd_le != null ? Number(p.pd_le).toFixed(1) : '-'}</TableCell>
                                </TableRow>
                                {/* Add separator between different prescription entries */}
                                {index < sortedPrescriptions.length - 1 && (
                                    <TableRow>
                                      <TableCell
                                        colSpan={sortedPrescriptions.some(pr => pr.prescriptionDate) ? 7 : 6} // Adjust colspan based on date column presence
                                        className="p-0 h-2"
                                      >
                                        <div className="border-t border-muted my-2"></div>
                                      </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                        </TableBody>
                         <TableCaption>Prescriptions sorted by date (latest first).</TableCaption>
                    </Table>
                </CardContent>
            </Card>
         )}

        {/* Invoice History */}
         {sortedValidInvoices.length > 0 && (
            <Card>
                <CardHeader><CardTitle>Invoice History</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {sortedValidInvoices.map((invoice) => (
                        <Card key={invoice.invoiceId} className="bg-muted/50"> {/* Use invoice ID */}
                            <CardHeader className="flex flex-row justify-between items-start pb-2">
                                <div>
                                    <CardTitle className="text-lg">{invoice.billNumber}</CardTitle>
                                    <CardDescription>{format(invoice.dateTime, "PPP p")}</CardDescription>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => handlePrintInvoice(invoice.invoiceId)}>
                                     <Printer className="mr-2 h-4 w-4" /> View/Print
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
                                            {invoice.products.map((prod) => (
                                                <TableRow key={prod.id}> {/* Use product ID */}
                                                    <TableCell>{prod.name}</TableCell>
                                                    <TableCell className="text-right">{(Number(prod.price) || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">{Number(prod.quantity) || 0}</TableCell>
                                                    <TableCell className="text-right">{(Number(prod.total) || 0).toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                                <div className="grid grid-cols-2 gap-x-4 mt-4 pt-4 border-t">
                                    <div className="text-right font-semibold">Discount:</div>
                                    <div className="text-right">{(Number(invoice.discount) || 0).toFixed(2)}</div>
                                    <div className="text-right font-semibold">Net Price:</div>
                                    <div className="text-right">{(Number(invoice.netPrice) || 0).toFixed(2)}</div>
                                    <div className="text-right font-semibold">Advance Paid:</div>
                                    <div className="text-right">{(Number(invoice.advanceAmount) || 0).toFixed(2)}</div>
                                    <div className="text-right font-semibold">Balance Due:</div>
                                    <div className="text-right font-semibold">{(Number(invoice.balanceAmount) || 0).toFixed(2)}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
                 <CardFooter>
                    <p className="text-xs text-muted-foreground">Showing valid invoices (excluding initial customer add records), sorted by date.</p>
                 </CardFooter>
            </Card>
        )}

      </div> {/* This closing div matches the one after <PageWrapper> */}
    </PageWrapper>
  );
}
