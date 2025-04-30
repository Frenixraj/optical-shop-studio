// This is a placeholder file for database interactions.
// You would replace this with actual MySQL connection and query logic
// using a library like 'mysql2' or an ORM like Prisma or TypeORM.

// Example structure (replace with your actual implementation)

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
        customer.invoices.unshift({ ...data, invoiceId: mockId, products: [] }); // Prepend, initialize products
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
      customer.transactions.unshift(data); // Prepend
  }
}

export async function findCustomersByPhone(phone: string): Promise<(CustomerData & { id: number })[]> {
  console.log("Finding customers by phone (placeholder):", phone);
  // Replace with actual DB query joining customer, prescription, invoice tables based on phone number
  await new Promise(resolve => setTimeout(resolve, 700)); // Simulate async operation
  // Search mock data
  const results = Object.values(mockCustomers)
        .filter(c => c.phone.includes(phone))
        .map(({ prescriptions, invoices, transactions, ...customer }) => customer); // Return only basic info
  return results;
}


export async function getCustomerDetails(customerId: number): Promise<(CustomerData & { id: number, prescriptions?: PrescriptionData[], invoices?: InvoiceData[], transactions?: TransactionData[] }) | null> {
    console.log("Getting customer details (placeholder):", customerId);
    // Replace with actual DB query joining customer, prescription, invoice, product, transaction tables
    await new Promise(resolve => setTimeout(resolve, 600)); // Simulate async operation

    // Return from mock data
    const customer = mockCustomers[customerId];

    // Deep copy to avoid modifying the mock source if dates are processed
    return customer ? JSON.parse(JSON.stringify(customer)) : null;
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

const mockCustomers: Record<number, MockCustomer> = {
     1: {
        id: 1,
        name: 'John Doe',
        phone: '1234567890',
        prescriptions: [
             { customerId: 1, prescriptionDate: new Date('2024-05-10'), sph_re: -1.50, cyl_re: -0.50, axis_re: 180, add_re: null, pd_re: 31, sph_le: -1.75, cyl_le: -0.75, axis_le: 175, add_le: null, pd_le: 31.5 },
             { customerId: 1, prescriptionDate: new Date('2023-11-20'), sph_re: -1.25, cyl_re: -0.50, axis_re: 180, add_re: null, pd_re: 31, sph_le: -1.50, cyl_le: -0.75, axis_le: 170, add_le: null, pd_le: 31.5 }
        ],
        invoices: [
            {
                invoiceId: 101,
                customerId: 1,
                billNumber: 'INV-001',
                dateTime: new Date('2024-05-15T10:30:00'),
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
                dateTime: new Date('2024-06-01T14:00:00'),
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
                dateTime: new Date('2024-06-05T11:15:00'),
                discount: 0,
                netPrice: 25,
                advanceAmount: 0,
                balanceAmount: 25,
                products: [] // Explicitly empty products array
            }
        ],
        transactions: [
            { customerId: 1, date: new Date('2024-06-01'), description: 'Payment for INV-005', amount: 45, type: 'credit'},
            { customerId: 1, date: new Date('2024-05-15'), description: 'Advance Payment for INV-001', amount: 100, type: 'credit'},
            { customerId: 1, date: new Date('2024-01-10'), description: 'Old Balance Adjustment', amount: 50, type: 'debit'}, // Added a debit
        ]
    },
     2: {
        id: 2,
        name: 'Jane Smith',
        phone: '9876543210',
        prescriptions: [],
        invoices: [],
        transactions: []
    },
     // Add more mock customers as needed
};
