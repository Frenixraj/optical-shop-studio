
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Printer, Trash2, PlusCircle } from "lucide-react";

import useAuth, { AuthLoadingScreen } from '@/hooks/useAuth'; // Import AuthLoadingScreen
import PageWrapper from "@/components/layout/PageWrapper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
// Import Firestore functions (removed getNextBillNumber)
import { saveCustomer, savePrescription, saveInvoice, saveProducts } from "@/lib/db";
// Excel export might need refactoring depending on how data is fetched now
import { exportCustomerToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema Definition ---

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  total: z.coerce.number(), // Calculated field
});

const billSchema = z.object({
  billNumber: z.string().min(1, "Bill number is required"), // Made required
  dateTime: z.date({ required_error: "Date is required." }),
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),

  // Power Details (optional, use refine for complex validation if needed)
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

  // Products
  products: z.array(productSchema).min(1, "At least one product is required"),

  // Payment Details
  discount: z.coerce.number().min(0, "Discount must be non-negative").default(0),
  netPrice: z.coerce.number(), // Calculated
  advanceAmount: z.coerce.number().min(0, "Advance must be non-negative").default(0),
  balanceAmount: z.coerce.number(), // Calculated
});

type BillFormValues = z.infer<typeof billSchema>;

// --- Component ---

