// ── Master data ───────────────────────────────────────────────────────────────
export interface Vendor {
  vendor_id:    number;
  vendor_code:  string;
  vendor_name:  string;
  credit_terms: boolean;
  credit_days:  number;
  currency:     string;
  contact_name: string | null;
  email:        string | null;
  phone:        string | null;
  address:      string | null;
  is_active:    boolean;
}

export interface Item {
  item_id:         number;
  item_code:       string;
  item_name:       string;
  uom:             string;
  item_type:       'PRODUCT' | 'SERVICE';
  gl_account_code: string | null;
  is_active:       boolean;
}

// ── Chart of Accounts / Financials ────────────────────────────────────────────
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DR' | 'CR';

export interface Account {
  account_id:     number;
  account_code:   string;
  account_name:   string;
  account_type:   AccountType;
  normal_balance: NormalBalance;
  parent_code:    string | null;
  gnucash_type:   string | null;
  is_active:      boolean;
}

export type JEStatus = 'DRAFT' | 'POSTED';
export type JESourceType = 'MANUAL' | 'VBL' | 'VPY' | 'SIV' | 'CPY' | 'ITR';

export interface JournalEntryLine {
  jel_id:       number;
  je_id:        number;
  account_id:   number;
  account_code?: string;
  account_name?: string;
  account_type?: AccountType;
  line_seq:     number;
  description:  string | null;
  debit:        string;
  credit:       string;
}

export interface JournalEntry {
  je_id:       number;
  doc_id:      string;
  doc_number:  number;
  doc_year:    number;
  entry_date:  string;
  description: string;
  reference:   string | null;
  source_type: JESourceType;
  source_id:   number | null;
  status:      JEStatus;
  created_at:  string;
  lines?:      JournalEntryLine[];
}

// ── Purchase Orders ───────────────────────────────────────────────────────────
export type PuOWorkflow = 'CREDIT' | 'PREPAY';
export type PuOStatus   = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'BILLED' | 'CLOSED' | 'CANCELLED';

export interface PurchaseOrderLine {
  pol_id:        number;
  puo_id:        number;
  line_seq:      number;
  item_id:       number | null;
  item_code?:    string;
  item_name?:    string;
  uom?:          string;
  description:   string | null;
  quantity:      string;
  unit_price:    string;
  line_amount:   string;
  qty_received:  string;
  qty_billed:    string;
  expected_date: string | null;
}

export interface PurchaseOrder {
  puo_id:           number;
  doc_id:           string;
  doc_number:       number;
  doc_year:         number;
  vendor_id:        number;
  vendor_name?:     string;
  vendor_code?:     string;
  vendor_contact?:  string | null;
  vendor_email?:    string | null;
  vendor_phone?:    string | null;
  vendor_address?:  string | null;
  order_date:       string;
  expected_date:    string | null;
  workflow:         PuOWorkflow;
  status:           PuOStatus;
  currency:         string;
  notes:            string | null;
  shipping_method:  string | null;
  incoterms:        string | null;
  incoterms_port:   string | null;
  payment_terms:    string | null;
  created_at:       string;
  lines?:           PurchaseOrderLine[];
}

// ── Vendor Bills ──────────────────────────────────────────────────────────────
export type VBlWorkflow = 'CREDIT' | 'PREPAY' | 'EXPENSE';
export type VBlStatus   = 'DRAFT' | 'POSTED' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type VBlBillType = 'GOODS' | 'DIRECT_SERVICE' | 'INDIRECT_SERVICE';

export interface VendorBillLine {
  vbll_id:         number;
  vbl_id:          number;
  line_seq:        number;
  item_id:         number | null;
  item_code?:      string;
  item_name?:      string;
  description:     string | null;
  quantity:        string;
  unit_price:      string;
  tax_rate:        string;
  tax_amount:      string;
  line_amount:     string;
  gl_account_code: string | null;
  gl_account_name?: string | null;
}

export interface VendorBill {
  vbl_id:         number;
  doc_id:         string;
  doc_number:     number;
  doc_year:       number;
  puo_id:         number | null;
  puo_doc_id?:    string | null;
  linked_so_id:   number | null;
  so_doc_id?:     string | null;
  vendor_id:      number;
  vendor_name?:   string;
  vendor_code?:   string;
  vendor_inv_ref: string | null;
  bill_date:      string;
  due_date:       string | null;
  workflow:       VBlWorkflow;
  bill_type:      VBlBillType;
  status:         VBlStatus;
  subtotal:       string;
  tax_amount:     string;
  total_amount:   string;
  amount_paid:    string;
  currency:       string;
  notes:          string | null;
  lines?:         VendorBillLine[];
  payments?:      VendorBillPayment[];
}

// ── Payments ──────────────────────────────────────────────────────────────────
export interface VendorBillPayment {
  vbp_id:         number;
  doc_id:         string;
  vbl_id:         number;
  vendor_id:      number;
  payment_date:   string;
  payment_method: string | null;
  payment_ref:    string | null;
  amount:         string;
  currency:       string;
}

export interface VendorPrepayment {
  vpr_id:          number;
  doc_id:          string;
  puo_id:          number;
  vendor_id:       number;
  payment_date:    string;
  payment_method:  string | null;
  payment_ref:     string | null;
  amount:          string;
  amount_applied:  string;
  currency:        string;
  status:          'PAID' | 'PARTIALLY_APPLIED' | 'FULLY_APPLIED';
}

// ── Inventory Lots ────────────────────────────────────────────────────────────
export type LotStatus = 'AVAILABLE' | 'PARTIALLY_USED' | 'FULLY_USED';

export interface InventoryLot {
  lot_id:             number;
  lot_number:         string;
  docket_number:      string;
  itr_id:             number;
  irl_id:             number;
  item_id:            number;
  item_code?:         string;
  item_name?:         string;
  vendor_id:          number;
  vendor_name?:       string;
  quantity_received:  string;
  quantity_available: string;
  uom:                string;
  vendor_batch_ref:   string | null;
  sharepoint_folder:  string | null;
  received_date:      string;
  status:             LotStatus;
  notes:              string | null;
  receipt_doc_id?:    string;
  allocations?:       LotAllocation[];
}

export interface LotAllocation {
  allocation_id:         number;
  shipment_lot_id:       number;
  inventory_lot_id:      number;
  quantity_allocated:    string;
  allocated_at:          string;
  shipment_lot_number?:  string;
  shipment_status?:      string;
  so_doc_id?:            string;
  inward_lot_number?:    string;
  vendor_batch_ref?:     string | null;
  vendor_name?:          string;
  received_date?:        string;
}

export interface ShipmentLot {
  shipment_lot_id: number;
  lot_number:      string;
  so_id:           number;
  so_doc_id?:      string;
  fulfillment_id:  number | null;
  item_id:         number;
  item_code?:      string;
  item_name?:      string;
  quantity:        string;
  uom:             string;
  status:          string;
  notes:           string | null;
  client_name?:    string;
  allocations?:    LotAllocation[];
}
