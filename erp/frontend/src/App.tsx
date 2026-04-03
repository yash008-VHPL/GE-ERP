import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { ConfigProvider } from 'antd';
import { msalInstance } from './config/msalInstance';
import { geTheme } from './config/theme';
import { AuthGuard } from './auth/AuthGuard';
import { AppShell } from './layout/AppShell';
import { POList }       from './pages/purchase/POList';
import { POCreate }     from './pages/purchase/POCreate';
import { PODetail }     from './pages/purchase/PODetail';
import { ReceiptList }  from './pages/purchase/ReceiptList';
import { ReceiptCreate } from './pages/purchase/ReceiptCreate';
import { BillList }     from './pages/purchase/BillList';
import { PaymentList }  from './pages/purchase/PaymentList';

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <ConfigProvider theme={geTheme}>
        <AuthGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/purchase/orders" replace />} />
                <Route path="purchase/orders"            element={<POList />} />
                <Route path="purchase/orders/new"        element={<POCreate />} />
                <Route path="purchase/orders/:docId"     element={<PODetail />} />
                <Route path="purchase/receipts"          element={<ReceiptList />} />
                <Route path="purchase/receipts/new"      element={<ReceiptCreate />} />
                <Route path="purchase/bills"             element={<BillList />} />
                <Route path="purchase/payments"          element={<PaymentList />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGuard>
      </ConfigProvider>
    </MsalProvider>
  );
}
