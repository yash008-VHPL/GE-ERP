// =============================================================================
// GE ERP — Purchase API
// src/templates/PODocument.tsx
// Purchase Order PDF — styled to match the GIIAVA Word template
// =============================================================================

import React from 'react';
import fs from 'fs';
import path from 'path';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { PurchaseOrder } from '../types';

// ── Brand colours (GIIAVA dark green palette) ────────────────────────────────
const C = {
  green:      '#1B4332',   // GIIAVA primary — matches logo
  greenLight: '#2D6A4F',   // slightly lighter for alternating rows
  greenBg:    '#EAF2ED',   // very light green tint for alt rows
  black:      '#1A1A1A',
  white:      '#FFFFFF',
  lightGrey:  '#F7F7F7',
  midGrey:    '#888888',
  border:     '#AAAAAA',
  borderDark: '#1B4332',
};

// ── Company constants ─────────────────────────────────────────────────────────
const COMPANY = {
  name:    'GIIAVA EUROPE B.V.',
  addr1:   'Herengracht 124',
  addr2:   'Amsterdam 1015BT',
  country: 'The Netherlands',
  vat:     'NL857165975B01',
  kvk:     '67765424',   // ← fill in your KVK number
};

// ── T&C terms (verbatim from the GIIAVA PO template) ─────────────────────────
const TERMS: string[] = [
  'Our PO will need to be provided for verification on delivery. Delivery without PO will not be accepted.',
  'Goods shall need to pass by GEBV Staff. Any faulty/damaged goods shall be replaced or returned with a full refund.',
  'Payment shall be processed on receipt of commercial invoice based on agreed payment terms.',
  'Once goods are accepted, ownership of the goods is deemed as transferred to GIIAVA Europe BV.',
  'Any claims made by any 3rd party appointed by the seller shall be the liability of the seller.',
  'We reserve the right to change / amend / cancel this PO if the seller cannot fulfill any or all the quality / quantity / delivery obligations.',
  'Transit insurance shall be the responsibility of the seller.',
  'Any other term mutually agreed between GIIAVA, and the seller shall apply.',
  'The Material to be supplied as per specification sheet.',
  'Certificate of analysis for supply to be given with respective tank.',
  'Material from two separate batches in one Tank will not be acceptable.',
  'We need and accept only non-GMO, Soya free, Mustard free, Sesame free and peanut contamination free, Sunflower Lecithin Liquid.',
  'A complete third-party analysis report (chemical, microbiological, heavy metal, non-GMO status and no soy contamination) from a reputed and accredited international laboratory such as TUV, SGS, Eurofins, or equivalent is required before dispatch. This report must show product conforms to the quality parameters listed.',
  'After Approval of lot from GIIAVA the material will be moved further.',
  'All testing shall be conducted in accordance with applicable regulatory and international standards.',
  'The material shall be transported in an ISO tank or SS tank truck. The tank\'s previous cargo must be non-hazardous and comply with Halal and Kosher Requirements, subject to the Buyer\'s prior approval before loading.',
  'The production facility must be Halal, Kosher and FSSC 22000 certified.',
  'Material should be invoiced as follows: Buyer: GIIAVA Europe B.V. Herengracht 124, Amsterdam 1015BT, The Netherlands. Notify Party: ILC International Freight Forwarder & Trader BV, KIOTOWEG 70C Units, 3047 BG Rotterdam, The Netherlands, Tel: +31 (0)10 2450016.',
];

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.black,
    paddingTop: 28,
    paddingBottom: 50,
    paddingLeft: 32,
    paddingRight: 32,
  },

  // Logo
  logoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  logo:      { width: 130, height: 33 },
  poLabel:   { fontSize: 20, fontFamily: 'Helvetica-Bold', color: C.green, letterSpacing: 1 },

  // PO number header bar
  poNumBar:  { flexDirection: 'row', borderWidth: 1, borderColor: C.borderDark, marginBottom: 0 },
  poNumLeft: { width: '50%', padding: '5 7', borderRightWidth: 1, borderRightColor: C.borderDark },
  poNumRight:{ width: '50%', padding: '5 7' },
  poNumKey:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.black },
  poNumVal:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.green },

  // Buyer / Vendor block
  bvRow:        { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.borderDark },
  bvCell:       { width: '50%', padding: '6 7' },
  bvCellRight:  { width: '50%', padding: '6 7', borderLeftWidth: 1, borderLeftColor: C.borderDark },
  bvLabel:      { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 3 },
  bvText:       { fontSize: 9, color: C.black, lineHeight: 1.5 },
  bvBold:       { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.black, lineHeight: 1.5 },
  bvMeta:       { fontSize: 8, color: C.midGrey, lineHeight: 1.5 },

  // Vendor detail rows (Contact / Address / Phone / Email)
  vendorRow:    { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.borderDark },
  vendorKey:    { width: '25%', padding: '4 7', fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.black, borderRightWidth: 1, borderRightColor: C.borderDark },
  vendorVal:    { width: '75%', padding: '4 7', fontSize: 8, color: C.black },

  // Reference / terms row (4-column)
  refRow:       { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: C.borderDark },
  refCell:      { flex: 1, padding: '4 7', borderRightWidth: 1, borderRightColor: C.borderDark },
  refCellLast:  { flex: 1, padding: '4 7' },
  refKey:       { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 2 },
  refVal:       { fontSize: 8, color: C.black },

  // Items table
  tblHeader:    { flexDirection: 'row', backgroundColor: C.green, borderWidth: 1, borderColor: C.borderDark, marginTop: 0 },
  tblHeaderCell:{ color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 8, padding: '4 5' },
  tblRow:       { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: C.borderDark },
  tblRowAlt:    { flexDirection: 'row', backgroundColor: C.greenBg, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: C.borderDark },
  tblCell:      { fontSize: 8.5, color: C.black, padding: '3 5' },

  // Column widths
  colProduct:  { flex: 3 },
  colShipDate: { width: 70, textAlign: 'center' },
  colQty:      { width: 55, textAlign: 'right' },
  colPrice:    { width: 75, textAlign: 'right' },
  colTotal:    { width: 80, textAlign: 'right' },

  // VAT / totals rows
  subTotalRow:  { flexDirection: 'row', borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0.5, borderColor: C.borderDark },
  totRow:       { flexDirection: 'row', borderWidth: 1, borderColor: C.borderDark },
  totLabelCell: { flex: 3, padding: '4 5' },
  totQtyCell:   { width: 55 },
  totPctCell:   { width: 75, padding: '4 5', textAlign: 'right', borderLeftWidth: 0.5, borderLeftColor: C.borderDark },
  totAmtCell:   { width: 80, padding: '4 5', textAlign: 'right', borderLeftWidth: 0.5, borderLeftColor: C.borderDark },
  totLabel:     { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.black },
  totVal:       { fontSize: 8.5, color: C.black },
  grandLabel:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.green },
  grandVal:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.green },

  // Signature
  sigBlock:     { marginTop: 14 },
  sigLine1:     { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.black, marginBottom: 18 },
  sigUnderline: { borderBottomWidth: 0.5, borderBottomColor: C.black, marginBottom: 4, width: 180 },
  sigCaption:   { fontSize: 8, color: C.midGrey },

  // Terms box
  termsBox:     { marginTop: 14, borderWidth: 1, borderColor: C.borderDark, padding: '7 9' },
  termsTitle:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.green, marginBottom: 6 },
  termItem:     { flexDirection: 'row', marginBottom: 3 },
  termNum:      { fontSize: 7, color: C.black, width: 18, flexShrink: 0 },
  termText:     { fontSize: 7, color: C.black, flex: 1, lineHeight: 1.5 },

  // Footer
  footer:       { position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 4 },
  footerText:   { fontSize: 7, color: C.midGrey },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Load logo once at module level (server-side)
