import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { ConfigProvider } from 'antd';
import { msalInstance } from './config/msalInstance';
import { geTheme } from './config/theme';
import { AuthGuard } from './auth/AuthGuard';
import { AppShell } from './layout/AppShell';

// Dashboard
import { Dashboard }            from './pages/Dashboard';

// Master data
import { VendorList }           from './pages/purchase/VendorList';
import { ItemList }             from './pages/items/ItemList';

// Purchase
import { POList }               from './pages/purchase/POList';
import { POCreate }             from './pages/purchase/POCreate';
import { PODetail }             from './pages/purchase/PODetail';
import { ReceiptList }          from './pages/purchase/ReceiptList';
import { ReceiptCreate }        from './pages/purchase/ReceiptCreate';
import { ReceiptDetail }        from './pages/purchase/ReceiptDetail';
import { VendorBillList }       from './pages/purchase/VendorBillList';
import { VendorBillCreate }     from './pages/purchase/VendorBillCreate';
import { VendorBillDetail }     from './pages/purchase/VendorBillDetail';
import { PaymentList }          from './pages/purchase/PaymentList';

// Sales
import { ClientList }           from './pages/sales/ClientList';
import { SOList }               from './pages/sales/SOList';
import { SOCreate }             from './pages/sales/SOCreate';
import { FulfillmentList }      from './pages/sales/FulfillmentList';
import { FulfillmentDetail }    from './pages/sales/FulfillmentDetail';
import { InvoiceList }          from './pages/sales/InvoiceList';
import { InvoiceCreate }        from './pages/sales/InvoiceCreate';
import { InvoiceDetail }        from './pages/sales/InvoiceDetail';
import { InvoicePrint }         from './pages/sales/InvoicePrint';
import { ClientPaymentList }    from './pages/sales/ClientPaymentList';

// Inventory
import { InventoryLotList }     from './pages/inventory/InventoryLotList';
import { InventoryLotDetail }   from './pages/inventory/InventoryLotDetail';

// Financials
import { ChartOfAccounts }      from './pages/financials/ChartOfAccounts';
import { JournalEntryList }     from './pages/financials/JournalEntryList';
import { JournalEntryDetail }   from './pages/financials/JournalEntryDetail';
import { GeneralLedger }        from './pages/financials/GeneralLedger';
import { TrialBalance }         from './pages/financials/TrialBalance';
import { BalanceSheet }         from './pages/financials/BalanceSheet';
import { ProfitLoss }           from './pages/financials/ProfitLoss';
import { TransactionRegister }  from './pages/financials/TransactionRegister';

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <ConfigProvider theme={geTheme}>
        <AuthGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Master data */}
                <Route path="items"                  element={<ItemList />} />
                <Route path="purchase/vendors"       element={<VendorList />} />

                {/* Purchases */}
                <Route path="purchase/orders"            element={<POList />} />
                <Route path="purchase/orders/new"        element={<POCreate />} />
                <Route path="purchase/orders/:docId"     element={<PODetail />} />
                <Route path="purchase/receipts"          element={<ReceiptList />} />
                <Route path="purchase/receipts/new"      element={<ReceiptCreate />} />
                <Route path="purchase/receipts/:docId"   element={<ReceiptDetail />} />
                <Route path="purchase/bills"             element={<VendorBillList />} />
                <Route path="purchase/bills/create"      element={<VendorBillCreate />} />
                <Route path="purchase/bills/:docId"      element={<VendorBillDetail />} />
                <Route path="purchase/payments"          element={<PaymentList />} />

                {/* Sales */}
                <Route path="sales/clients"              element={<ClientList />} />
                <Route path="sales/orders"               element={<SOList />} />
                <Route path="sales/orders/new"           element={<SOCreate />} />
                <Route path="sales/fulfillments"         element={<FulfillmentList />} />
                <Route path="sales/fulfillments/:docId"  element={<FulfillmentDetail />} />
                <Route path="sales/invoices/new"              element={<InvoiceCreate />} />
                <Route path="sales/invoices/:docId/print" element={<InvoicePrint />} />
                <Route path="sales/invoices/:docId"       element={<InvoiceDetail />} />
                <Route path="sales/invoices"              element={<InvoiceList />} />
                <Route path="sales/payments"             element={<ClientPaymentList />} />

                {/* Inventory */}
                <Route path="inventory/lots"             element={<InventoryLotList />} />
                <Route path="inventory/lots/:lotNumber"  element={<InventoryLotDetail />} />

                {/* Financials */}
                <Route path="financials/accounts"               element={<ChartOfAccounts />} />
                <Route path="financials/journal-entries"        element={<JournalEntryList />} />
                <Route path="financials/journal-entries/:docId" element={<JournalEntryDetail />} />
                <Route path="financials/general-ledger"         element={<GeneralLedger />} />
                <Route path="financials/trial-balance"          element={<TrialBalance />} />
                <Route path="financials/balance-sheet"          element={<BalanceSheet />} />
                <Route path="financials/profit-loss"            element={<ProfitLoss />} />
                <Route path="financials/transaction-register"  element={<TransactionRegister />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGuard>
      </ConfigProvider>
    </MsalProvider>
  );
}
