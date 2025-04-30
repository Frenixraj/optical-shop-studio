
// This is a placeholder file for database interactions.
// You would replace this with actual MySQL connection and query logic
// using a library like 'mysql2' or an ORM like Prisma or TypeORM.

// Example structure (replace with your actual implementation)

import { format, getMonth, getYear, isEqual, startOfDay } from "date-fns";

interface CustomerData {
  name: string;
  phone: string;
  // Add other customer fields
}

interface PrescriptionData {
  customerId: number; // Assuming foreign key relation
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
  prescriptionDate?: Date; // Add date field
}

interface ProductData {
  invoiceId: number; // Assuming foreign key relation
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface InvoiceData {
  invoiceId: number; // Added invoiceId here for clarity
  customerId: number; // Assuming foreign key relation
  billNumber: string;
  dateTime: Date;
  discount: number;
  netPrice: number;
  advanceAmount: number;
  balanceAmount: number;
  products?: ProductData[]; // Products associated with this invoice
}

interface TransactionData {
  customerId: number;
  date: Date;
  description: string;
  amount: number;
  type: 'debit' | 'credit'; // Example type
}

// Interface for search criteria
interface SearchCriteria {
    phone?: string;
    date?: Date | null;
    month?: number | null; // 1-12
    year?: number | null;
}

// Interface for search results
interface CustomerSearchResult {
  id: number;
  name: string;
  phone: string;
  firstInvoiceDate?: Date | null; // Date of the earliest invoice
}

// --- Placeholder Functions ---

export async function saveCustomer(data: CustomerData): Promise<{ id: number }> {
  console.log("Saving customer (placeholder):", data);
  // Replace with actual DB insert query for customer table
  // Return the newly created customer ID
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
  const mockId = Math.floor(Math.random() * 1000);
  // Store mock customer data (simple in-memory example)
  mockCustomers[mockId] = { id: mockId, ...data, prescriptions: [], invoices: [], transactions: [] };
  return { id: mockId };
}

export async function savePrescription(data: PrescriptionData): Promise<void> {
  console.log("Saving prescription (placeholder):", data);
  // Replace with actual DB insert query for prescription table
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
  // Add to mock data
  const customer = mockCustomers[data.customerId];
  if (customer) {
    if (!customer.prescriptions) customer.prescriptions = [];
     customer.prescriptions.unshift({ ...data, prescriptionDate: new Date() }); // Add date and prepend
  }
}

export async function saveInvoice(data: Omit<InvoiceData, 'invoiceId' | 'products'>): Promise<{ id: number }> {
  console.log("Saving invoice (placeholder):", data);
  // Replace with actual DB insert query for invoice table
  // Return the newly created invoice ID
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
  const mockId = Math.floor(Math.random() * 10000);
  // Add to mock data
  const customer = mockCustomers[data.customerId];
   if (customer) {
        if (!customer.invoices) customer.invoices = [];
        // Store date as Date object
        customer.invoices.unshift({ ...data, invoiceId: mockId, dateTime: new Date(data.dateTime), products: [] }); // Prepend, initialize products
    }
  return { id: mockId };
}

export async function saveProducts(products: ProductData[]): Promise<void> {
  console.log("Saving products (placeholder):", products);
  // Replace with actual DB insert query for products table (likely a loop or bulk insert)
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
   // Add to mock data - Assume all products belong to the same invoice for this batch
   if (products.length > 0) {
        const invoiceId = products[0].invoiceId;
        const customer = Object.values(mockCustomers).find(c => c.invoices?.some(inv => inv.invoiceId === invoiceId));
        if (customer) {
            const invoice = customer.invoices?.find(inv => inv.invoiceId === invoiceId);
            if (invoice) {
                if (!invoice.products) invoice.products = [];
                invoice.products.push(...products);
            }
        }
    }
}

export async function saveTransaction(data: TransactionData): Promise<void> {
  console.log("Saving transaction (placeholder):", data);
  // Replace with actual DB insert query for transactions table
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
   // Add to mock data
  const customer = mockCustomers[data.customerId];
  if (customer) {
      if (!customer.transactions) customer.transactions = [];
       // Store date as Date object
      customer.transactions.unshift({ ...data, date: new Date(data.date) }); // Prepend
  }
}

// Updated findCustomers function
export async function findCustomers(criteria: SearchCriteria): Promise<CustomerSearchResult[]> {
    console.log("Finding customers by criteria (placeholder):", criteria);
    // In a real DB: Construct a WHERE clause based on criteria.
    // SELECT c.id, c.name, c.phone, MIN(i.dateTime) as firstInvoiceDate
    // FROM customers c
    // LEFT JOIN invoices i ON c.id = i.customerId
    // WHERE
    //   (criteria.phone IS NULL OR c.phone LIKE ?) AND
    //   (criteria.date IS NULL OR DATE(i.dateTime) = ?) AND
    //   (criteria.month IS NULL OR MONTH(i.dateTime) = ?) AND
    //   (criteria.year IS NULL OR YEAR(i.dateTime) = ?)
    // GROUP BY c.id, c.name, c.phone
    // HAVING COUNT(i.invoiceId) > 0 OR criteria.phone IS NOT NULL -- Ensure match on date/month/year OR phone
    // ORDER BY firstInvoiceDate DESC;

    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate async operation

    // Filter mock data
    const results = Object.values(mockCustomers).filter(customer => {
        let phoneMatch = true;
        let dateMatch = true;

        // Check phone number
        if (criteria.phone && !customer.phone.includes(criteria.phone)) {
            phoneMatch = false;
        }

        // Check date criteria (only if phone doesn't match or isn't provided)
         const customerInvoices = customer.invoices || [];
         let invoiceDateMatch = false;

         if (criteria.date) {
            const searchDateStart = startOfDay(criteria.date);
            invoiceDateMatch = customerInvoices.some(inv => inv.dateTime && isEqual(startOfDay(new Date(inv.dateTime)), searchDateStart));
         } else if (criteria.month && criteria.year) {
             invoiceDateMatch = customerInvoices.some(inv => {
                 if (!inv.dateTime) return false;
                 const invoiceDate = new Date(inv.dateTime);
                 return getMonth(invoiceDate) + 1 === criteria.month && getYear(invoiceDate) === criteria.year;
             });
         } else if (criteria.month || criteria.year) {
            // If only month or only year is provided, don't match based on date
             invoiceDateMatch = false;
         } else {
            // No date criteria provided
             invoiceDateMatch = true; // Don't filter based on date if no date criteria
         }


        // If phone is provided, it MUST match.
        if (criteria.phone) {
             if (!phoneMatch) return false;
              // If phone matches AND date criteria exists, date MUST ALSO match an invoice
             if (criteria.date || (criteria.month && criteria.year)) {
                 return invoiceDateMatch;
             }
             // If phone matches and no date criteria, it's a match
             return true;
        } else {
            // If no phone provided, date criteria MUST match an invoice
            return invoiceDateMatch && (!!criteria.date || (!!criteria.month && !!criteria.year));
        }


    }).map(customer => {
        // Find the earliest invoice date for the result
        const sortedInvoices = (customer.invoices || [])
            .map(inv => ({ ...inv, dateTime: new Date(inv.dateTime) })) // Ensure Date objects
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Sort ascending

        return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            firstInvoiceDate: sortedInvoices.length > 0 ? sortedInvoices[0].dateTime : null,
        };
    });

