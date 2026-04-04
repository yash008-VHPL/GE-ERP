import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { ConfigProvider } from 'antd';
import { msalInstance } from './config/msalInstance';
import { geTheme } from './config/theme';
import { AuthGuard } from './auth/AuthGuard';
import { AppShell } from './layout/AppShell';
import { VendorList }        from './pages/purchase/VendorList';
import { ItemList }          from './pages/items/ItemList';
import { POList }            from './pages/purchase/POList';
import { POCreate }          from './pages/purchase/POCreate';
import { PODetail }          from './pages/purchase/PODetail';
import { ReceiptList }       from './pages/purchase/ReceiptList';
import { ReceiptCreate }     from './pages/purchase/ReceiptCreate';
import { BillList }          from './pages/purchase/BillList';
import { PaymentList }       from './pages/purchase/PaymentList';
import { ClientList }        from './pages/sales/ClientList';
import { SOList }            from './pages/sales/SOList';
import { SOCreate }          from './pages/sales/SOCreate';
import { FulfillmentList }   from './pages/sales/FulfillmentList';
import { InvoiceList }       from './pages/sales/InvoiceList';
import { ClientPaymentList } from './pages/sales/ClientPaymentList';

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <ConfigProvider theme={geTheme}>
        <AuthGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/purchase/orders" replace />} />
                {/* Purchases */}
                <Route path="items"                  element={<ItemList />} />
                <Route path="purchase/vendors"       element={<VendorList />} />
                <Route path="purchase/orders"        element={<POList />} />
                <Route path="purchase/orders/new"    element={<POCreate />} />
                <Route path="purchase/orders/:docId" element={<PODetail />} />
                <Route path="purchase/receipts"      element={<ReceiptList />} />
                <Route path="purchase/receipts/new"  element={<ReceiptCreate />} />
                <Route path="purchase/bills"         element={<BillList />} />
                <Route path="purchase/payments"      element={<PaymentList />} />
                {/* Sales */}
                <Route path="sales/clients"          element={<ClientList />} />
                <Route path="sales/orders"           element={<SOList />} />
                <Route path="sales/orders/new"       element={<SOCreate />} />
                <Route path="sales/fulfillments"     element={<FulfillmentList />} />
                <Route path="sales/invoices"         element={<InvoiceList />} />
                <Route path="sales/payments"         element={<ClientPaymentList />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGuard>
      </ConfigProvider>
    </MsalProvider>
  );
}
