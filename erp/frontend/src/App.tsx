import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { ConfigProvider } from 'antd';
import { msalInstance } from './config/msalInstance';
import { geTheme } from './config/theme';
import { AuthGuard } from './auth/AuthGuard';
import { AppShell } from './layout/AppShell';
import { POList }   from './pages/purchase/POList';
import { POCreate } from './pages/purchase/POCreate';
import { PODetail } from './pages/purchase/PODetail';

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <ConfigProvider theme={geTheme}>
        <AuthGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={<Navigate to="/purchase/orders" replace />} />
                <Route path="purchase/orders"         element={<POList />} />
                <Route path="purchase/orders/new"     element={<POCreate />} />
                <Route path="purchase/orders/:docId"  element={<PODetail />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGuard>
      </ConfigProvider>
    </MsalProvider>
  );
}
