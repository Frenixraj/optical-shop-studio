
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Search, Trash2, Edit, Eye, Download, Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";

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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { findCustomers, deleteCustomer, getCustomerDetails } from "@/lib/db"; // Renamed function
import { exportCustomersToExcel } from "@/lib/excel";
import { cn } from "@/lib/utils";

// --- Zod Schema ---
const currentYear = new Date().getFullYear();
const searchSchema = z.object({
  phoneNumber: z.string().optional(), // Phone number is now optional
  searchDate: z.date().optional().nullable(),
  searchMonth: z.coerce.number().min(1).max(12).optional().nullable(), // Allow clearing
  searchYear: z.coerce.number().min(1900).max(currentYear + 5).optional().nullable(), // Allow clearing
}).refine(data => !!data.phoneNumber || !!data.searchDate || (!!data.searchMonth && !!data.searchYear), {
  message: "Please provide a phone number or select a date, or both month and year.",
  // Apply this validation at the root level or specific fields if needed
});
type SearchFormValues = z.infer<typeof searchSchema>;

// --- Data Types --- (Align with db.ts return types)
interface CustomerResult {
  id: number;
  name: string;
  phone: string;
  // Add relevant date field if possible from DB query (e.g., firstInvoiceDate)
  firstInvoiceDate?: Date | string | null;
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
      searchDate: null,
      searchMonth: null,
      searchYear: null,
    },
  });

  const onSubmit = async (data: SearchFormValues) => {
    setIsLoading(true);
    setSearchResults([]); // Clear previous results
    try {
       // Prepare search criteria
       const criteria: { phone?: string; date?: Date | null; month?: number | null; year?: number | null } = {};
       if (data.phoneNumber) criteria.phone = data.phoneNumber;
       if (data.searchDate) criteria.date = data.searchDate;
       if (data.searchMonth) criteria.month = data.searchMonth;
       if (data.searchYear) criteria.year = data.searchYear;

      const results = await findCustomers(criteria); // Use the updated function

      // Sort results by firstInvoiceDate if available (newest first)
       results.sort((a, b) => {
            const dateA = a.firstInvoiceDate ? new Date(a.firstInvoiceDate).getTime() : 0;
            const dateB = b.firstInvoiceDate ? new Date(b.firstInvoiceDate).getTime() : 0;
            return dateB - dateA; // Descending order
       });


      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: "No Results", description: "No customers found matching the criteria." });
      }
    } catch (error) {
      console.error("Search Error:", error);
      toast({ title: "Error", description: "Failed to search for customers.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

   const handleClearFilters = () => {
        form.reset({
            phoneNumber: "",
            searchDate: null,
            searchMonth: null,
            searchYear: null,
        });
        setSearchResults([]); // Also clear results
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
                // Sort invoices and transactions to get the latest/relevant ones
                const sortedInvoices = data.invoices?.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()) || [];
                const sortedTransactions = data.transactions?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
                const sortedPrescriptions = data.prescriptions?.sort((a, b) => new Date(b.prescriptionDate || 0).getTime() - new Date(a.prescriptionDate || 0).getTime()) || [];

                const latestInvoice = sortedInvoices[0];
                const latestTransaction = sortedTransactions[0];
                const latestPrescription = sortedPrescriptions[0];

                return {
                    id: data.id,
                    name: data.name,
                    phone: data.phone,
                    billNumber: latestInvoice?.billNumber,
                    dateTime: latestInvoice?.dateTime, // Use latest invoice date as primary date maybe?
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


  // Generate years for dropdown
  const years = Array.from({ length: currentYear - 1900 + 6 }, (_, i) => currentYear + 5 - i);
  const months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
    { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
    { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
    { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];


  return (
    <PageWrapper title="Search Customers">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Find Customer</CardTitle>
           <CardDescription>Search by phone number, specific date, or month/year.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Phone Number */}
                    <FormField
                        control={form.control}
                        name="phoneNumber"
                        render={({ field }) => (
                        <FormItem className="md:col-span-2">
                             <FormLabel>Phone Number (Optional)</FormLabel>
                            <FormControl>
                            <Input type="tel" placeholder="Enter customer phone number..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                     {/* Specific Date */}
                     <FormField
                        control={form.control}
                        name="searchDate"
                        render={({ field }) => (
                        <FormItem className="flex flex-col md:col-span-1">
                             <FormLabel>Specific Date (Optional)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div></div> {/* Spacer */}

                    {/* Month */}
                     <FormField
                        control={form.control}
                        name="searchMonth"
                        render={({ field }) => (
                        <FormItem className="md:col-span-1">
                             <FormLabel>Month (Optional)</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} value={field.value?.toString() ?? ""}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                     {/* Remove SelectItem with value="" */}
                                    {months.map(m => (
                                        <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    {/* Year */}
                    <FormField
                        control={form.control}
                        name="searchYear"
                        render={({ field }) => (
                        <FormItem className="md:col-span-1">
                             <FormLabel>Year (Required with Month)</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : null)} value={field.value?.toString() ?? ""}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {/* Remove SelectItem with value="" */}
                                    {years.map(y => (
                                        <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    {/* Search and Clear Buttons */}
                    <div className="flex items-end gap-2 md:col-span-2">
                        <Button type="submit" disabled={isLoading} className="flex-grow sm:flex-grow-0">
                            <Search className="mr-2 h-5 w-5" />
                            {isLoading ? "Searching..." : "Search"}
                        </Button>
                         <Button type="button" variant="outline" onClick={handleClearFilters} disabled={isLoading}>
                            <X className="mr-2 h-4 w-4" /> Clear
                        </Button>
                    </div>
                 </div>
                  {/* Display root level errors */}
                 {form.formState.errors.root && (
                    <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
                )}
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
            <CardTitle>Search Results ({searchResults.length})</CardTitle>
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
                  <TableHead>First Invoice Date</TableHead> {/* Added Date Column */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>{customer.id}</TableCell>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                     <TableCell>
                        {customer.firstInvoiceDate
                            ? format(new Date(customer.firstInvoiceDate), "PPP")
                            : 'N/A'
                        }
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                       <Button variant="ghost" size="icon" onClick={() => handleViewDetails(customer.id)} className="text-blue-600 hover:text-blue-800 h-8 w-8" title="View Details">
                           <Eye className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" onClick={() => handleEdit(customer.id)} className="text-yellow-600 hover:text-yellow-800 h-8 w-8" title="Edit Customer">
                           <Edit className="h-4 w-4" />
                       </Button>
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" disabled={isDeleting === customer.id} className="text-destructive hover:bg-destructive/10 h-8 w-8" title="Delete Customer">
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
            </Table>
          </CardContent>
        </Card>
      )}

      {!isLoading && form.formState.isSubmitted && searchResults.length === 0 && (
         <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No customers found matching the specified criteria.
            </CardContent>
         </Card>
      )}
    </PageWrapper>
  );
}


    