    // Remove duplicates if the same customer matches multiple criteria in a complex way (less likely with current logic but good practice)
    const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());

    return uniqueResults;
}


export async function getCustomerDetails(customerId: number): Promise<(CustomerData & { id: number, prescriptions?: PrescriptionData[], invoices?: InvoiceData[], transactions?: TransactionData[] }) | null> {
    console.log("Getting customer details (placeholder):", customerId);
    // Replace with actual DB query joining customer, prescription, invoice, product, transaction tables
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate async operation

    // Return from mock data
    const customer = mockCustomers[customerId];

     // Deep copy and ensure dates are Date objects
     if (customer) {
        const deepCopiedCustomer = JSON.parse(JSON.stringify(customer));
        deepCopiedCustomer.prescriptions = deepCopiedCustomer.prescriptions?.map((p: any) => ({
            ...p,
            prescriptionDate: p.prescriptionDate ? new Date(p.prescriptionDate) : undefined,
        }));
        deepCopiedCustomer.invoices = deepCopiedCustomer.invoices?.map((inv: any) => ({
            ...inv,
            dateTime: new Date(inv.dateTime),
            // Ensure products array exists within each invoice
             products: inv.products || [],
        }));
        deepCopiedCustomer.transactions = deepCopiedCustomer.transactions?.map((t: any) => ({
            ...t,
            date: new Date(t.date),
        }));
        return deepCopiedCustomer;
    }

    return null;
}


