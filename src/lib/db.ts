
import {
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
    writeBatch,
    QueryConstraint,
    collectionGroup,
    runTransaction,
    FirestoreError // Import FirestoreError
} from "firebase/firestore";
import { db } from "./firebase"; // Import the initialized Firestore instance
import { format, getMonth, getYear, isEqual, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

// Define collection names
const CUSTOMERS_COLLECTION = "customers";
const PRESCRIPTIONS_COLLECTION = "prescriptions";
const INVOICES_COLLECTION = "invoices";
const PRODUCTS_COLLECTION = "products"; // Subcollection under invoices
const TRANSACTIONS_COLLECTION = "transactions"; // Consider if this is needed; currently removed from UI
const BILL_COUNTER_DOC = "counters/billCounter"; // Document to track the last bill number

// --- Interfaces (Adjust IDs to string for Firestore) ---

export interface CustomerData {
  name: string;
  phone: string;
  createdAt: Timestamp; // Track creation time
  // Add other customer fields
}

export interface PrescriptionData {
  customerId: string; // Firestore document ID (string)
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
  prescriptionDate: Timestamp; // Use Firestore Timestamp
}

export interface ProductData {
  // invoiceId: string; // No longer needed directly on product, it's nested
  name: string;
  price: number;
  quantity: number;
  total: number; // Keep calculated total for easier display
}

export interface InvoiceData {
  customerId: string; // Firestore document ID (string)
  billNumber: string;
  dateTime: Timestamp; // Use Firestore Timestamp
  discount: number;
  netPrice: number;
  advanceAmount: number;
  balanceAmount: number;
  // Products will be stored as a subcollection
}

// Combined types for fetching details
export interface PrescriptionDetail extends Omit<PrescriptionData, 'prescriptionDate'> {
    id: string; // Prescription document ID
    prescriptionDate: Date; // Converted to Date for client-side use
}

export interface ProductDetail extends ProductData {
    id: string; // Product document ID (within subcollection)
    invoiceId: string; // Add invoice ID for reference when fetching flat
}

export interface InvoiceDetail extends Omit<InvoiceData, 'dateTime'> {
    invoiceId: string; // Invoice document ID
    dateTime: Date; // Converted to Date for client-side use
    products?: ProductDetail[]; // Populated after fetching
}

export interface FullCustomerData extends Omit<CustomerData, 'createdAt'> {
    id: string; // Customer document ID
    createdAt: Date; // Converted to Date for client-side use
    prescriptions?: PrescriptionDetail[];
    invoices?: InvoiceDetail[];
    // transactions removed
}

// Interface for search criteria
export interface SearchCriteria {
    phone?: string;
    date?: Date | null;
    month?: number | null; // 1-12
    year?: number | null;
}

// Interface for search results
export interface CustomerSearchResult {
  id: string; // Firestore document ID
  name: string;
  phone: string;
  firstInvoiceDate?: Date | null; // Date of the earliest invoice (converted)
}


// --- Firestore Functions ---

// Helper to convert Firestore Timestamps to Dates in nested objects
function convertTimestampsToDates(data: any): any {
    if (!data) return data;
    if (data instanceof Timestamp) {
        return data.toDate();
    }
    if (Array.isArray(data)) {
        return data.map(convertTimestampsToDates);
    }
    if (typeof data === 'object') {
        const newData: { [key: string]: any } = {};
        for (const key in data) {
            newData[key] = convertTimestampsToDates(data[key]);
        }
        return newData;
    }
    return data;
}

export async function saveCustomer(data: Omit<CustomerData, 'createdAt'>): Promise<{ id: string }> {
  console.log("Saving customer to Firestore:", data);
  try {
    // Check if customer with this phone number already exists
    const q = query(collection(db, CUSTOMERS_COLLECTION), where("phone", "==", data.phone));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Customer exists, return existing ID
      const existingCustomer = querySnapshot.docs[0];
      console.log("Customer already exists with ID:", existingCustomer.id);
      return { id: existingCustomer.id };
    } else {
      // Customer does not exist, add new customer
      const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), {
        ...data,
        createdAt: Timestamp.now(), // Add creation timestamp
      });
      console.log("Customer saved with ID:", docRef.id);
      return { id: docRef.id };
    }
  } catch (error) {
    console.error("Error saving customer:", error);
    throw new Error("Failed to save customer data.");
  }
}