const LOGO_PATH = path.join(__dirname, '../assets/giiava-logo.png');
const logoData  = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  po: PurchaseOrder;
}

export function PODocument({ po }: Props) {
  const lines    = po.lines ?? [];
  const subtotal = lines.reduce((sum, l) => sum + Number(l.line_amount), 0);
  const vatRate  = 0.20;
  const vatAmt   = subtotal * vatRate;
  const total    = subtotal + vatAmt;

  return (
    <Document title={po.doc_id} author={COMPANY.name}>
      <Page size="A4" style={s.page}>

        {/* ── Logo + "PURCHASE ORDER" title ── */}
        <View style={s.logoRow}>
          {logoData
            ? <Image src={{ data: logoData, format: 'png' }} style={s.logo} />
            : <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.green }}>{COMPANY.name}</Text>
          }
          <Text style={s.poLabel}>PURCHASE ORDER</Text>
        </View>

        {/* ── PO Number bar ── */}
        <View style={s.poNumBar}>
          <View style={s.poNumLeft}>
            <Text style={s.poNumKey}>Purchase Order Number:</Text>
          </View>
          <View style={s.poNumRight}>
            <Text style={s.poNumVal}>{po.doc_id}</Text>
          </View>
        </View>

        {/* ── Buyer / Vendor header row ── */}
        <View style={s.bvRow}>
          <View style={s.bvCell}>
            <Text style={s.bvLabel}>Buyer:</Text>
            <Text style={s.bvBold}>{COMPANY.name}</Text>
            <Text style={s.bvText}>{COMPANY.addr1}</Text>
            <Text style={s.bvText}>{COMPANY.addr2}</Text>
            <Text style={s.bvText}>{COMPANY.country}</Text>
            <Text style={s.bvText}>VAT No.: {COMPANY.vat}</Text>
            <Text style={s.bvText}>KVK No.: {COMPANY.kvk}</Text>
          </View>
          <View style={s.bvCellRight}>
            <Text style={s.bvLabel}>Vendor:</Text>
            <Text style={s.bvBold}>{po.vendor_name ?? ''}</Text>
          </View>
        </View>

        {/* ── Vendor detail rows ── */}
        {[
          { key: 'Contact Name:', val: po.vendor_contact ?? '' },
          { key: 'Address:',      val: po.vendor_address ?? '' },
          { key: 'Contact No:',   val: po.vendor_phone   ?? '' },
          { key: 'Email ID:',     val: po.vendor_email   ?? '' },
        ].map(row => (
          <View key={row.key} style={s.vendorRow}>
            <View style={{ width: '50%', borderRightWidth: 1, borderRightColor: C.borderDark }}>
              {/* left column intentionally blank — buyer address already shown above */}
              <Text style={{ padding: '3 7', fontSize: 8 }}> </Text>
            </View>
            <View style={{ width: '25%', borderRightWidth: 0.5, borderRightColor: C.borderDark, padding: '3 7' }}>
              <Text style={s.vendorKey}>{row.key}</Text>
            </View>
            <View style={{ width: '25%', padding: '3 7' }}>
              <Text style={s.vendorVal}>{row.val}</Text>
            </View>
          </View>
        ))}

        {/* ── Reference / Shipment / Shipping Terms / Payment Terms ── */}
        <View style={s.refRow}>
          {[
            { key: 'REFERENCE',       val: po.doc_id },
            { key: 'SHIPMENT METHOD', val: po.shipping_method ?? '' },
            { key: 'INCOTERMS',       val: po.incoterms
                ? (po.incoterms_port ? `${po.incoterms} — ${po.incoterms_port}` : po.incoterms)
                : '' },
            { key: 'PAYMENT TERMS',   val: po.payment_terms ?? '' },
          ].map((c, i, arr) => (
            <View key={c.key} style={i < arr.length - 1 ? s.refCell : s.refCellLast}>
              <Text style={s.refKey}>{c.key}</Text>
              <Text style={s.refVal}>{c.val}</Text>
            </View>
          ))}
        </View>

        {/* ── Line items table ── */}
        <View style={s.tblHeader}>
          <Text style={[s.tblHeaderCell, s.colProduct]}>Product</Text>
          <Text style={[s.tblHeaderCell, s.colShipDate]}>Ship Date{'\n'}(YY-MM-DD)</Text>
          <Text style={[s.tblHeaderCell, s.colQty]}>Quantity</Text>
          <Text style={[s.tblHeaderCell, s.colPrice]}>Unit Price</Text>
          <Text style={[s.tblHeaderCell, s.colTotal]}>Total Amount</Text>
        </View>

        {lines.map((l, i) => (
          <View key={l.pol_id} style={i % 2 === 0 ? s.tblRow : s.tblRowAlt}>
            <Text style={[s.tblCell, s.colProduct]}>
              {l.line_seq}.{'  '}{l.description ?? l.item_name ?? ''}
            </Text>
            <Text style={[s.tblCell, s.colShipDate]}>{l.expected_date ?? ''}</Text>
            <Text style={[s.tblCell, s.colQty]}>{fmt(l.quantity)}</Text>
            <Text style={[s.tblCell, s.colPrice]}>{po.currency} {fmt(l.unit_price)}</Text>
            <Text style={[s.tblCell, s.colTotal]}>{po.currency} {fmt(l.line_amount)}</Text>
          </View>
        ))}

        {/* ── VAT row ── */}
        <View style={s.subTotalRow}>
          <View style={s.totLabelCell}>
            <Text style={s.totLabel}>VAT</Text>
          </View>
          <View style={{ width: 70 }} />
          <View style={s.totPctCell}>
            <Text style={s.totVal}>20%</Text>
          </View>
          <View style={s.totAmtCell}>
            <Text style={s.totVal}>{po.currency} {fmt(vatAmt)}</Text>
          </View>
        </View>

        {/* ── Grand total row ── */}
        <View style={s.totRow}>
          <View style={s.totLabelCell}>
            <Text style={s.grandLabel}> </Text>
          </View>
          <View style={{ width: 70 }} />
          <View style={s.totPctCell}>
            <Text style={s.grandLabel}>TOTAL</Text>
          </View>
          <View style={s.totAmtCell}>
            <Text style={s.grandVal}>{po.currency} {fmt(total)}</Text>
          </View>
        </View>

        {/* ── Signature ── */}
        <View style={s.sigBlock}>
          <Text style={s.sigLine1}>On behalf of GIIAVA Europe BV:</Text>
          <View style={s.sigUnderline} />
          <Text style={s.sigCaption}>Signed by: _______________________________</Text>
        </View>

        {/* ── Other Terms ── */}
        <View style={s.termsBox}>
          <Text style={s.termsTitle}>Other Terms:</Text>
          {TERMS.map((t, i) => (
            <View key={i} style={s.termItem}>
              <Text style={s.termNum}>{i + 1}.</Text>
              <Text style={s.termText}>{t}</Text>
            </View>
          ))}
        </View>

        {/* ── Page footer ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{COMPANY.name}  —  VAT {COMPANY.vat}  —  {po.doc_id}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} of ${totalPages}`
          } />
        </View>

      </Page>
    </Document>
  );
}