export async function updateCustomer(customerId: number, data: Partial<CustomerData>): Promise<void> {
  console.log(`Updating customer ${customerId} (placeholder):`, data);
  // Replace with actual DB update query
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
   // Update mock data
    if (mockCustomers[customerId]) {
        mockCustomers[customerId] = { ...mockCustomers[customerId], ...data };
    }
}

export async function deleteCustomer(customerId: number): Promise<void> {
  console.log(`Deleting customer ${customerId} (placeholder)`);
  // Replace with actual DB delete query (consider cascading deletes or soft deletes)
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async operation
  // Delete from mock data
  delete mockCustomers[customerId];
}

export async function getNextBillNumber(): Promise<string> {
    console.log("Fetching next bill number (placeholder)");
    // Replace with logic to get the last bill number and increment it (e.g., SELECT MAX(bill_number)...)
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate async operation
    // Mock logic based on existing mock invoices
    let maxNum = 0;
    Object.values(mockCustomers).forEach(c => {
        c.invoices?.forEach(inv => {
             const match = inv.billNumber.match(/^INV-(\d+)$/);
             if (match) {
                 maxNum = Math.max(maxNum, parseInt(match[1], 10));
             }
        });
    });
    return `INV-${(maxNum + 1).toString().padStart(3, '0')}`;
}

// Add other necessary database functions (e.g., updatePrescription, deleteInvoice, etc.)


// --- Mock Data Store ---
interface MockCustomer extends CustomerData {
    id: number;
    prescriptions?: PrescriptionData[];
    invoices?: InvoiceData[];
    transactions?: TransactionData[];
}

// Helper to create date objects for mock data
const createDate = (year: number, month: number, day: number, hour = 0, minute = 0) => {
    return new Date(year, month - 1, day, hour, minute); // Month is 0-indexed
};


