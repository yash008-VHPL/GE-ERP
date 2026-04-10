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

export interface PurchaseOrderLine {
  pol_id:       number;
  puo_id:       number;
  line_seq:     number;
  item_id:      number | null;
  item_code:    string | null;
  item_name:    string | null;
  uom:          string | null;
  description:  string | null;
  quantity:     string;
  unit_price:   string;
  line_amount:  string;
  qty_received: string;
  qty_billed:   string;
}

export interface PurchaseOrder {
  puo_id:           number;
  doc_id:           string;
  doc_number:       number;
  doc_year:         number;
  vendor_id:        number;
  vendor_name:      string;
  vendor_code:      string;
  vendor_contact?:  string | null;
  vendor_email?:    string | null;
  vendor_phone?:    string | null;
  vendor_address?:  string | null;
  order_date:       string;
  expected_date:    string | null;
  workflow:         'CREDIT' | 'PREPAY';
  status:           string;
  currency:         string;
  notes:            string | null;
  shipping_method:  string | null;
  incoterms:        string | null;
  incoterms_port:   string | null;
  payment_terms:    string | null;
  created_at:       string;
  lines?:           PurchaseOrderLine[];
}

export type VBlBillType = 'GOODS' | 'DIRECT_SERVICE' | 'INDIRECT_SERVICE';

export interface VendorBillLine {
  vbll_id:         number;
  vbl_id:          number;
  line_seq:        number;
  item_id:         number | null;
  item_code:       string | null;
  item_name:       string | null;
  description:     string | null;
  quantity:        string;
  unit_price:      string;
  tax_rate:        string;
  tax_amount:      string;
  line_amount:     string;
  gl_account_code: string | null;
  gl_account_name: string | null;
}

export interface VendorBillPayment {
  vbp_id:         number;
  vbl_id:         number;
  payment_date:   string;
  payment_method: string | null;
  payment_ref:    string | null;
  amount:         string;
  currency:       string;
}

export interface VendorBill {
  vbl_id:         number;
  doc_id:         string;
  doc_number:     number;
  doc_year:       number;
  puo_id:         number | null;
  puo_doc_id:     string | null;
  linked_sao_id:  number | null;
  so_doc_id:      string | null;
  vendor_id:      number;
  vendor_name:    string;
  vendor_code:    string;
  vendor_inv_ref: string | null;
  bill_date:      string;
  due_date:       string | null;
  workflow:       'CREDIT' | 'PREPAY' | 'EXPENSE';
  bill_type:      VBlBillType;
  status:         string;
  subtotal:       string;
  tax_amount:     string;
  total_amount:   string;
  amount_paid:    string;
  currency:       string;
  notes:          string | null;
  lines?:         VendorBillLine[];
  payments?:      VendorBillPayment[];
}

export interface Account {
  account_id:     number;
  account_code:   string;
  account_name:   string;
  account_type:   string;
  normal_balance: 'DR' | 'CR';
  parent_code:    string | null;
  is_active:      boolean;
}
