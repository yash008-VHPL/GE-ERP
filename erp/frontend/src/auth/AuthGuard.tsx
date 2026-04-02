import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Button, Result, Spin } from 'antd';
import { loginRequest } from '../config/msalConfig';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated            = useIsAuthenticated();
  const { instance, inProgress }   = useMsal();

  if (inProgress !== 'none') return <Spin fullscreen tip="Signing in…" />;

  if (!isAuthenticated) {
    return (
      <Result
        icon={<img src="/giiava-logo.png" alt="GIIAVA" style={{ height: 64 }} onError={e => (e.currentTarget.style.display='none')} />}
        title="GE ERP"
        subTitle="Sign in with your GIIAVA Microsoft 365 account to continue."
        extra={
          <Button
            type="primary"
            size="large"
            onClick={() => instance.loginRedirect(loginRequest)}
          >
            Sign in with Microsoft 365
          </Button>
        }
        style={{ marginTop: 120 }}
      />
    );
  }

  return <>{children}</>;
}
