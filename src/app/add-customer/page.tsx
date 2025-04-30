
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Trash2, PlusCircle } from "lucide-react";

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
// Import Firestore functions
import { saveCustomer, savePrescription, saveInvoice, saveProducts } from "@/lib/db";
// Excel export might need refactoring
import { exportCustomerToExcel } from "@/lib/excel";

// --- Zod Schema Definition ---
// Expanded schema similar to New Bill

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  total: z.coerce.number(), // Calculated field
});

const customerSchema = z.object({
  // No Bill Number field needed on form
  dateTime: z.date({ required_error: "Date is required." }), // Date of adding customer
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

  // Products
  products: z.array(productSchema).min(1, "At least one product is required"), // Now included

  // Payment Details
  discount: z.coerce.number().min(0, "Discount must be non-negative").default(0),
  netPrice: z.coerce.number(), // Calculated
  advanceAmount: z.coerce.number().min(0, "Advance must be non-negative").default(0),
  balanceAmount: z.coerce.number(), // Calculated
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// --- Component ---

export default function AddCustomerPage() {
  const isLoadingAuth = useAuth(); // Protect the route and get loading state
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
      products: [{ name: "", price: 0, quantity: 1, total: 0 }], // Include products default
      discount: 0,
      netPrice: 0,
      advanceAmount: 0,
      balanceAmount: 0, // Include payment defaults
    },
  });

   const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "products",
  });

   // --- Calculation Logic (Copied from New Bill) ---
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
        // Use requestAnimationFrame to defer the calculation slightly, preventing potential stack overflows
        requestAnimationFrame(() => {
          calculateTotals();
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, calculateTotals]);


  // Initial calculation on mount
  React.useEffect(() => {
    // Use setTimeout to ensure initial calculation happens after the first render potentially fixes state updates
    const timer = setTimeout(() => {
        calculateTotals();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Recalculate initially

  // --- Form Submission ---
  const onSubmit = (data: CustomerFormValues) => {
     // Ensure calculations are final before submitting
     calculateTotals();
     const finalData = form.getValues(); // Get potentially recalculated values
     console.log("Form Data (Add Customer):", finalData);
     setFormDataForConfirmation(finalData);
     // Trigger the AlertDialog
  };

  const handleConfirmSubmit = async () => {
    if (!formDataForConfirmation) return;

    setIsSubmitting(true);
    try {
        // 1. Save Customer Core Data (Firestore handles check for existing)
        const customerResult = await saveCustomer({
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
        });
        const customerId = customerResult.id; // Firestore returns string ID

        // 2. Save Prescription (if any data exists)
         const hasPrescriptionData = Object.entries(formDataForConfirmation).some(([key, value]) =>
            (key.startsWith('sph_') || key.startsWith('cyl_') || key.startsWith('axis_') || key.startsWith('add_') || key.startsWith('pd_')) && value != null && value !== ''
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
                prescriptionDate: formDataForConfirmation.dateTime, // Use form date as prescription date
            });
        }

        // 3. Save Invoice-like record (using a placeholder bill number)
        // We still save an 'invoice' to store the financial transaction context
        const placeholderBillNumber = `CUST_ADD_${customerId}_${Date.now()}`;
        const invoiceResult = await saveInvoice({
            customerId: customerId, // Pass string ID
            billNumber: placeholderBillNumber, // Use placeholder
            dateTime: formDataForConfirmation.dateTime, // Pass Date object
            discount: formDataForConfirmation.discount,
            netPrice: formDataForConfirmation.netPrice,
            advanceAmount: formDataForConfirmation.advanceAmount,
            balanceAmount: formDataForConfirmation.balanceAmount,
        });
        const invoiceId = invoiceResult.id; // Firestore returns string ID

        // 4. Save Products linked to the invoice record (as subcollection)
        const productsToSave = formDataForConfirmation.products.map(({ total, ...prod }) => prod);
        await saveProducts(invoiceId, productsToSave); // Pass invoice ID and products


         // 5. Prepare data for Excel export (Optional - consider if needed)
        try {
            const excelData = {
                id: customerId, // String ID
                name: formDataForConfirmation.customerName,
                phone: formDataForConfirmation.phoneNumber,
                billNumber: placeholderBillNumber, // Use placeholder bill number
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
                products: formDataForConfirmation.products.map(p => `${p.name} (Qty: ${p.quantity}, Price: ${p.price})`).join('; '),
                discount: formDataForConfirmation.discount,
                netPrice: formDataForConfirmation.netPrice,
                advanceAmount: formDataForConfirmation.advanceAmount,
                balanceAmount: formDataForConfirmation.balanceAmount,
            };
            await exportCustomerToExcel(excelData as any); // Placeholder call, adjust type if needed
        } catch (exportError) {
             console.error("Excel Export Error:", exportError);
             toast({
                title: "Warning",
                description: "Data saved to database, but Excel export failed.",
                variant: "default",
            });
        }


        toast({
            title: "Success",
            description: "Customer data, products, and payment details saved successfully.",
        });

        form.reset(); // Reset form after successful submission
        router.push('/options'); // Redirect back to options page

    } catch (error) {
        console.error("Submission Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({
            title: "Error",
            description: `Failed to save customer data: ${errorMessage}`,
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
        setFormDataForConfirmation(null);
    }
  };


  // --- Render ---
   // Show loading screen while authentication check is in progress
   if (isLoadingAuth) {
     return <AuthLoadingScreen />;
   }

  return (
    <PageWrapper title="Add New Customer & Details">
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
                        <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                            <Save className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Saving..." : "Save Customer"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Save</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save this customer's data, including product and payment details? This action will store the information in the database and export it to Excel. No invoice will be generated for printing.
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
