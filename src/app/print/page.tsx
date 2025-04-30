
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';

import useAuth, { AuthLoadingScreen } from '@/hooks/useAuth'; // Import AuthLoadingScreen
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
// Import Firestore functions and types
import { getCustomerDetails, FullCustomerData, InvoiceDetail, PrescriptionDetail, ProductDetail } from "@/lib/db";
import { useToast } from "@/hooks/use-toast";
import VisionClearLogo from "@/components/icons/VisionClearLogo"; // Import the logo
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"; // Added Table components

// Define a type specific to print page data structure
interface CustomerPrintData {
  id: string; // Customer ID
  name: string;
  phone: string;
  invoice: InvoiceDetail | null; // The specific invoice to print
  prescription: PrescriptionDetail | null; // Relevant prescription
}


export default function PrintPage() {
  const isLoadingAuth = useAuth(); // Protect the route and get loading state
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceId = searchParams.get('invoiceId'); // String ID from Firestore
  const customerId = searchParams.get('customerId'); // String ID from Firestore
  const [printData, setPrintData] = React.useState<CustomerPrintData | null>(null);
  const [isLoadingData, setIsLoadingData] = React.useState(true); // Renamed isLoading

  React.useEffect(() => {
    // Don't fetch if auth is still loading or IDs are missing
     if (isLoadingAuth || !invoiceId || !customerId) {
         // Handle missing IDs potentially earlier if needed
         if (!isLoadingAuth && (!invoiceId || !customerId)) {
            toast({ title: "Error", description: "Missing invoice or customer ID for printing.", variant: "destructive" });
            router.push('/options');
         }
        return;
      }


    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch full customer details using Firestore function
        const customerDetails: FullCustomerData | null = await getCustomerDetails(customerId);

        if (!customerDetails) {
          toast({ title: "Error", description: "Could not find customer data.", variant: "destructive" });
          router.push('/search-customers'); // Or back to where they came from
          return;
        }

        // Find the specific invoice within the fetched customer data
        const invoiceToPrint = customerDetails.invoices?.find(inv => inv.invoiceId === invoiceId);

        if (!invoiceToPrint) {
           toast({ title: "Error", description: "Could not find the specified invoice for this customer.", variant: "destructive" });
           router.push(`/view-customer/${customerId}`); // Go back to customer view
           return;
        }

        // Find the latest prescription dated before or on the invoice date
        let relevantPrescription: PrescriptionDetail | null = null;
        if (customerDetails.prescriptions && customerDetails.prescriptions.length > 0) {
            // Ensure prescription dates are Date objects (should be already from getCustomerDetails)
            const sortedPrescriptions = [...customerDetails.prescriptions]
                .sort((a, b) => (b.prescriptionDate?.getTime() ?? 0) - (a.prescriptionDate?.getTime() ?? 0)); // Sort descending

            // Find the latest prescription whose date is less than or equal to the invoice date
            relevantPrescription = sortedPrescriptions.find(p => p.prescriptionDate && p.prescriptionDate <= invoiceToPrint.dateTime) || sortedPrescriptions[0] || null; // Fallback to the absolute latest if no earlier one found
        }

        setPrintData({
          id: customerDetails.id,
          name: customerDetails.name,
          phone: customerDetails.phone,
          invoice: invoiceToPrint, // Pass the found invoice
          prescription: relevantPrescription, // Pass the relevant prescription
        });

      } catch (error) {
        console.error("Fetch Print Data Error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        toast({ title: "Error", description: `Failed to load data for printing: ${errorMessage}`, variant: "destructive" });
        // Redirect back, maybe to customer view if possible
         if (customerId) {
            router.push(`/view-customer/${customerId}`);
         } else {
             router.push('/search-customers');
         }
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, customerId, router, toast, isLoadingAuth]); // Added isLoadingAuth dependency

  const handlePrint = () => {
    window.print();
  };

  // Calculate subtotal dynamically
   const calculateSubTotal = (products?: ProductDetail[]): number => {
        if (!products || products.length === 0) {
            return 0;
        }
        // Ensure 'total' is treated as a number
        return products.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    };

  // --- Loading State ---
   // Show loading screen while authentication or data fetching is in progress
   if (isLoadingAuth || isLoadingData) {
     return <AuthLoadingScreen />; // Or a more specific loading indicator
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
  // Ensure products exist and calculate subtotal
   const products = invoice.products || [];
   const subTotal = calculateSubTotal(products);
  const shopAddress = "22,Dharmaraja Kovil street, 60006, opposite Alandur, Alandur, Chennai, Tamil Nadu 600016";
  const shopPhone = "9092196263";


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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 mb-6">
           <div className="flex items-center gap-3 mb-4 md:mb-0">
                <VisionClearLogo width={150} height={60} />
                {/* Shop details removed from here, placed below logo */}
           </div>
          <div className="text-left md:text-right w-full md:w-auto">
             {/* Shop Details */}
            <div className="mb-2 md:mb-0">
              {/* <h1 className="text-xl font-bold text-primary">Vision Clear Opticals</h1> */}
              <p className="text-xs text-muted-foreground">{shopAddress}</p>
              <p className="text-xs text-muted-foreground">Phone: {shopPhone}</p>
            </div>
             {/* Invoice Details */}
            <h2 className="text-xl font-semibold mt-2">INVOICE</h2>
            <p className="text-sm">Bill No: {invoice.billNumber}</p>
            {/* Ensure dateTime is a Date object before formatting */}
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
         <Table className="w-full text-sm mb-6 border-collapse">
            <TableHeader className="border-b bg-muted/50">
                <TableRow>
                    <TableHead className="text-left font-semibold p-2">#</TableHead>
                    <TableHead className="text-left font-semibold p-2">Product / Service</TableHead>
                    <TableHead className="text-right font-semibold p-2">Price</TableHead>
                    <TableHead className="text-right font-semibold p-2">Quantity</TableHead>
                    <TableHead className="text-right font-semibold p-2">Total</TableHead>
                </TableRow>
            </TableHeader>
             <TableBody>
                 {products.length > 0 ? (
                     products.map((item, index) => (
                        <TableRow key={item.id} className="border-b"> {/* Use item.id from Firestore */}
                            <TableCell className="p-2">{index + 1}</TableCell>
                            <TableCell className="p-2">{item.name}</TableCell>
                             {/* Ensure numeric conversion for calculations/display */}
                            <TableCell className="text-right p-2">{(Number(item.price) || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right p-2">{Number(item.quantity) || 0}</TableCell>
                            <TableCell className="text-right p-2">{(Number(item.total) || 0).toFixed(2)}</TableCell>
                        </TableRow>
                     ))
                 ) : (
                     <TableRow>
                         <TableCell colSpan={5} className="text-center p-4 text-muted-foreground">No products listed for this invoice.</TableCell>
                     </TableRow>
                 )}
             </TableBody>
        </Table>

        {/* Totals Section */}
        <div className="flex justify-end mb-8">
            <div className="w-full md:w-1/2 lg:w-1/3 space-y-1 text-sm">
                 <div className="flex justify-between">
                    <span>Sub Total:</span>
                    <span>{subTotal.toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Discount:</span>
                    {/* Ensure numeric conversion */}
                    <span>{(Number(invoice.discount) || 0).toFixed(2)}</span>
                </div>
                 <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Net Price:</span>
                    <span>{(Number(invoice.netPrice) || 0).toFixed(2)}</span>
                </div>
                 <div className="flex justify-between">
                    <span>Advance Paid:</span>
                    <span>{(Number(invoice.advanceAmount) || 0).toFixed(2)}</span>
                </div>
                 <div className="flex justify-between font-semibold border-t pt-1 text-base">
                    <span>Balance Due:</span>
                    <span>{(Number(invoice.balanceAmount) || 0).toFixed(2)}</span>
                </div>
            </div>
        </div>

        {/* Prescription Section (Only if data exists) */}
        {prescription && (
          <div className="border-t pt-6 mt-8">
            <h2 className="text-lg font-semibold mb-4">Prescription Details</h2>
             {/* Ensure prescriptionDate is a Date object */}
             {prescription.prescriptionDate && <p className="text-sm mb-3 text-muted-foreground">Prescription Date: {format(prescription.prescriptionDate, 'PP')}</p>}
             <Table className="w-full text-sm border-collapse">
                 <TableHeader className="border-b bg-muted/50">
                    <TableRow>
                        <TableHead className="p-2 text-center font-semibold">Eye</TableHead>
                        <TableHead className="p-2 text-center font-semibold">SPH</TableHead>
                        <TableHead className="p-2 text-center font-semibold">CYL</TableHead>
                        <TableHead className="p-2 text-center font-semibold">Axis</TableHead>
                        <TableHead className="p-2 text-center font-semibold">Add</TableHead>
                        <TableHead className="p-2 text-center font-semibold">PD</TableHead>
                    </TableRow>
                 </TableHeader>
                 <TableBody>
                    <TableRow className="border-b">
                         <TableCell className="p-2 text-center font-semibold">RE</TableCell>
                         {/* Ensure numeric conversion and null checks */}
                         <TableCell className="p-2 text-center">{prescription.sph_re != null ? Number(prescription.sph_re).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.cyl_re != null ? Number(prescription.cyl_re).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.axis_re ?? '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.add_re != null ? Number(prescription.add_re).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.pd_re != null ? Number(prescription.pd_re).toFixed(1) : '-'}</TableCell>
                    </TableRow>
                     <TableRow>
                         <TableCell className="p-2 text-center font-semibold">LE</TableCell>
                         <TableCell className="p-2 text-center">{prescription.sph_le != null ? Number(prescription.sph_le).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.cyl_le != null ? Number(prescription.cyl_le).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.axis_le ?? '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.add_le != null ? Number(prescription.add_le).toFixed(2) : '-'}</TableCell>
                         <TableCell className="p-2 text-center">{prescription.pd_le != null ? Number(prescription.pd_le).toFixed(1) : '-'}</TableCell>
                    </TableRow>
                 </TableBody>
            </Table>
          </div>
        )}

         {/* Footer */}
         <div className="border-t pt-4 mt-8 text-center text-xs text-muted-foreground">
            Thank you for your business! | Vision Clear Opticals
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
                 page-break-inside: avoid;
            }
            thead {
                 display: table-header-group; /* Ensure thead repeats on new pages */
            }
             div {
                 page-break-inside: avoid;
            }
             #printable-area > div {
                 page-break-inside: avoid;
             }
             #printable-area > table {
                  page-break-inside: avoid;
             }
             .border-t {
                   page-break-before: auto; /* Allow break before prescription/footer if needed */
             }

        }
      `}</style>
    </div>
  );
}
