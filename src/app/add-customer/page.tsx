"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Trash2, PlusCircle } from "lucide-react";

import useAuth from '@/hooks/useAuth';
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea"; // Added for transaction description
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added for transaction type
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
import { saveCustomer, savePrescription, saveTransaction } from "@/lib/db"; // Placeholder DB functions
import { exportCustomerToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema Definition ---

const transactionSchema = z.object({
    date: z.date({ required_error: "Date is required." }),
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    type: z.enum(["credit", "debit"], { required_error: "Transaction type is required." }),
});

const customerSchema = z.object({
  // No Bill Number
  dateTime: z.date({ required_error: "Date is required." }), // Date of adding customer
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

export default function AddCustomerPage() {
  useAuth(); // Protect the route
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formDataForConfirmation, setFormDataForConfirmation] = React.useState<CustomerFormValues | null>(null);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      dateTime: new Date(),
      customerName: "",
      phoneNumber: "",
      sph_re: null, cyl_re: null, axis_re: null, add_re: null, pd_re: null,
      sph_le: null, cyl_le: null, axis_le: null, add_le: null, pd_le: null,
      transactions: [], // Start with empty transactions
    },
  });

  const { fields: transactionFields, append: appendTransaction, remove: removeTransaction } = useFieldArray({
    control: form.control,
    name: "transactions",
  });

  // --- Form Submission ---
  const onSubmit = (data: CustomerFormValues) => {
     console.log("Form Data (Add Customer):", data);
     setFormDataForConfirmation(data);
     // Trigger the AlertDialog
  };

  const handleConfirmSubmit = async () => {
    if (!formDataForConfirmation) return;

    setIsSubmitting(true);
    try {
        // 1. Save Customer Core Data
        const customerResult = await saveCustomer({
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
        });
        const customerId = customerResult.id;

        // 2. Save Prescription (if any data exists)
         const hasPrescriptionData = Object.entries(formDataForConfirmation).some(([key, value]) =>
            (key.startsWith('sph_') || key.startsWith('cyl_') || key.startsWith('axis_') || key.startsWith('add_') || key.startsWith('pd_')) && value != null
        );
        if (hasPrescriptionData) {
            await savePrescription({
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

        // 3. Save Transactions (if any)
        if (formDataForConfirmation.transactions && formDataForConfirmation.transactions.length > 0) {
            for (const transaction of formDataForConfirmation.transactions) {
                await saveTransaction({
                    customerId: customerId,
                    date: transaction.date,
                    description: transaction.description,
                    amount: transaction.amount,
                    type: transaction.type,
                });
            }
        }

        // 4. Prepare data for Excel export
        const lastTransaction = formDataForConfirmation.transactions?.[formDataForConfirmation.transactions.length - 1];
        const excelData = {
            id: customerId,
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
            dateTime: formDataForConfirmation.dateTime, // Customer add date
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
            // No invoice/product details for this page
            lastTransactionDate: lastTransaction?.date,
            lastTransactionAmount: lastTransaction?.amount,
            lastTransactionType: lastTransaction?.type,
        };
        await exportCustomerToExcel(excelData); // Placeholder call


        toast({
            title: "Success",
            description: "Customer data saved successfully.",
        });

        form.reset(); // Reset form after successful submission
        // Optionally redirect or stay on page
        // router.push('/options');

    } catch (error) {
        console.error("Submission Error:", error);
        toast({
            title: "Error",
            description: "Failed to save customer data. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
        setFormDataForConfirmation(null);
    }
  };


  // --- Render ---
  return (
    <PageWrapper title="Add New Customer">
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
                    <FormLabel>Date Added</FormLabel>
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

          {/* Power Details (Optional Prescription) */}
           <Card>
            <CardHeader>
              <CardTitle>Power Details (Optional)</CardTitle>
              <CardDescription>Enter prescription if available. Leave blank if not.</CardDescription>
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
              <CardTitle>Financial Transactions (Optional)</CardTitle>
              <CardDescription>Record any initial payments or outstanding balances.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                 {transactionFields.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-10 gap-4 border p-4 rounded-md relative">
                         {/* Date */}
                         <FormField
                            control={form.control}
                            name={`transactions.${index}.date`}
                            render={({ field }) => (
                                <FormItem className="flex flex-col col-span-10 md:col-span-2">
                                    <FormLabel>Date</FormLabel>
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
                         {/* Description */}
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.description`}
                            render={({ field }) => (
                                <FormItem className="col-span-10 md:col-span-4">
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Initial advance, Old balance" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Amount */}
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.amount`}
                            render={({ field }) => (
                                <FormItem className="col-span-5 md:col-span-2">
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         {/* Type */}
                        <FormField
                            control={form.control}
                            name={`transactions.${index}.type`}
                            render={({ field }) => (
                                <FormItem className="col-span-5 md:col-span-2">
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="credit">Credit (Received)</SelectItem>
                                        <SelectItem value="debit">Debit (Given)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {/* Remove Button */}
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
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => appendTransaction({ date: new Date(), description: "", amount: 0, type: "credit"})}
                 >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Transaction
                </Button>
            </CardContent>
            <CardFooter className="flex justify-end mt-6">
                 {/* AlertDialog Trigger integrated with Submit Button */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Save className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Saving..." : "Save Customer"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Save</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save this customer's data? This action will store the information in the database and export it to Excel.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setFormDataForConfirmation(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmSubmit} disabled={isSubmitting}>
                             {isSubmitting ? "Confirming..." : "Confirm & Save"}
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
