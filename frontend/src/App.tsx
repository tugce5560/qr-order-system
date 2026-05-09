import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import HomePage from './apps/HomePage'
import AdminPage from './apps/admin/AdminPage'
import CustomerOrdersPage from './apps/customer/CustomerOrdersPage'
import CustomerPage from './apps/customer/CustomerPage'
import CustomerReceiptPage from './apps/customer/CustomerReceiptPage'
import PaymentResultPage from './apps/customer/PaymentResultPage'
import KitchenBoardPage from './apps/kitchen/KitchenBoardPage'
import SuperAdminPage from './apps/super-admin/SuperAdminPage'
import WaiterPage from './apps/waiter/WaiterPage'
import NotFound from './components/NotFound'
import PanelNavigation from './components/PanelNavigation'
import { ensureDemoAuthForPath, getDemoLoginTarget } from './services/demoAuth'

function DemoPanelSession({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [isPreparingSession, setIsPreparingSession] = useState(
    () => getDemoLoginTarget(location.pathname) !== null,
  )

  useEffect(() => {
    let isMounted = true
    const target = getDemoLoginTarget(location.pathname)

    if (!target) {
      return
    }

    ensureDemoAuthForPath(location.pathname).finally(() => {
      if (isMounted) {
        setIsPreparingSession(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [location.pathname])

  if (isPreparingSession) {
    return (
      <main className="demo-session-loader">
        <section>
          <span>QR Order</span>
          <h1>Demo oturumu hazırlanıyor</h1>
          <p>Panel gerçek API verileriyle açılıyor.</p>
        </section>
      </main>
    )
  }

  return <>{children}</>
}

function PanelShell({ children }: { children: ReactNode }) {
  return (
    <DemoPanelSession>
      <PanelNavigation>{children}</PanelNavigation>
    </DemoPanelSession>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/customer"
        element={
          <PanelShell>
            <CustomerPage />
          </PanelShell>
        }
      />
      <Route path="/customer/orders" element={<CustomerOrdersPage />} />
      <Route path="/receipt/:billId" element={<CustomerReceiptPage />} />
      <Route path="/payment-result" element={<PaymentResultPage />} />
      <Route
        path="/customer/r/:restaurantSlug/table/:tableNumber"
        element={<CustomerPage />}
      />
      <Route
        path="/menu"
        element={
          <PanelShell>
            <CustomerPage />
          </PanelShell>
        }
      />
      <Route
        path="/kitchen"
        element={
          <PanelShell>
            <KitchenBoardPage />
          </PanelShell>
        }
      />
      <Route
        path="/waiter"
        element={
          <PanelShell>
            <WaiterPage />
          </PanelShell>
        }
      />
      <Route path="/login" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
      <Route
        path="/admin"
        element={
          <PanelShell>
            <AdminPage />
          </PanelShell>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <PanelShell>
            <AdminPage />
          </PanelShell>
        }
      />
      <Route
        path="/super-admin"
        element={
          <PanelShell>
            <SuperAdminPage />
          </PanelShell>
        }
      />
      <Route path="/access-denied" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
