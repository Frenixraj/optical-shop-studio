
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
// Import Firestore functions and types
import { findCustomers, deleteCustomer, getCustomerDetails, CustomerSearchResult, FullCustomerData } from "@/lib/db";
// Excel export needs adjustment
import { exportCustomersToExcel } from "@/lib/excel";
import { cn } from "@/lib/utils";

// --- Zod Schema ---
const currentYear = new Date().getFullYear();
const searchSchema = z.object({
  phoneNumber: z.string().optional(), // Phone number is now optional
  searchDate: z.date().optional().nullable(),
  searchMonth: z.coerce.number().min(1).max(12).optional().nullable(), // Allow clearing
  searchYear: z.coerce.number().min(1900).max(currentYear + 5).optional().nullable(), // Allow clearing
}).refine(data => !!data.phoneNumber || !!data.searchDate || (!!data.searchMonth && !!data.searchYear) || !!data.searchYear, { // Allow searching by just year too
  message: "Please provide a phone number or select a date, or month/year combination.",
  // Apply this validation at the root level or specific fields if needed
});
type SearchFormValues = z.infer<typeof searchSchema>;

// --- Data Types ---
// CustomerSearchResult is imported from db.ts

// Interface for Excel export data (might need adjustment based on export lib)
interface FullCustomerDataForExcel {
   id: string; // Firestore ID
    name: string;
    phone: string;
    billNumber?: string;
    dateTime?: Date; // Already Date object
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
    // lastTransactionDate?: Date; // Transactions removed
    // lastTransactionAmount?: number;
    // lastTransactionType?: string;
    createdAt?: Date; // Include creation date
}


// --- Component ---
export default function SearchCustomersPage() {
  useAuth(); // Protect the route
  const router = useRouter();
  const { toast } = useToast();
  const [searchResults, setSearchResults] = React.useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null); // Store string ID of customer being deleted
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
       // Prepare search criteria (pass directly to Firestore function)
       const criteria = {
           phone: data.phoneNumber || undefined, // Pass undefined if empty
           date: data.searchDate,
           month: data.searchMonth,
           year: data.searchYear
       };

      const results = await findCustomers(criteria); // Use the updated Firestore function

      setSearchResults(results);
      if (results.length === 0) {
        toast({ title: "No Results", description: "No customers found matching the criteria." });
      }
    } catch (error) {
      console.error("Search Error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Error", description: `Failed to search for customers: ${errorMessage}`, variant: "destructive" });
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

  const handleDelete = async (customerId: string) => {
    setIsDeleting(customerId);
    try {
      await deleteCustomer(customerId); // Use Firestore delete function
      setSearchResults(prevResults => prevResults.filter(customer => customer.id !== customerId));
      toast({ title: "Success", description: "Customer deleted successfully." });
    } catch (error) {
      console.error("Delete Error:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Error", description: `Failed to delete customer: ${errorMessage}`, variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (customerId: string) => {
    router.push(`/edit-customer/${customerId}`);
  };

   const handleViewDetails = (customerId: string) => {
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
          // Note: This can be inefficient for large result sets. Consider server-side generation or pagination.
          const fullDataPromises = searchResults.map(customer => getCustomerDetails(customer.id));
          const fullDataResults = await Promise.all(fullDataPromises);

          const excelData: FullCustomerDataForExcel[] = fullDataResults
            .filter((data): data is NonNullable<FullCustomerData> => data !== null) // Type guard and filter nulls
            .map(data => {
                // Sort invoices and prescriptions to get the latest/relevant ones
                const sortedInvoices = data.invoices?.sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()) || [];
                // const sortedTransactions = data.transactions?.sort((a, b) => b.date.getTime() - a.date.getTime()) || []; // Transactions removed
                const sortedPrescriptions = data.prescriptions?.sort((a, b) => (b.prescriptionDate?.getTime() ?? 0) - (a.prescriptionDate?.getTime() ?? 0)) || [];

                const latestInvoice = sortedInvoices[0];
                // const latestTransaction = sortedTransactions[0]; // Transactions removed
                const latestPrescription = sortedPrescriptions[0];

                return {
                    id: data.id,
                    name: data.name,
                    phone: data.phone,
                    createdAt: data.createdAt, // Include creation date
                    billNumber: latestInvoice?.billNumber,
                    dateTime: latestInvoice?.dateTime, // Use latest invoice date
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
                    // Transaction fields removed
                };
            });


          await exportCustomersToExcel(excelData as any); // Call the bulk export function, adjust type if needed
          toast({ title: "Export Started", description: "Customer data export to Excel has started." });
      } catch (error) {
          console.error("Export Error:", error);
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          toast({ title: "Error", description: `Failed to export customer data: ${errorMessage}`, variant: "destructive" });
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
           <CardDescription>Search by phone, specific date, month/year, or just year.</CardDescription>
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
                        <FormItem className="flex flex-col md:col-span-1 pt-2"> {/* Adjusted alignment */}
                             <FormLabel>Specific Date (Optional)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
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
                                    onSelect={(date) => {
                                        field.onChange(date);
                                        // Optionally clear month/year if a specific date is selected
                                        // form.setValue('searchMonth', null);
                                        // form.setValue('searchYear', null);
                                    }}
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
                            <Select onValueChange={(value) => {
                                field.onChange(value ? parseInt(value) : null);
                                // Clear specific date if month/year is selected
                                // form.setValue('searchDate', null);
                                }} value={field.value?.toString() ?? ""}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Month" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {/* Add an item to clear selection */}
                                    <SelectItem value="clear" className="text-muted-foreground">Clear Month</SelectItem>
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
                             <FormLabel>Year (Optional)</FormLabel>
                            <Select onValueChange={(value) => {
                                field.onChange(value ? parseInt(value) : null);
                                // Clear specific date if month/year is selected
                                // form.setValue('searchDate', null);
                                }} value={field.value?.toString() ?? ""}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Year" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {/* Add an item to clear selection */}
                                    <SelectItem value="clear" className="text-muted-foreground">Clear Year</SelectItem>
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
                  {/* <TableHead>ID</TableHead> */} {/* Hide Firestore ID maybe? */}
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>First Activity Date</TableHead> {/* Renamed Column */}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {searchResults.map((customer) => (
                  <TableRow key={customer.id}>
                    {/* <TableCell className="text-xs text-muted-foreground">{customer.id}</TableCell> */}
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone}</TableCell>
                     <TableCell>
                        {customer.firstInvoiceDate
                            ? format(customer.firstInvoiceDate, "PPP") // Already a Date object
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
                                  This action cannot be undone. This will permanently delete the customer and all associated data (prescriptions, invoices).
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
               <TableCaption>Customers sorted by most recent activity first.</TableCaption>
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
