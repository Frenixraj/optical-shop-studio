"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Trash2, PlusCircle, Loader2 } from "lucide-react";

import useAuth from '@/hooks/useAuth';
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerDetails, updateCustomer, savePrescription, saveTransaction, deleteCustomer } from "@/lib/db"; // Assuming updateCustomer exists
import { exportCustomerToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema Definition ---
// Reusing schemas from add-customer, adding ID for context
const transactionSchema = z.object({
    // id: z.number().optional(), // Optional: ID if editing existing transactions
    date: z.date({ required_error: "Date is required." }),
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    type: z.enum(["credit", "debit"], { required_error: "Transaction type is required." }),
});

const customerSchema = z.object({
  id: z.number(), // Keep track of the customer ID being edited
  dateTime: z.date({ required_error: "Date is required." }),
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),

  // Power Details (Optional)
  sph_re: z.coerce.number().optional().nullable(),
  cyl_re: z.coerce.number().optional().nullable(),
  axis_re: z.coerce.number().optional().nullable(),
  add_re: z.coerce.number().optional().nullable(),
  pd_re: z.coerce.number().optional().nullable(),
  sph_le: z.coerce.number().optional().nullable(),
  cyl_le: z.coerce.number().optional().nullable(),
  axis_le: z.coerce.number().optional().nullable(),
  add_le: z.coerce.number().optional().nullable(),
  pd_le: z.coerce.number().optional().nullable(),

  // Financial Transactions (Optional)
  transactions: z.array(transactionSchema).optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// --- Component ---

export default function EditCustomerPage() {
  useAuth();
  const router = useRouter();
  const params = useParams();
  const customerId = parseInt(params.id as string, 10);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [formDataForConfirmation, setFormDataForConfirmation] = React.useState<CustomerFormValues | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: async () => {
        if (!customerId) {
            toast({ title: "Error", description: "Invalid customer ID.", variant: "destructive" });
            router.push('/search-customers');
            return { id: NaN, dateTime: new Date(), customerName: '', phoneNumber: '', transactions: [] }; // Return default structure on error
        }
        try {
            const customerData = await getCustomerDetails(customerId);
            if (!customerData) {
                toast({ title: "Not Found", description: "Customer not found.", variant: "destructive" });
                router.push('/search-customers');
                return { id: customerId, dateTime: new Date(), customerName: '', phoneNumber: '', transactions: [] };
            }
            // Assuming prescription and transactions are fetched
            const latestPrescription = customerData.prescriptions?.[0]; // Assuming latest if multiple
            setIsLoading(false);
            return {
                id: customerData.id,
                dateTime: customerData.invoices?.[0]?.dateTime || new Date(), // Use invoice date or fallback
                customerName: customerData.name,
                phoneNumber: customerData.phone,
                sph_re: latestPrescription?.sph_re ?? null,
                cyl_re: latestPrescription?.cyl_re ?? null,
                axis_re: latestPrescription?.axis_re ?? null,
                add_re: latestPrescription?.add_re ?? null,
                pd_re: latestPrescription?.pd_re ?? null,
                sph_le: latestPrescription?.sph_le ?? null,
                cyl_le: latestPrescription?.cyl_le ?? null,
                axis_le: latestPrescription?.axis_le ?? null,
                add_le: latestPrescription?.add_le ?? null,
                pd_le: latestPrescription?.pd_le ?? null,
                transactions: customerData.transactions?.map(t => ({ ...t, date: new Date(t.date) })) ?? [], // Ensure date is Date object
            };
        } catch (error) {
            console.error("Failed to fetch customer details:", error);
            toast({ title: "Error", description: "Could not load customer data.", variant: "destructive" });
            router.push('/search-customers');
            return { id: customerId, dateTime: new Date(), customerName: '', phoneNumber: '', transactions: [] };
        }
    },
  });

  const { fields: transactionFields, append: appendTransaction, remove: removeTransaction } = useFieldArray({
    control: form.control,
    name: "transactions",
  });

  // --- Form Submission ---
  const onSubmit = (data: CustomerFormValues) => {
     setFormDataForConfirmation(data);
     // Trigger confirmation dialog
  };

 const handleConfirmSubmit = async () => {
    if (!formDataForConfirmation) return;

    setIsSubmitting(true);
    try {
        // 1. Update Customer Core Data
        await updateCustomer(customerId, {
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
        });

        // 2. Update/Save Prescription (Decide on strategy: Overwrite latest or add new?)
        // For simplicity, let's assume we save a new prescription record if data exists.
        // A more complex strategy might involve updating an existing record.
         const hasPrescriptionData = Object.entries(formDataForConfirmation).some(([key, value]) =>
            (key.startsWith('sph_') || key.startsWith('cyl_') || key.startsWith('axis_') || key.startsWith('add_') || key.startsWith('pd_')) && value != null
        );
        if (hasPrescriptionData) {
             await savePrescription({ // Using savePrescription to add a new record
                customerId: customerId,
                sph_re: formDataForConfirmation.sph_re,
                cyl_re: formDataForConfirmation.cyl_re,
                axis_re: formDataForConfirmation.axis_re,
                add_re: formDataForConfirmation.add_re,
                pd_re: formDataForConfirmation.pd_re,
                sph_le: formDataForConfirmation.sph_le,
                cyl_le: formDataForConfirmation.cyl_le,
                axis_le: formDataForConfirmation.axis_le,
                add_le: formDataForConfirmation.add_le,
                pd_le: formDataForConfirmation.pd_le,
            });
        }

        // 3. Update/Save Transactions (More complex: Need to diff and add/update/delete)
        // Simplified: Add any new transactions (assuming no edit/delete of existing for now)
        // A robust solution would involve tracking original transaction IDs.
        const existingTransactions = (await getCustomerDetails(customerId))?.transactions || [];
        const newTransactions = formDataForConfirmation.transactions?.filter(
            (t, index) => !existingTransactions[index] // Basic check if it's potentially new
        ) || [];

        for (const transaction of newTransactions) {
             await saveTransaction({
                customerId: customerId,
                date: transaction.date,
                description: transaction.description,
                amount: transaction.amount,
                type: transaction.type,
            });
        }
         // NOTE: Deleting/Editing existing transactions from the UI is not implemented here.

        // 4. Prepare data for Excel export (optional, maybe not needed on edit?)
        // const excelData = { ... };
        // await exportCustomerToExcel(excelData);

        toast({
            title: "Success",
            description: "Customer data updated successfully.",
        });
        router.push('/search-customers'); // Redirect after successful update

    } catch (error) {
        console.error("Update Error:", error);
        toast({
            title: "Error",
            description: "Failed to update customer data. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
        setFormDataForConfirmation(null);
    }
  };

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

  // --- Render ---
  if (isLoading) {
    return (
        <PageWrapper title="Edit Customer">
            <div className="space-y-8">
                <Card>
                    <CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><Skeleton className="h-6 w-1/4" /></CardHeader>
                    <CardContent><Skeleton className="h-24 w-full" /></CardContent>
                </Card>
                 <Card>
                    <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
                    <CardContent><Skeleton className="h-32 w-full" /></CardContent>
                    <CardFooter className="flex justify-end"><Skeleton className="h-10 w-24" /></CardFooter>
                </Card>
            </div>
        </PageWrapper>
    );
  }

  return (
    <PageWrapper title={`Edit Customer: ${form.getValues('customerName') || customerId}`}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* Customer Details */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2">
                    <FormLabel>Date Added/Last Update</FormLabel>
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
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Power Details */}
          <Card>
            <CardHeader>
              <CardTitle>Power Details (Latest Prescription)</CardTitle>
               <CardDescription>Edit or add prescription details.</CardDescription>
            </CardHeader>
             <CardContent>
                {/* Reusing the same layout as NewBillPage */}
                <div className="grid grid-cols-11 gap-x-2 gap-y-4 items-end text-sm">
                    {/* Header Row */}
                    <div></div> {/* Eye Label Col */}
                    <Label className="text-center font-semibold">SPH</Label>
                    <Label className="text-center font-semibold">CYL</Label>
                    <Label className="text-center font-semibold">Axis</Label>
                    <Label className="text-center font-semibold">Add</Label>
                    <Label className="text-center font-semibold">PD</Label>
                    {/* Spacer column */}
                    <div></div>
                    <Label className="text-center font-semibold">SPH</Label>
                    <Label className="text-center font-semibold">CYL</Label>
                    <Label className="text-center font-semibold">Axis</Label>
                    <Label className="text-center font-semibold">Add</Label>
                    <Label className="text-center font-semibold">PD</Label>


                    {/* Right Eye Row */}
                    <Label className="font-semibold self-center">RE</Label>
                    <FormField control={form.control} name="sph_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="1" placeholder="0" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="pd_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />

                    {/* Spacer column */}
                    <div className="border-r border-border h-full mx-auto"></div>

                    {/* Left Eye Row */}
                    <FormField control={form.control} name="sph_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="1" placeholder="0" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                     <FormField control={form.control} name="pd_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                     <Label className="font-semibold self-center justify-self-end">LE</Label>

                </div>
            </CardContent>
          </Card>

          {/* Financial Transactions */}
           <Card>
            <CardHeader>
              <CardTitle>Financial Transactions</CardTitle>
              <CardDescription>Add new transactions. Editing/Deleting existing transactions requires separate logic.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                 {transactionFields.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-10 gap-4 border p-4 rounded-md relative">
                         <FormField
                            control={form.control}
                            name={`transactions.${index}.date`}
                            render={({ field }) => (
                                <FormItem className="flex flex-col col-span-10 md:col-span-2">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                         />
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.description`}
                            render={({ field }) => (
                                <FormItem className="col-span-10 md:col-span-4">
                                    <FormLabel>Description</FormLabel>
                                    <FormControl><Textarea placeholder="Transaction details" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.amount`}
                            render={({ field }) => (
                                <FormItem className="col-span-5 md:col-span-2">
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.type`}
                            render={({ field }) => (
                                <FormItem className="col-span-5 md:col-span-2">
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                        <SelectItem value="credit">Credit (Received)</SelectItem>
                                        <SelectItem value="debit">Debit (Given)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         {/* Remove Button - Only for newly added rows if logic allows */}
                         <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTransaction(index)}
                            className="absolute top-1 right-1 text-destructive hover:bg-destructive/10 md:static md:col-span-1 md:self-end"
                            >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove Transaction</span>
                        </Button>
                    </div>
                 ))}
                </div>
                 <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => appendTransaction({ date: new Date(), description: "", amount: 0, type: "credit"})}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Transaction
                </Button>
            </CardContent>
            <CardFooter className="flex justify-between items-center mt-6">
                 {/* Delete Button */}
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" disabled={isDeleting}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            {isDeleting ? "Deleting..." : "Delete Customer"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action is permanent and cannot be undone. Are you sure you want to delete this customer and all their associated data?
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

                 {/* Save Button */}
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Save className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </AlertDialogTrigger>
                     <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save the changes made to this customer's data?
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setFormDataForConfirmation(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
                           {isSubmitting ? "Saving..." : "Confirm & Save"}
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
             </CardFooter>
          </Card>

        </form>
      </Form>
    </PageWrapper>
  );
}
