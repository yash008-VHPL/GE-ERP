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
  puo_id:        number;
  doc_id:        string;
  doc_number:    number;
  doc_year:      number;
  vendor_id:     number;
  vendor_name:   string;
  vendor_code:   string;
  order_date:    string;
  expected_date: string | null;
  workflow:      'CREDIT' | 'PREPAY';
  status:        string;
  currency:      string;
  notes:         string | null;
  created_at:    string;
  lines?:        PurchaseOrderLine[];
}

export interface VendorBill {
  vbl_id:         number;
  doc_id:         string;
  puo_id:         number | null;
  vendor_id:      number;
  vendor_name:    string;
  vendor_inv_ref: string | null;
  bill_date:      string;
  due_date:       string | null;
  workflow:       'CREDIT' | 'PREPAY' | 'EXPENSE';
  status:         string;
  total_amount:   string;
  amount_paid:    string;
  currency:       string;
}