export async function savePrescription(data: Omit<PrescriptionData, 'prescriptionDate'> & { prescriptionDate?: Date }): Promise<void> {
    console.log("Saving prescription to Firestore:", data);
    try {
        const prescriptionPayload: PrescriptionData = {
            ...data,
            prescriptionDate: data.prescriptionDate ? Timestamp.fromDate(data.prescriptionDate) : Timestamp.now(),
        };
        await addDoc(collection(db, PRESCRIPTIONS_COLLECTION), prescriptionPayload);
        console.log("Prescription saved successfully for customer:", data.customerId);
    } catch (error) {
        console.error("Error saving prescription:", error);
        throw new Error("Failed to save prescription data.");
    }
}

export async function saveInvoice(data: Omit<InvoiceData, 'dateTime'> & { dateTime: Date }): Promise<{ id: string }> {
  console.log("Saving invoice to Firestore:", data);
  try {
    const invoicePayload: InvoiceData = {
        ...data,
        dateTime: Timestamp.fromDate(data.dateTime),
    };
    const docRef = await addDoc(collection(db, INVOICES_COLLECTION), invoicePayload);
    console.log("Invoice saved with ID:", docRef.id);
    return { id: docRef.id };
  } catch (error) {
    console.error("Error saving invoice:", error);
    throw new Error("Failed to save invoice data.");
  }
}

export async function saveProducts(invoiceId: string, products: Omit<ProductData, 'invoiceId' | 'total'>[]): Promise<void> {
  console.log(`Saving ${products.length} products for invoice ${invoiceId} to Firestore:`);
  try {
    const batch = writeBatch(db);
    const productsRef = collection(db, INVOICES_COLLECTION, invoiceId, PRODUCTS_COLLECTION);

    products.forEach((product) => {
      // Recalculate total just before saving, ensure price/quantity are numbers
      const price = Number(product.price) || 0;
      const quantity = Number(product.quantity) || 0;
      const total = price * quantity;
      const productWithTotal: ProductData = {
          ...product,
          price,
          quantity,
          total,
      };
      const docRef = doc(productsRef); // Generate unique ID for each product document
      batch.set(docRef, productWithTotal);
    });

    await batch.commit();
    console.log("Products saved successfully for invoice:", invoiceId);
  } catch (error) {
    console.error("Error saving products:", error);
    throw new Error("Failed to save product data.");
  }
}

// Transaction saving removed as per request

