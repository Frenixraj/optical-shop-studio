
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Printer, Trash2, PlusCircle } from "lucide-react";

import useAuth from '@/hooks/useAuth';
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
import { saveCustomer, savePrescription, saveInvoice, saveProducts, getNextBillNumber } from "@/lib/db"; // Placeholder DB functions
import { exportCustomerToExcel } from "@/lib/excel"; // Placeholder Excel function

// --- Zod Schema Definition ---

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  total: z.coerce.number(), // Calculated field
});

const billSchema = z.object({
  billNumber: z.string().min(1, "Bill number is required"),
  dateTime: z.date({ required_error: "Date is required." }),
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 digits").regex(/^\d+$/, "Phone number must contain only digits"),

  // Power Details (optional, use refine for complex validation if needed)
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
  useAuth(); // Protect the route
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formDataForConfirmation, setFormDataForConfirmation] = React.useState<BillFormValues | null>(null);


  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      billNumber: "", // Will be fetched
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

  // Fetch next bill number on component mount
  React.useEffect(() => {
    const fetchBillNumber = async () => {
      try {
        const nextBillNo = await getNextBillNumber();
        form.setValue("billNumber", nextBillNo);
      } catch (error) {
        console.error("Failed to fetch bill number:", error);
        toast({ title: "Error", description: "Could not fetch the next bill number.", variant: "destructive" });
      }
    };
    fetchBillNumber();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once


  // --- Calculation Logic ---
  const calculateTotals = React.useCallback(() => {
    const products = form.getValues("products");
    let subTotal = 0;
    products.forEach((product, index) => {
      const price = product.price || 0;
      const quantity = product.quantity || 0;
      const total = price * quantity;
      // Only set the value if it has actually changed to potentially avoid triggering watch unnecessarily
      if (form.getValues(`products.${index}.total`) !== total) {
        form.setValue(`products.${index}.total`, total, { shouldValidate: false, shouldDirty: true, shouldTouch: true }); // Update individual total but avoid validation loop
      }
      subTotal += total;
    });

    const discount = form.getValues("discount") || 0;
    const advanceAmount = form.getValues("advanceAmount") || 0;
    const netPrice = subTotal - discount;
    const balanceAmount = netPrice - advanceAmount;

    // Only set value if it has changed
     if (form.getValues("netPrice") !== netPrice) {
       form.setValue("netPrice", netPrice, { shouldValidate: true });
     }
     if (form.getValues("balanceAmount") !== balanceAmount) {
        form.setValue("balanceAmount", balanceAmount, { shouldValidate: true });
     }
  }, [form]);

  // Recalculate when products (price/quantity), discount, or advance changes
  React.useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      // Check if the change is from user input or programmatic setValue
      if (type !== 'change') return;

      // Only recalculate if a relevant *input* field changed,
      // not the calculated 'total', 'netPrice', or 'balanceAmount' fields themselves.
      const isProductInput = name?.startsWith("products") && (name.endsWith(".price") || name.endsWith(".quantity"));
      const isPaymentInput = name === "discount" || name === "advanceAmount";

      if (isProductInput || isPaymentInput) {
        calculateTotals();
      }
    });
    return () => subscription.unsubscribe();
  }, [form, calculateTotals]);

  // Initial calculation on mount
  React.useEffect(() => {
    calculateTotals();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Recalculate only if products array length changes (append/remove) - relies on default values being calculated correctly initially


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
        // 1. Save Customer
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

        // 3. Save Invoice
        const invoiceResult = await saveInvoice({
            customerId: customerId,
            billNumber: formDataForConfirmation.billNumber,
            dateTime: formDataForConfirmation.dateTime,
            discount: formDataForConfirmation.discount,
            netPrice: formDataForConfirmation.netPrice,
            advanceAmount: formDataForConfirmation.advanceAmount,
            balanceAmount: formDataForConfirmation.balanceAmount,
        });
        const invoiceId = invoiceResult.id;


        // 4. Save Products
        const productsToSave = formDataForConfirmation.products.map(p => ({ ...p, invoiceId }));
        await saveProducts(productsToSave);

       // 5. Prepare data for Excel export (Combine data as needed)
       const excelData = {
            id: customerId,
            name: formDataForConfirmation.customerName,
            phone: formDataForConfirmation.phoneNumber,
            billNumber: formDataForConfirmation.billNumber,
            dateTime: formDataForConfirmation.dateTime,
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
            // Add transaction data if needed later for Add Customer page
        };
        await exportCustomerToExcel(excelData); // Placeholder call

        toast({
            title: "Success",
            description: "Invoice and customer data saved successfully.",
        });

        // Redirect to print page (pass necessary data via query params or state management)
        router.push(`/print?invoiceId=${invoiceId}&customerId=${customerId}`); // Example redirection

    } catch (error) {
        console.error("Submission Error:", error);
        toast({
            title: "Error",
            description: "Failed to save data. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
        setFormDataForConfirmation(null); // Clear stored data
    }
  };


  // --- Render ---
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
                      <Input {...field} readOnly className="bg-muted"/>
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
                    <FormField control={form.control} name="sph_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="1" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="pd_re" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />

                    {/* Spacer column */}
                    <div className="border-r border-border h-full mx-auto"></div>

                    {/* Left Eye Row (Repeated structure) */}
                    <FormField control={form.control} name="sph_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="cyl_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="axis_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="1" placeholder="0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="add_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.25" placeholder="0.00" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={form.control} name="pd_le" render={({ field }) => <FormItem><FormControl><Input type="number" step="0.5" placeholder="0.0" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className="text-center" /></FormControl><FormMessage /></FormItem>} />
                    <Label className="font-semibold self-center justify-self-end">LE</Label> {/* Place LE label after PD */}

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
                    <TableHead>Total Price</TableHead>
                    <TableHead>Action</TableHead>
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
                       <TableCell>
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
                      <TableCell>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1} // Prevent removing the last row
                        >
                          <Trash2 className="h-4 w-4" />
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
                 <div></div> {/* Spacer */}
                 <div></div> {/* Spacer */}
                 <Label className="text-right font-semibold pt-2">Sub Total:</Label>
                 <Input
                    readOnly
                    value={(form.getValues("products")?.reduce((sum, p) => sum + (p.total || 0), 0) || 0).toFixed(2)}
                    className="bg-muted border-none text-right"
                />


                <div></div> {/* Spacer */}
                <div></div> {/* Spacer */}
                 <FormField
                    control={form.control}
                    name="discount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-right block">Discount:</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-right" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <div></div> {/* Placeholder for alignment */}

                <div></div> {/* Spacer */}
                 <div></div> {/* Spacer */}
                <Label className="text-right font-semibold">Net Price:</Label>
                 <FormField
                    control={form.control}
                    name="netPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input readOnly value={field.value?.toFixed(2) || '0.00'} className="bg-muted border-none text-right font-semibold"/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />


               <div></div> {/* Spacer */}
                <div></div> {/* Spacer */}
                 <FormField
                    control={form.control}
                    name="advanceAmount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel className="text-right block">Advance Amount:</FormLabel>
                        <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} className="text-right" onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}/>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <div></div> {/* Placeholder for alignment */}

                <div></div> {/* Spacer */}
                 <div></div> {/* Spacer */}
                <Label className="text-right font-semibold">Balance Amount:</Label>
                 <FormField
                    control={form.control}
                    name="balanceAmount"
                    render={({ field }) => (
                    <FormItem>
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
                            <Printer className="mr-2 h-4 w-4" />
                            {isSubmitting ? "Submitting..." : "Save & Print"}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save this bill and prescription? This action will store the data and prepare it for printing.
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


    