"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Search, Trash2, Edit, Eye, Download } from "lucide-react";

import useAuth from '@/hooks/useAuth';
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/ui/skeleton"; // For loading state
import { findCustomersByPhone, deleteCustomer, getCustomerDetails } from "@/lib/db"; // Placeholder DB functions
import { exportCustomersToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema ---
const searchSchema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required").regex(/^\d+$/, "Phone number must contain only digits"),
});
type SearchFormValues = z.infer<typeof searchSchema>;

// --- Data Types --- (Align with db.ts return types)
interface CustomerResult {
  id: number;
  name: string;
  phone: string;
  // Potentially add last bill date or other summary info if needed
}

interface FullCustomerDataForExcel {
   id: number;
    name: string;
    phone: string;
    billNumber?: string;
    dateTime?: Date;
    sph_re?: number | null;
    cyl_re?: number | null;
    axis_re?: number | null;
    add_re?: number | null;
    pd_re?: number | null;
    sph_le?: number | null;
    cyl_le?: number | null;
    axis_le?: number | null;
    add_le?: number | null;
    pd_le?: number | null;
    products?: string; // Combined product string
    discount?: number;
    netPrice?: number;
    advanceAmount?: number;
    balanceAmount?: number;
    lastTransactionDate?: Date;
    lastTransactionAmount?: number;
    lastTransactionType?: string;
}


// --- Component ---
export default function SearchCustomersPage() {
  useAuth(); // Protect the route
  const router = useRouter();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = React.useState<CustomerResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<number | null>(null); // Store ID of customer being deleted
  const [isExporting, setIsExporting] = React.useState(false);

  const form = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      phoneNumber: "",
    },
  });

  const onSubmit = async (data: SearchFormValues) => {
    setIsLoading(true);
    setSearchResults([]); // Clear previous results
    try {
      const results = await findCustomersByPhone(data.phoneNumber);
      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: "No Results", description: "No customers found with that phone number." });
      }
    } catch (error) {
      console.error("Search Error:", error);
      toast({ title: "Error", description: "Failed to search for customers.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (customerId: number) => {
    setIsDeleting(customerId);
    try {
      await deleteCustomer(customerId);
      setSearchResults(prevResults => prevResults.filter(customer => customer.id !== customerId));
      toast({ title: "Success", description: "Customer deleted successfully." });
    } catch (error) {
      console.error("Delete Error:", error);
      toast({ title: "Error", description: "Failed to delete customer.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (customerId: number) => {
    router.push(`/edit-customer/${customerId}`);
  };

   const handleViewDetails = (customerId: number) => {
    // Navigate to a dedicated view page or open a modal
    router.push(`/view-customer/${customerId}`);
  };

  const handleExportAll = async () => {
      if (searchResults.length === 0) {
          toast({ title: "No Data", description: "Cannot export empty search results." });
          return;
      }

      setIsExporting(true);
      try {
          // Fetch full details for all customers in the search results
          const fullDataPromises = searchResults.map(customer => getCustomerDetails(customer.id));
          const fullDataResults = await Promise.all(fullDataPromises);

          const excelData: FullCustomerDataForExcel[] = fullDataResults
            .filter((data): data is NonNullable<Awaited<ReturnType<typeof getCustomerDetails>>> => data !== null) // Type guard and filter nulls
            .map(data => {
                const latestInvoice = data.invoices?.[0]; // Assuming sorted by date desc in DB query
                const latestTransaction = data.transactions?.[0]; // Assuming sorted by date desc
                const latestPrescription = data.prescriptions?.[0]; // Assuming sorted

                return {
                    id: data.id,
                    name: data.name,
                    phone: data.phone,
                    billNumber: latestInvoice?.billNumber,
                    dateTime: latestInvoice?.dateTime, // Could be invoice date or customer add date
                    sph_re: latestPrescription?.sph_re,
                    cyl_re: latestPrescription?.cyl_re,
                    axis_re: latestPrescription?.axis_re,
                    add_re: latestPrescription?.add_re,
                    pd_re: latestPrescription?.pd_re,
                    sph_le: latestPrescription?.sph_le,
                    cyl_le: latestPrescription?.cyl_le,
                    axis_le: latestPrescription?.axis_le,
                    add_le: latestPrescription?.add_le,
                    pd_le: latestPrescription?.pd_le,
                    products: latestInvoice?.products?.map(p => `${p.name} (Qty: ${p.quantity})`).join('; ') ?? '',
                    discount: latestInvoice?.discount,
                    netPrice: latestInvoice?.netPrice,
                    advanceAmount: latestInvoice?.advanceAmount,
                    balanceAmount: latestInvoice?.balanceAmount,
                    lastTransactionDate: latestTransaction?.date,
                    lastTransactionAmount: latestTransaction?.amount,
                    lastTransactionType: latestTransaction?.type,
                };
            });


          await exportCustomersToExcel(excelData); // Call the bulk export function
          toast({ title: "Export Started", description: "Customer data export to Excel has started." });
      } catch (error) {
          console.error("Export Error:", error);
          toast({ title: "Error", description: "Failed to export customer data.", variant: "destructive" });
      } finally {
          setIsExporting(false);
      }
  };


  return (
    <PageWrapper title="Search Customers">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Find Customer by Phone</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col sm:flex-row items-start gap-4">
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="flex-grow w-full">
                    <FormControl>
                      <Input type="tel" placeholder="Enter customer phone number..." {...field} className="text-lg"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                <Search className="mr-2 h-5 w-5" />
                {isLoading ? "Searching..." : "Search"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
         <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/4" />
            </CardHeader>
             <CardContent>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
             </CardContent>
         </Card>
      )}

      {!isLoading && searchResults.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Search Results</CardTitle>
             <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAll}
                  disabled={isExporting}
             >
                  <Download className="mr-2 h-4 w-4" />
                  {isExporting ? "Exporting..." : "Export Results"}
              </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.id}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell className="text-right space-x-2">
                       <Button variant="ghost" size="icon" onClick={() => handleViewDetails(customer.id)} className="text-blue-600 hover:text-blue-800" title="View Details">
                           <Eye className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleEdit(customer.id)} className="text-yellow-600 hover:text-yellow-800" title="Edit Customer">
                           <Edit className="h-4 w-4" />
                       </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" disabled={isDeleting === customer.id} className="text-destructive hover:bg-destructive/10" title="Delete Customer">
                                {isDeleting === customer.id ? <Trash2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the customer and all associated data (prescriptions, invoices, transactions).
                              </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                              <AlertDialogCancel disabled={isDeleting === customer.id}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                  onClick={() => handleDelete(customer.id)}
                                  disabled={isDeleting === customer.id}
                                  className="bg-destructive hover:bg-destructive/90"
                               >
                                  {isDeleting === customer.id ? "Deleting..." : "Delete"}
                              </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                       </AlertDialog>

                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
               <TableCaption>Found {searchResults.length} customer(s).</TableCaption>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isLoading && searchResults.length === 0 && form.formState.isSubmitted && (
         <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No customers found matching the provided phone number.
            </CardContent>
         </Card>
      )}
    </PageWrapper>
  );
}