// Updated findCustomers function for Firestore
export async function findCustomers(criteria: SearchCriteria): Promise<CustomerSearchResult[]> {
    console.log("Finding customers in Firestore by criteria:", criteria);
    try {
        const customerQueryConstraints: QueryConstraint[] = [];
        const invoiceQueryConstraints: QueryConstraint[] = [];
        let filterByInvoice = false;

        if (criteria.phone) {
            // Firestore 'LIKE' equivalent requires more complex solutions (e.g., N-grams, external search service)
            // For simplicity, we'll use '==' or '>=' and '<=' for prefix search if needed.
            // Using '==' for exact match here. Adjust if partial matching is critical.
            customerQueryConstraints.push(where("phone", "==", criteria.phone));
        }

        if (criteria.date) {
            const startDate = Timestamp.fromDate(startOfDay(criteria.date));
            const endDate = Timestamp.fromDate(endOfDay(criteria.date));
            invoiceQueryConstraints.push(where("dateTime", ">=", startDate));
            invoiceQueryConstraints.push(where("dateTime", "<=", endDate));
            filterByInvoice = true;
        } else if (criteria.month && criteria.year) {
            const date = new Date(criteria.year, criteria.month - 1, 1);
            const startDate = Timestamp.fromDate(startOfMonth(date));
            const endDate = Timestamp.fromDate(endOfMonth(date));
            invoiceQueryConstraints.push(where("dateTime", ">=", startDate));
            invoiceQueryConstraints.push(where("dateTime", "<=", endDate));
            filterByInvoice = true;
        } else if (criteria.year) {
             const date = new Date(criteria.year, 0, 1); // Jan 1st of the year
             const startDate = Timestamp.fromDate(startOfYear(date));
             const endDate = Timestamp.fromDate(endOfYear(date));
             invoiceQueryConstraints.push(where("dateTime", ">=", startDate));
             invoiceQueryConstraints.push(where("dateTime", "<=", endDate));
             filterByInvoice = true;
        }

        let customerIdsFromInvoices: Set<string> | null = null;

        // If filtering by invoice date criteria, fetch matching invoice customer IDs first
        if (filterByInvoice) {
            customerIdsFromInvoices = new Set<string>();
            const invoicesQuery = query(collection(db, INVOICES_COLLECTION), ...invoiceQueryConstraints);
            const invoiceSnapshots = await getDocs(invoicesQuery);
            invoiceSnapshots.forEach(doc => {
                customerIdsFromInvoices?.add(doc.data().customerId);
            });
            // If no invoices match date criteria, no customers will be found (unless phone also matches)
            if (customerIdsFromInvoices.size === 0 && !criteria.phone) {
                console.log("No invoices found matching date criteria, returning empty.");
                return [];
            }
             // If phone is also provided, add the invoice constraint to the customer query
             if (criteria.phone && customerIdsFromInvoices.size === 0) {
                // Phone provided but no invoices match date, so no results possible for combination
                 console.log("Phone provided, but no invoices match date criteria, returning empty.");
                return [];
             } else if (customerIdsFromInvoices.size > 0) {
                 // Query for customers whose IDs are in the set. Max 30 elements for 'in' query in Firestore.
                 // Chunking logic for > 30 IDs.
                 const idChunks = Array.from(customerIdsFromInvoices).reduce((acc, item, index) => {
                    const chunkIndex = Math.floor(index / 30); // Firestore 'in' limit is 30
                    if (!acc[chunkIndex]) {
                        acc[chunkIndex] = [];
                    }
                    acc[chunkIndex].push(item);
                    return acc;
                 }, [] as string[][]);

                 // Apply 'in' constraints or filter later if combined with phone
                 if (!criteria.phone) {
                     // If only filtering by date, apply 'in' directly
                     customerQueryConstraints.push(where("__name__", "in", idChunks[0])); // Add first chunk
                     // TODO: Handle multiple chunks if idChunks.length > 1
                 }
                 // If phone is also present, the customer query already includes phone,
                 // we will filter the results afterwards to ensure ID is in customerIdsFromInvoices
             }
        }


        // Fetch customers based on constraints
        console.log("Customer query constraints:", customerQueryConstraints);
        const customersQuery = query(collection(db, CUSTOMERS_COLLECTION), ...customerQueryConstraints);
        const customerSnapshots = await getDocs(customersQuery);
        console.log(`Found ${customerSnapshots.size} potential customer documents.`);

        const resultsMap = new Map<string, CustomerSearchResult>();

        // Process customer results
        customerSnapshots.forEach(doc => {
            // If filtering by invoice date and phone, ensure customer ID is in the invoice set
            if (filterByInvoice && criteria.phone && customerIdsFromInvoices && !customerIdsFromInvoices.has(doc.id)) {
                console.log(`Skipping customer ${doc.id} because phone matched but not in invoice date results.`);
                return; // Skip customer if they don't match both phone and date criteria
            }
             if (!resultsMap.has(doc.id)) {
                 const data = doc.data() as CustomerData;
                 resultsMap.set(doc.id, {
                    id: doc.id,
                    name: data.name,
                    phone: data.phone,
                    firstInvoiceDate: undefined // Will be populated later
                });
            }
        });

        // Fetch earliest invoice date for each found customer (if needed for sorting/display)
        const customerIds = Array.from(resultsMap.keys());
        if (customerIds.length > 0) {
            console.log(`Fetching first invoice date for ${customerIds.length} customers.`);
             // Handle 'in' query limit (30) if necessary by chunking customerIds
            const idChunks = customerIds.reduce((acc, item, index) => {
                    const chunkIndex = Math.floor(index / 30); // Firestore 'in' limit is 30
                    if (!acc[chunkIndex]) {
                        acc[chunkIndex] = [];
                    }
                    acc[chunkIndex].push(item);
                    return acc;
            }, [] as string[][]);

            const firstInvoiceDates: Record<string, Date> = {};

            for (const chunk of idChunks) {
                const firstInvoiceQuery = query(
                    collection(db, INVOICES_COLLECTION),
                    where("customerId", "in", chunk),
                    orderBy("dateTime", "asc")
                    // No limit needed, Firestore fetches all matching in the chunk
                );
                const firstInvoiceSnapshots = await getDocs(firstInvoiceQuery);

                firstInvoiceSnapshots.forEach(doc => {
                    const data = doc.data() as InvoiceData;
                    // Store only the *first* date encountered for each customer ID across chunks
                    if (!firstInvoiceDates[data.customerId]) {
                        firstInvoiceDates[data.customerId] = data.dateTime.toDate();
                    }
                });
            }


            customerIds.forEach(id => {
                const result = resultsMap.get(id);
                if (result && firstInvoiceDates[id]) {
                    result.firstInvoiceDate = firstInvoiceDates[id];
                }
            });
        }


        const finalResults = Array.from(resultsMap.values());

        // Sort results by firstInvoiceDate (newest first)
        finalResults.sort((a, b) => {
            const dateA = a.firstInvoiceDate?.getTime() ?? 0;
            const dateB = b.firstInvoiceDate?.getTime() ?? 0;
            return dateB - dateA; // Descending order
        });

        console.log(`Returning ${finalResults.length} sorted customer results.`);
        return finalResults;

    } catch (error) {
        console.error("Error finding customers:", error);
        throw new Error(`Failed to search for customers: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export async function getCustomerDetails(customerId: string): Promise<FullCustomerData | null> {
    console.log("Getting customer details from Firestore:", customerId);
    try {
        const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        const customerSnap = await getDoc(customerDocRef);

        if (!customerSnap.exists()) {
            console.log("No customer found with ID:", customerId);
            return null;
        }

        const customerData = customerSnap.data() as CustomerData;

        // Fetch Prescriptions
        const prescriptionsQuery = query(collection(db, PRESCRIPTIONS_COLLECTION), where("customerId", "==", customerId), orderBy("prescriptionDate", "desc"));
        const prescriptionsSnap = await getDocs(prescriptionsQuery);
        const prescriptions = prescriptionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        })) as (PrescriptionData & { id: string })[];

        // Fetch Invoices
        const invoicesQuery = query(collection(db, INVOICES_COLLECTION), where("customerId", "==", customerId), orderBy("dateTime", "desc"));
        const invoicesSnap = await getDocs(invoicesQuery);

        const invoicesWithProductsPromises = invoicesSnap.docs.map(async (invoiceDoc) => {
            const invoiceData = invoiceDoc.data() as InvoiceData;
            const productsRef = collection(invoiceDoc.ref, PRODUCTS_COLLECTION);
            const productsSnap = await getDocs(productsRef);
            const products = productsSnap.docs.map(prodDoc => ({
                id: prodDoc.id,
                invoiceId: invoiceDoc.id, // Add invoice ID for reference
                ...prodDoc.data(),
            })) as ProductDetail[];

            return {
                invoiceId: invoiceDoc.id,
                ...invoiceData,
                products: products,
            };
        });

        const invoices = await Promise.all(invoicesWithProductsPromises);

        // Transactions removed

        const fullData: FullCustomerData = convertTimestampsToDates({
            id: customerSnap.id,
            ...customerData,
            prescriptions: prescriptions,
            invoices: invoices,
            // transactions: [], // Empty array as transactions are removed
        });


        return fullData;

    } catch (error) {
        console.error("Error getting customer details:", error);
        throw new Error("Failed to load customer details.");
    }
}


export async function updateCustomer(customerId: string, data: Partial<Omit<CustomerData, 'createdAt'>>): Promise<void> {
  console.log(`Updating customer ${customerId} in Firestore:`, data);
  try {
    const docRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await updateDoc(docRef, data);
    console.log("Customer updated successfully.");
  } catch (error) {
    console.error("Error updating customer:", error);
    throw new Error("Failed to update customer data.");
  }
}

export async function deleteCustomer(customerId: string): Promise<void> {
    console.log(`Deleting customer ${customerId} and related data from Firestore`);
    try {
        const batch = writeBatch(db);

        // 1. Delete Prescriptions
        const prescriptionsQuery = query(collection(db, PRESCRIPTIONS_COLLECTION), where("customerId", "==", customerId));
        const prescriptionsSnap = await getDocs(prescriptionsQuery);
        prescriptionsSnap.forEach(doc => batch.delete(doc.ref));
        console.log(`Marked ${prescriptionsSnap.size} prescriptions for deletion.`);

        // 2. Delete Invoices and their Products (subcollections)
        const invoicesQuery = query(collection(db, INVOICES_COLLECTION), where("customerId", "==", customerId));
        const invoicesSnap = await getDocs(invoicesQuery);
        console.log(`Found ${invoicesSnap.size} invoices for deletion.`);

        // Need to separately query and delete subcollections for each invoice.
        // This part cannot reliably be done in a single atomic batch if subcollections are large,
        // but for typical invoice sizes, it should be okay. Consider Cloud Functions for large-scale deletes.
        for (const invoiceDoc of invoicesSnap.docs) {
             console.log(`Marking products for invoice ${invoiceDoc.id} for deletion.`);
             const productsRef = collection(invoiceDoc.ref, PRODUCTS_COLLECTION);
             const productsSnap = await getDocs(productsRef);
             productsSnap.forEach(prodDoc => batch.delete(prodDoc.ref));
             console.log(`Marked ${productsSnap.size} products for invoice ${invoiceDoc.id}.`);
             // Add invoice deletion to batch AFTER handling subcollection
             batch.delete(invoiceDoc.ref);
        }


        // 3. Delete Customer document
        const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
        batch.delete(customerDocRef);
        console.log(`Marked customer document ${customerId} for deletion.`);

        // Commit the batch
        await batch.commit();
        console.log(`Customer ${customerId} and associated data deleted successfully.`);

    } catch (error) {
        console.error("Error deleting customer:", error);
         if (error instanceof FirestoreError) {
             console.error(`Firestore Error Code: ${error.code}`);
             console.error(`Firestore Error Message: ${error.message}`);
         }
        throw new Error(`Failed to delete customer and associated data: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function getNextBillNumber(): Promise<string> {
    console.log("Fetching next bill number from Firestore");
    const counterRef = doc(db, BILL_COUNTER_DOC);

    try {
        let nextNumber: number;
        await runTransaction(db, async (transaction) => {
            const counterSnap = await transaction.get(counterRef);
            if (!counterSnap.exists()) {
                console.log("Bill counter document not found, initializing to 1.");
                // IMPORTANT: Ensure the user/service account has permission to create this document.
                transaction.set(counterRef, { lastNumber: 1 });
                nextNumber = 1;
            } else {
                const lastNumber = counterSnap.data().lastNumber;
                if (typeof lastNumber !== 'number' || !Number.isInteger(lastNumber)) {
                    console.error("Invalid 'lastNumber' in counter document:", lastNumber, "Resetting to 1.");
                    nextNumber = 1;
                    transaction.set(counterRef, { lastNumber: 1 }); // Reset if invalid
                } else {
                    nextNumber = lastNumber + 1;
                     console.log(`Last number was ${lastNumber}, setting next to ${nextNumber}.`);
                    transaction.update(counterRef, { lastNumber: nextNumber });
                }
            }
        });
         // nextNumber should be defined after successful transaction
         // Add defensive check just in case transaction logic fails silently (shouldn't happen)
         if (typeof nextNumber! !== 'number') {
             throw new Error("Transaction completed but next bill number is not defined.");
         }
         const formattedBillNumber = `INV-${nextNumber!.toString().padStart(3, '0')}`;
         console.log("Returning next bill number:", formattedBillNumber);
         return formattedBillNumber;
    } catch (error) {
         console.error("Error fetching/updating bill number in transaction:", error);
         let errorMessage = "Failed to get the next bill number.";
          if (error instanceof FirestoreError) {
             console.error(`Firestore Error Code: ${error.code}`);
             console.error(`Firestore Error Message: ${error.message}`);
             if (error.code === 'permission-denied') {
                 errorMessage = "Permission denied when accessing bill counter. Check Firestore security rules for 'counters/billCounter'.";
             } else {
                 errorMessage = `Firestore error getting bill number: ${error.message}`;
             }
         } else if (error instanceof Error) {
            errorMessage = `Error getting bill number: ${error.message}`;
         }
         // Fallback or re-throw
         throw new Error(errorMessage);
    }
}

    