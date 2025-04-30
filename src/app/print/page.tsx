"use client";

import * as React from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';

import useAuth from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerDetails } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";

// Interfaces matching db.ts structure
interface ProductDetail {
  invoiceId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface InvoiceDetail {
  invoiceId: number;
  customerId: number;
  billNumber: string;
  dateTime: Date | string; // Allow string temporarily from fetch
  discount: number;
  netPrice: number;
  advanceAmount: number;
  balanceAmount: number;
  products?: ProductDetail[];
}

interface PrescriptionDetail {
  customerId: number;
  sph_re: number | null;
  cyl_re: number | null;
  axis_re: number | null;
  add_re: number | null;
  pd_re: number | null;
  sph_le: number | null;
  cyl_le: number | null;
  axis_le: number | null;
  add_le: number | null;
  pd_le: number | null;
  prescriptionDate?: Date | string; // Allow string temporarily
}

interface CustomerPrintData {
  id: number;
  name: string;
  phone: string;
  invoice: InvoiceDetail | null;
  prescription: PrescriptionDetail | null; // Use latest relevant prescription
}


export default function PrintPage() {
  useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceIdStr = searchParams.get('invoiceId');
  const customerIdStr = searchParams.get('customerId');
  const [printData, setPrintData] = React.useState<CustomerPrintData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!invoiceIdStr || !customerIdStr) {
        toast({ title: "Error", description: "Missing invoice or customer ID for printing.", variant: "destructive" });
        router.push('/options');
        return;
      }

      const invoiceId = parseInt(invoiceIdStr, 10);
      const customerId = parseInt(customerIdStr, 10);

      if (isNaN(invoiceId) || isNaN(customerId)) {
         toast({ title: "Error", description: "Invalid invoice or customer ID.", variant: "destructive" });
         router.push('/options');
         return;
      }

