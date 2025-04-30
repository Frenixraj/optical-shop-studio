
"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Trash2, Loader2 } from "lucide-react";

import useAuth from '@/hooks/useAuth';
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
// Textarea, Select, PlusCircle, Table components are removed as transactions are gone
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
import { getCustomerDetails, updateCustomer, savePrescription, deleteCustomer } from "@/lib/db"; // saveTransaction removed
import { exportCustomerToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema Definition ---
// Simplified schema: Customer Info + Prescription Only
const customerSchema = z.object({
  id: z.number(), // Keep track of the customer ID being edited
  dateTime: z.date({ required_error: "Date is required." }), // Date field remains, maybe 'Last Updated' or 'Date Added'
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),

  // Power Details (Optional Prescription)
  sph_re: z.coerce.number().optional().nullable(),
  cyl_re: z.coerce.number().optional().nullable(),
  axis_re: z.coerce.number().int().min(0).max(180).optional().nullable(),
  add_re: z.coerce.number().optional().nullable(),
  pd_re: z.coerce.number().optional().nullable(),
  sph_le: z.coerce.number().optional().nullable(),
  cyl_le: z.coerce.number().optional().nullable(),
  axis_le: z.coerce.number().int().min(0).max(180).optional().nullable(),
  add_le: z.coerce.number().optional().nullable(),
  pd_le: z.coerce.number().optional().nullable(),

  // Financial Transactions removed
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
            return { id: NaN, dateTime: new Date(), customerName: '', phoneNumber: '' }; // Simplified default
        }
        try {
            const customerData = await getCustomerDetails(customerId);
            if (!customerData) {
                toast({ title: "Not Found", description: "Customer not found.", variant: "destructive" });
                router.push('/search-customers');
                return { id: customerId, dateTime: new Date(), customerName: '', phoneNumber: '' };
            }
            // Assuming prescription is fetched, take the latest one
            const latestPrescription = customerData.prescriptions?.sort((a, b) => (b.prescriptionDate?.getTime() ?? 0) - (a.prescriptionDate?.getTime() ?? 0))[0];
            setIsLoading(false);
            return {
                id: customerData.id,
                // Decide which date to show: Date added or Last Invoice? Using fallback to new Date()
                dateTime: customerData.invoices?.[0]?.dateTime ? new Date(customerData.invoices[0].dateTime) : new Date(),
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
                // No transactions
            };
        } catch (error) {
            console.error("Failed to fetch customer details:", error);
            toast({ title: "Error", description: "Could not load customer data.", variant: "destructive" });
            router.push('/search-customers');
            return { id: customerId, dateTime: new Date(), customerName: '', phoneNumber: '' };
        }
    },
  });

  // useFieldArray for transactions removed

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
            // Potentially update a 'lastModified' date if your schema supports it
        });

        // 2. Save Prescription (Save as new record - simplicity)
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
                prescriptionDate: new Date(), // Add date on save
            });
        }

        // 3. Transaction saving removed

        // 4. Prepare data for Excel export (optional, maybe not needed on edit?)
        const excelData = {
            id: customerId,
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
            dateTime: formDataForConfirmation.dateTime, // Include date shown on form
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
        };
        await exportCustomerToExcel(excelData); // Optional export

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
                    {/* Footer adjusted */}
                    <CardFooter className="flex justify-between"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></CardFooter>
                </Card>
                 {/* Transaction Card Skeleton Removed */}
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
                    <FormLabel>Date Added/Last Update</FormLabel> {/* Label clarified */}
                     <Popover>
                        <PopoverTrigger asChild>
                        <FormControl>
                            <Button
                            variant={"outline"}
                            className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                            )}
                            disabled // Maybe disable date editing? Or allow? Let's disable for now.
                            >
                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl>
                        </PopoverTrigger>
                        {/* PopoverContent removed if disabled */}
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
               <CardDescription>Edit or add prescription details. Saving will create a new prescription record.</CardDescription>
            </CardHeader>
             <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-x-2 gap-y-4 items-center text-sm px-4">
                    {/* Header Row */}
                    <div className="md:col-span-1"></div> {/* Empty cell for alignment */}
                    <Label className="text-center font-semibold">SPH</Label>
                    <Label className="text-center font-semibold">CYL</Label>
                    <Label className="text-center font-semibold">Axis</Label>
                    <Label className="text-center font-semibold">Add</Label>
                    <Label className="text-center font-semibold">PD</Label>

                    {/* Right Eye Row */}
                    <Label className="font-semibold self-center justify-self-end pr-2">RE</Label>
                    <FormField control={form.control} name="sph_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_re" render={({ field }) => <FormItem><FormControl><Input type="number" min="0" max="180" step="1" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="pd_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />


                    {/* Left Eye Row */}
                     <Label className="font-semibold self-center justify-self-end pr-2">LE</Label>
                    <FormField control={form.control} name="sph_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_le" render={({ field }) => <FormItem><FormControl><Input type="number" min="0" max="180" step="1" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                     <FormField control={form.control} name="pd_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />

                </div>
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
                            Are you sure you want to save the changes made to this customer's data? This will add a new prescription record if power details were entered or modified.
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

          {/* Financial Transactions Card Removed */}

        </form>
      </Form>
    </PageWrapper>
  );
}

    