export default function NewBillPage() {
  const isLoadingAuth = useAuth(); // Protect the route and get loading state
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formDataForConfirmation, setFormDataForConfirmation] = React.useState<BillFormValues | null>(null);
  // Removed isBillNumberLoading state


  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      billNumber: "", // Default to empty, user inputs
      dateTime: new Date(),
      customerName: "",
      phoneNumber: "",
      sph_re: null, cyl_re: null, axis_re: null, add_re: null, pd_re: null,
      sph_le: null, cyl_le: null, axis_le: null, add_le: null, pd_le: null,
      products: [{ name: "", price: 0, quantity: 1, total: 0 }],
      discount: 0,
      netPrice: 0,
      advanceAmount: 0,
      balanceAmount: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

  // Removed useEffect for fetching bill number


  // --- Calculation Logic ---
   const calculateTotals = React.useCallback(() => {
    const products = form.getValues("products");
    let subTotal = 0;
    products.forEach((product, index) => {
      // Ensure price and quantity are valid numbers before calculation
      const price = typeof product.price === 'number' && !isNaN(product.price) ? product.price : 0;
      const quantity = typeof product.quantity === 'number' && Number.isInteger(product.quantity) ? product.quantity : 0;
      const total = price * quantity;

      // Only set the value if it has actually changed to prevent potential infinite loop
      const currentTotal = form.getValues(`products.${index}.total`);
      if (typeof currentTotal !== 'number' || currentTotal !== total) {
         form.setValue(`products.${index}.total`, total, { shouldValidate: false, shouldDirty: true });
      }
      subTotal += total;
    });

    const discount = form.getValues("discount") || 0;
    const advanceAmount = form.getValues("advanceAmount") || 0;
    const netPrice = subTotal - discount;
    const balanceAmount = netPrice - advanceAmount;

    // Only set value if it has changed
     const currentNetPrice = form.getValues("netPrice");
     if (typeof currentNetPrice !== 'number' || currentNetPrice !== netPrice) {
       form.setValue("netPrice", netPrice, { shouldValidate: true });
     }
     const currentBalanceAmount = form.getValues("balanceAmount");
     if (typeof currentBalanceAmount !== 'number' || currentBalanceAmount !== balanceAmount) {
        form.setValue("balanceAmount", balanceAmount, { shouldValidate: true });
     }
  }, [form]);

  // Recalculate when products (price/quantity), discount, or advance changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type !== 'change' || !name) return;

      const isProductInput = name?.startsWith("products") && (name.endsWith(".price") || name.endsWith(".quantity"));
      const isPaymentInput = name === "discount" || name === "advanceAmount";

      if (isProductInput || isPaymentInput) {
        // Use requestAnimationFrame to defer calculation slightly
        requestAnimationFrame(() => {
             calculateTotals();
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, calculateTotals]);

  // Initial calculation on mount
  React.useEffect(() => {
    // Use setTimeout to ensure initial calculation happens after the first render
    const timer = setTimeout(() => {
        calculateTotals();
    }, 0);
    return () => clearTimeout(timer);
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Calculate initially


  // --- Form Submission ---
  const onSubmit = (data: BillFormValues) => {
     // Ensure calculations are final before submitting
     calculateTotals();
     const finalData = form.getValues(); // Get potentially recalculated values
     console.log("Form Data:", finalData);
     setFormDataForConfirmation(finalData); // Store data for confirmation dialog
     // Trigger the AlertDialog
  };

  const handleConfirmSubmit = async () => {
    if (!formDataForConfirmation) return;

    setIsSubmitting(true);
    try {
        // 1. Save Customer (Firestore handles check for existing)
        const customerResult = await saveCustomer({
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
        });
        const customerId = customerResult.id; // Firestore returns string ID

        // 2. Save Prescription (if any data exists)
        const hasPrescriptionData = Object.entries(formDataForConfirmation).some(([key, value]) =>
            (key.startsWith('sph_') || key.startsWith('cyl_') || key.startsWith('axis_') || key.startsWith('add_') || key.startsWith('pd_')) && value != null && value !== '' // Check for non-empty too
        );

        if (hasPrescriptionData) {
            await savePrescription({
                customerId: customerId, // Pass string ID
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
                prescriptionDate: new Date(), // Save prescription date as current time
            });
        }

        // 3. Save Invoice
        const invoiceResult = await saveInvoice({
            customerId: customerId, // Pass string ID
            billNumber: formDataForConfirmation.billNumber,
            dateTime: formDataForConfirmation.dateTime, // Pass Date object
            discount: formDataForConfirmation.discount,
            netPrice: formDataForConfirmation.netPrice,
            advanceAmount: formDataForConfirmation.advanceAmount,
            balanceAmount: formDataForConfirmation.balanceAmount,
        });
        const invoiceId = invoiceResult.id; // Firestore returns string ID


        // 4. Save Products (as subcollection)
        // Remove 'total' before saving if it's just for display
        const productsToSave = formDataForConfirmation.products.map(({ total, ...prod }) => prod);
        await saveProducts(invoiceId, productsToSave); // Pass invoice ID and products array


       // 5. Excel export (might need adjustment based on data structure)
       // Consider if Excel export is still needed or if Firestore is the primary source.
       // Fetching full data again for export might be inefficient.
       try {
            const excelData = {
                // Map form data for export - Note: IDs are now strings
                id: customerId, // Customer ID is now string
                name: formDataForConfirmation.customerName,
                phone: formDataForConfirmation.phoneNumber,
                billNumber: formDataForConfirmation.billNumber,
                dateTime: formDataForConfirmation.dateTime, // Pass Date
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
                products: formDataForConfirmation.products.map(p => `${p.name} (Qty: ${p.quantity}, Price: ${p.price})`).join('; '), // Example combining products
                discount: formDataForConfirmation.discount,
                netPrice: formDataForConfirmation.netPrice,
                advanceAmount: formDataForConfirmation.advanceAmount,
                balanceAmount: formDataForConfirmation.balanceAmount,
                // Include createdAt if needed, fetch it or use customerResult
                 // createdAt: customerResult.createdAt ? customerResult.createdAt.toDate() : new Date() // createdAt is not directly on customerResult
                 createdAt: new Date() // Assuming creation time is now if needed for export
            };
            await exportCustomerToExcel(excelData as any); // Pass data, might need type adjustment
        } catch (exportError) {
            console.error("Excel Export Error:", exportError);
            // Non-fatal, show toast but don't block main success flow
             toast({
                title: "Warning",
                description: "Data saved to database, but Excel export failed.",
                variant: "default", // Use default or a specific warning style
            });
        }


        toast({
            title: "Success",
            description: "Invoice and customer data saved successfully.",
        });

        // Redirect to print page (pass string IDs)
        router.push(`/print?invoiceId=${invoiceId}&customerId=${customerId}`); // Pass string IDs

    } catch (error) {
        console.error("Submission Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            title: "Error Saving Data",
            description: errorMessage, // Show specific error from db functions
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
        setFormDataForConfirmation(null); // Clear stored data
    }
  };


  // --- Render ---
   // Show loading screen while authentication check is in progress
   if (isLoadingAuth) {
     return <AuthLoadingScreen />;
   }

  return (
    <PageWrapper title="New Bill / Prescription">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* Bill Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="billNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Number</FormLabel>
                    <FormControl>
                       {/* Changed from readOnly to editable */}
                      <Input placeholder="Enter bill number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem className="flex flex-col pt-2"> {/* Adjusted alignment */}
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
                            {field.value ? (
                                format(field.value, "PPP") // Changed format
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
              <div></div> {/* Placeholder for alignment */}
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
              <CardTitle>Power Details (Prescription)</CardTitle>
              <CardDescription>Leave fields blank if not applicable.</CardDescription>
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
          </Card>

          {/* Product Details */}
           <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-2/5">Product Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total Price</TableHead>{/* Align right */}
                    <TableHead className="text-center">Action</TableHead>{/* Center align */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`products.${index}.name`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder="Enter product name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`products.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" step="0.01" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}/>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`products.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" step="1" placeholder="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                       <TableCell className="text-right"> {/* Align right */}
                        <FormField
                          control={form.control}
                          name={`products.${index}.total`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                 {/* Display calculated total, read-only visually */}
                                <Input readOnly value={field.value?.toFixed(2) || '0.00'} className="bg-muted border-none text-right" />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-center"> {/* Center align */}
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1} // Prevent removing the last row
                        >
                          <Trash2 className="h-4 w-4" />
                           <span className="sr-only">Remove Product</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ name: "", price: 0, quantity: 1, total: 0 })}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
             <CardHeader>
                 <CardTitle>Payment Summary</CardTitle>
            </CardHeader>
             <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                 {/* Sub Total */}
                 <Label className="text-right font-semibold pt-2 md:col-start-3">Sub Total:</Label>
                 <Input
                    readOnly
                    value={(form.getValues("products")?.reduce((sum, p) => sum + (p.total || 0), 0) || 0).toFixed(2)}
                    className="bg-muted border-none text-right md:col-start-4"
                 />

                 {/* Discount */}
                 <Label className="text-right font-semibold md:col-start-3">Discount:</Label>
                 <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                    <FormItem className="md:col-start-4"> {/* Align to the 4th column */}
                        <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-right" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                 />


                 {/* Net Price */}
                 <Label className="text-right font-semibold md:col-start-3">Net Price:</Label>
                 <FormField
                    control={form.control}
                    name="netPrice"
                    render={({ field }) => (
                    <FormItem className="md:col-start-4">
                        <FormControl>
                            <Input readOnly value={field.value?.toFixed(2) || '0.00'} className="bg-muted border-none text-right font-semibold"/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                 />

                 {/* Advance Amount */}
                  <Label className="text-right font-semibold md:col-start-3">Advance Amount:</Label>
                 <FormField
                    control={form.control}
                    name="advanceAmount"
                    render={({ field }) => (
                    <FormItem className="md:col-start-4"> {/* Align to the 4th column */}
                        <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-right" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                 />


                 {/* Balance Amount */}
                 <Label className="text-right font-semibold md:col-start-3">Balance Amount:</Label>
                 <FormField
                    control={form.control}
                    name="balanceAmount"
                    render={({ field }) => (
                    <FormItem className="md:col-start-4">
                        <FormControl>
                         <Input readOnly value={field.value?.toFixed(2) || '0.00'} className="bg-muted border-none text-right font-semibold"/>
                        </FormControl>
                         <FormMessage />
                    </FormItem>
                    )}
                 />
            </CardContent>
             <CardFooter className="flex justify-end mt-6">
                 {/* AlertDialog Trigger integrated with Submit Button */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        {/* Removed disabled check for bill number loading */}
                        <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Printer className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Submitting..." : "Save & Print"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save this bill and prescription? This action will store the data in the database and prepare it for printing.
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