      setIsLoading(true);
      try {
        const customerDetails = await getCustomerDetails(customerId);
        if (!customerDetails) {
          toast({ title: "Error", description: "Could not find customer data.", variant: "destructive" });
          router.push('/search-customers');
          return;
        }

        // Find the specific invoice and parse its date
        const rawInvoice = customerDetails.invoices?.find(inv => inv.invoiceId === invoiceId);
        if (!rawInvoice) {
           toast({ title: "Error", description: "Could not find the specified invoice.", variant: "destructive" });
           router.push(`/view-customer/${customerId}`); // Go back to customer view
           return;
        }

        // Ensure invoice date is a Date object
        const invoice: InvoiceDetail = {
           ...rawInvoice,
           dateTime: new Date(rawInvoice.dateTime), // Parse date string
           // Ensure products array exists
           products: rawInvoice.products || [],
        };


        // Find the latest prescription before or on the invoice date
        let relevantPrescription: PrescriptionDetail | null = null;
        if (customerDetails.prescriptions && customerDetails.prescriptions.length > 0) {
            const sortedPrescriptions = [...customerDetails.prescriptions]
                .map(p => ({ ...p, prescriptionDate: p.prescriptionDate ? new Date(p.prescriptionDate) : null })) // Parse dates
                .sort((a, b) => (b.prescriptionDate?.getTime() ?? 0) - (a.prescriptionDate?.getTime() ?? 0)); // Sort descending

            relevantPrescription = sortedPrescriptions.find(p => p.prescriptionDate && p.prescriptionDate <= invoice.dateTime) || sortedPrescriptions[0] || null; // Find latest relevant or just the latest
        }


        setPrintData({
          id: customerDetails.id,
          name: customerDetails.name,
          phone: customerDetails.phone,
          invoice: invoice,
          prescription: relevantPrescription ? { ...relevantPrescription, prescriptionDate: relevantPrescription.prescriptionDate } : null, // Pass parsed date
        });

      } catch (error) {
        console.error("Fetch Print Data Error:", error);
        toast({ title: "Error", description: "Failed to load data for printing.", variant: "destructive" });
        router.push(`/view-customer/${customerId}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceIdStr, customerIdStr, router, toast]);

  const handlePrint = () => {
    window.print();
  };

  // Calculate subtotal dynamically
   const calculateSubTotal = (products?: ProductDetail[]): number => {
        if (!products || products.length === 0) {
            return 0;
        }
        return products.reduce((sum, p) => sum + (p.total || 0), 0);
    };

  // --- Loading State ---
  if (isLoading) {
    return (
      <div className="p-8 print:p-0">
         <div className="flex justify-end mb-4 print:hidden">
                <Skeleton className="h-10 w-24" />
         </div>
        <div className="max-w-4xl mx-auto bg-white p-8 border border-gray-300 shadow-lg print:shadow-none print:border-none">
          <Skeleton className="h-16 w-1/3 mb-8" /> {/* Logo Area */}
          <Skeleton className="h-6 w-1/4 mb-4" /> {/* Invoice Title */}
           <div className="grid grid-cols-2 gap-4 mb-6">
               <Skeleton className="h-4 w-3/4" />
               <Skeleton className="h-4 w-3/4 justify-self-end" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-full justify-self-end" />
            </div>
            <Skeleton className="h-40 w-full mb-6" /> {/* Product Table */}
            <Skeleton className="h-20 w-1/2 ml-auto mb-8" /> {/* Totals */}
            <Skeleton className="h-6 w-1/4 mb-4" /> {/* Prescription Title */}
             <Skeleton className="h-24 w-full" /> {/* Prescription Table */}
        </div>
      </div>
    );
  }

  // --- No Data State ---
   if (!printData || !printData.invoice) {
    return (
      <div className="p-8 print:p-0 text-center text-muted-foreground">
        Could not load print data or invoice details are missing.
         <Button onClick={() => router.back()} variant="link" className="block mx-auto mt-4">Go Back</Button>
      </div>
    );
  }

  const { invoice, prescription, name, phone } = printData;
  const subTotal = calculateSubTotal(invoice.products); // Calculate subtotal

  // --- Render Printable Content ---
  return (
    <div className="p-4 md:p-8 print:p-0 bg-secondary print:bg-white">
        <div className="flex justify-between items-center mb-4 print:hidden">
            <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
        </div>

      {/* --- Printable Area --- */}
      <div id="printable-area" className="max-w-4xl mx-auto bg-white p-6 md:p-10 border border-gray-300 shadow-lg print:shadow-none print:border-none print:p-0">

        {/* Header with Logo */}
        <div className="flex justify-between items-center border-b pb-4 mb-6">
          <div className="flex items-center gap-3">
                {/* Placeholder for Logo */}
                <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-glasses"><path d="M6 15h.01"/><path d="M18 15h.01"/><path d="M3 15a2 2 0 0 1-2-2V9a4 4 0 0 1 4-4h1"/><path d="M21 15a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4h-1"/><path d="M7.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1A1.5 1.5 0 0 1 5 12.5v0A1.5 1.5 0 0 1 6.5 11h1Z"/><path d="M16.5 11a1.5 1.5 0 0 1 1.5 1.5v0a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5v0a1.5 1.5 0 0 1 1.5-1.5h1Z"/><path d="M10 15h4"/></svg>
            <div>
              <h1 className="text-2xl font-bold text-primary">VisionClear Optical Shop</h1>
              <p className="text-sm text-muted-foreground">Your Address Here | Your Phone Here</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-semibold">INVOICE</h2>
            <p className="text-sm">Bill No: {invoice.billNumber}</p>
            <p className="text-sm">Date: {invoice.dateTime instanceof Date ? format(invoice.dateTime, 'PPp') : 'Invalid Date'}</p>
          </div>
        </div>

        {/* Customer Details */}
        <div className="mb-6">
          <h3 className="font-semibold mb-1">Bill To:</h3>
          <p>{name}</p>
          <p>{phone}</p>
        </div>

        {/* Products Table */}
         <table className="w-full text-sm mb-6 border-collapse">
            <thead className="border-b bg-muted/50">
                <tr>
                    <th className="text-left font-semibold p-2">#</th>
                    <th className="text-left font-semibold p-2">Product / Service</th>
                    <th className="text-right font-semibold p-2">Price</th>
                    <th className="text-right font-semibold p-2">Quantity</th>
                    <th className="text-right font-semibold p-2">Total</th>
                </tr>
            </thead>
             <tbody>
                 {invoice.products && invoice.products.length > 0 ? (
                     invoice.products.map((item, index) => (
                        <tr key={index} className="border-b">
                            <td className="p-2">{index + 1}</td>
                            <td className="p-2">{item.name}</td>
                            <td className="text-right p-2">{item.price?.toFixed(2) ?? '0.00'}</td>
                            <td className="text-right p-2">{item.quantity ?? 0}</td>
                            <td className="text-right p-2">{item.total?.toFixed(2) ?? '0.00'}</td>
                        </tr>
                     ))
                 ) : (
                     <tr>
                         <td colSpan={5} className="text-center p-4 text-muted-foreground">No products listed for this invoice.</td>
                     </tr>
                 )}
             </tbody>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end mb-8">
            <div className="w-full md:w-1/2 lg:w-1/3 space-y-1 text-sm">
                 <div className="flex justify-between">
                    <span>Sub Total:</span>
                    <span>{subTotal.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>{invoice.discount?.toFixed(2) ?? '0.00'}</span>
                </div>
                 <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Net Price:</span>
                    <span>{invoice.netPrice?.toFixed(2) ?? '0.00'}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Advance Paid:</span>
                    <span>{invoice.advanceAmount?.toFixed(2) ?? '0.00'}</span>
                </div>
                 <div className="flex justify-between font-semibold border-t pt-1 text-base">
                    <span>Balance Due:</span>
                    <span>{invoice.balanceAmount?.toFixed(2) ?? '0.00'}</span>
                </div>
            </div>
        </div>

        {/* Prescription Section (Only if data exists) */}
        {prescription && (
          <div className="border-t pt-6 mt-8">
            <h2 className="text-lg font-semibold mb-4">Prescription Details</h2>
             {prescription.prescriptionDate && <p className="text-sm mb-3 text-muted-foreground">Prescription Date: {format(new Date(prescription.prescriptionDate), 'PP')}</p>}
             <table className="w-full text-sm border-collapse">
                 <thead className="border-b bg-muted/50">
                    <tr>
                        <th className="p-2 text-center font-semibold">Eye</th>
                        <th className="p-2 text-center font-semibold">SPH</th>
                        <th className="p-2 text-center font-semibold">CYL</th>
                        <th className="p-2 text-center font-semibold">Axis</th>
                        <th className="p-2 text-center font-semibold">Add</th>
                        <th className="p-2 text-center font-semibold">PD</th>
                    </tr>
                 </thead>
                 <tbody>
                    <tr className="border-b">
                         <td className="p-2 text-center font-semibold">RE</td>
                         <td className="p-2 text-center">{prescription.sph_re?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.cyl_re?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.axis_re ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.add_re?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.pd_re?.toFixed(1) ?? '-'}</td>
                    </tr>
                     <tr>
                         <td className="p-2 text-center font-semibold">LE</td>
                         <td className="p-2 text-center">{prescription.sph_le?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.cyl_le?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.axis_le ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.add_le?.toFixed(2) ?? '-'}</td>
                         <td className="p-2 text-center">{prescription.pd_le?.toFixed(1) ?? '-'}</td>
                    </tr>
                 </tbody>
            </table>
          </div>
        )}

         {/* Footer */}
         <div className="border-t pt-4 mt-8 text-center text-xs text-muted-foreground">
            Thank you for your business! | VisionClear Optical Shop
         </div>

      </div>
       {/* --- End Printable Area --- */}

       {/* Add print-specific CSS */}
       <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            margin: 0; /* Remove default browser margins */
            background-color: white; /* Ensure background is white */
          }
          .print\:hidden {
            display: none !important; /* Ensure elements are hidden */
          }
           .print\:p-0 {
             padding: 0 !important;
          }
           .print\:shadow-none {
                box-shadow: none !important;
           }
           .print\:border-none {
                border: none !important;
           }
           .print\:bg-white {
                background-color: white !important;
           }
           /* Add page break avoidance */
            table, figure {
                page-break-inside: avoid;
            }
            h1, h2, h3, h4, h5, h6 {
                 page-break-after: avoid;
            }
            thead {
                 display: table-header-group; /* Ensure thead repeats on new pages */
            }
        }
      `}</style>
    </div>
  );
}
