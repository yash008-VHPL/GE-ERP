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
  item_id:   number;
  item_code: string;
  item_name: string;
  uom:       string;
  item_type: 'PRODUCT' | 'SERVICE';
  is_active: boolean;
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

export interface VendorBill {
  vbl_id:         number;
  doc_id:         string;
  doc_number:     number;
  doc_year:       number;
  puo_id:         number | null;
  vendor_id:      number;
  vendor_name?:   string;
  vendor_inv_ref: string | null;
  bill_date:      string;
  due_date:       string | null;
  workflow:       VBlWorkflow;
  status:         VBlStatus;
  subtotal:       string;
  tax_amount:     string;
  total_amount:   string;
  amount_paid:    string;
  currency:       string;
  notes:          string | null;
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
