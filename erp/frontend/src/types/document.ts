export type DocType = 'PuO' | 'ItR' | 'VBl' | 'VBP' | 'VPr' | 'VPA';

export const SUPPORTING_DOC_LABEL: Record<DocType, string> = {
  PuO: "Vendor's Sales Order",
  ItR: 'Bill of Lading from vendor',
  VBl: 'Actual vendor invoice',
  VBP: 'Bank payment proof',
  VPr: 'Bank payment proof',
  VPA: 'Prepayment application confirmation',
};