const mockCustomers: Record<number, MockCustomer> = {
     1: {
        id: 1,
        name: 'John Doe',
        phone: '1234567890',
        prescriptions: [
             { customerId: 1, prescriptionDate: createDate(2024, 5, 10), sph_re: -1.50, cyl_re: -0.50, axis_re: 180, add_re: null, pd_re: 31, sph_le: -1.75, cyl_le: -0.75, axis_le: 175, add_le: null, pd_le: 31.5 },
             { customerId: 1, prescriptionDate: createDate(2023, 11, 20), sph_re: -1.25, cyl_re: -0.50, axis_re: 180, add_re: null, pd_re: 31, sph_le: -1.50, cyl_le: -0.75, axis_le: 170, add_le: null, pd_le: 31.5 }
        ],
        invoices: [
             {
                invoiceId: 101,
                customerId: 1,
                billNumber: 'INV-001',
                dateTime: createDate(2024, 5, 15, 10, 30), // Use helper
                discount: 10,
                netPrice: 190,
                advanceAmount: 100,
                balanceAmount: 90,
                products: [
                    { invoiceId: 101, name: 'Frame ABC', price: 100, quantity: 1, total: 100 },
                    { invoiceId: 101, name: 'Progressive Lens XYZ', price: 100, quantity: 1, total: 100 }
                ]
            },
             {
                invoiceId: 105, // Another invoice for the same customer
                customerId: 1,
                billNumber: 'INV-005',
                dateTime: createDate(2024, 6, 1, 14, 0), // Use helper
                discount: 5,
                netPrice: 45,
                advanceAmount: 45,
                balanceAmount: 0,
                products: [ // This invoice has products
                    { invoiceId: 105, name: 'Contact Lens Solution', price: 15, quantity: 1, total: 15 },
                    { invoiceId: 105, name: 'Cleaning Cloth', price: 5, quantity: 6, total: 30 }
                ]
            },
            {
                invoiceId: 106, // Another invoice WITHOUT products
                customerId: 1,
                billNumber: 'INV-006',
                dateTime: createDate(2024, 6, 5, 11, 15), // Use helper
                discount: 0,
                netPrice: 25,
                advanceAmount: 0,
                balanceAmount: 25,
                products: [] // Explicitly empty products array
            }
        ],
        transactions: [
            { customerId: 1, date: createDate(2024, 6, 1), description: 'Payment for INV-005', amount: 45, type: 'credit'},
            { customerId: 1, date: createDate(2024, 5, 15), description: 'Advance Payment for INV-001', amount: 100, type: 'credit'},
            { customerId: 1, date: createDate(2024, 1, 10), description: 'Old Balance Adjustment', amount: 50, type: 'debit'}, // Added a debit
        ]
    },
     2: {
        id: 2,
        name: 'Jane Smith',
        phone: '9876543210',
        prescriptions: [],
        invoices: [
             {
                invoiceId: 102,
                customerId: 2,
                billNumber: 'INV-002',
                dateTime: createDate(2024, 5, 20, 15, 0), // Use helper
                discount: 0,
                netPrice: 150,
                advanceAmount: 150,
                balanceAmount: 0,
                products: [
                    { invoiceId: 102, name: 'Basic Frame', price: 50, quantity: 1, total: 50 },
                    { invoiceId: 102, name: 'Single Vision Lens', price: 100, quantity: 1, total: 100 }
                ]
            }
        ],
        transactions: [
             { customerId: 2, date: createDate(2024, 5, 20), description: 'Full Payment for INV-002', amount: 150, type: 'credit'}
        ]
    },
    3: {
        id: 3,
        name: 'Peter Jones',
        phone: '5551234567',
        prescriptions: [],
        invoices: [
            {
                invoiceId: 103,
                customerId: 3,
                billNumber: 'INV-003',
                dateTime: createDate(2024, 6, 10, 9, 45), // June
                discount: 20,
                netPrice: 180,
                advanceAmount: 50,
                balanceAmount: 130,
                products: [
                    { invoiceId: 103, name: 'Designer Frame', price: 200, quantity: 1, total: 200 }
                ]
            }
        ],
        transactions: [
            { customerId: 3, date: createDate(2024, 6, 10), description: 'Advance for INV-003', amount: 50, type: 'credit'}
        ]
    },
     4: {
        id: 4,
        name: 'Alice Brown',
        phone: '1234500000', // Share part of John Doe's number
        prescriptions: [],
        invoices: [
            {
                invoiceId: 104,
                customerId: 4,
                billNumber: 'INV-004',
                dateTime: createDate(2023, 12, 25, 12, 0), // December 2023
                discount: 0,
                netPrice: 75,
                advanceAmount: 75,
                balanceAmount: 0,
                products: [
                    { invoiceId: 104, name: 'Reading Glasses', price: 75, quantity: 1, total: 75 }
                ]
            }
        ],
        transactions: [
             { customerId: 4, date: createDate(2023, 12, 25), description: 'Payment for reading glasses', amount: 75, type: 'credit'}
        ]
    }
     // Add more mock customers as needed
};

