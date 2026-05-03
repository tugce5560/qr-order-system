import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './apps/HomePage'
import AdminPage from './apps/admin/AdminPage'
import CustomerOrdersPage from './apps/customer/CustomerOrdersPage'
import CustomerPage from './apps/customer/CustomerPage'
import CustomerReceiptPage from './apps/customer/CustomerReceiptPage'
import KitchenBoardPage from './apps/kitchen/KitchenBoardPage'
import SuperAdminPage from './apps/super-admin/SuperAdminPage'
import WaiterPage from './apps/waiter/WaiterPage'
import NotFound from './components/NotFound'
import PanelNavigation from './components/PanelNavigation'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/customer"
        element={
          <PanelNavigation>
            <CustomerPage />
          </PanelNavigation>
        }
      />
      <Route path="/customer/orders" element={<CustomerOrdersPage />} />
      <Route path="/receipt/:billId" element={<CustomerReceiptPage />} />
      <Route
        path="/customer/r/:restaurantSlug/table/:tableNumber"
        element={<CustomerPage />}
      />
      <Route
        path="/menu"
        element={
          <PanelNavigation>
            <CustomerPage />
          </PanelNavigation>
        }
      />
      <Route
        path="/kitchen"
        element={
          <PanelNavigation>
            <KitchenBoardPage />
          </PanelNavigation>
        }
      />
      <Route
        path="/waiter"
        element={
          <PanelNavigation>
            <WaiterPage />
          </PanelNavigation>
        }
      />
      <Route path="/login" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
      <Route
        path="/admin"
        element={
          <PanelNavigation>
            <AdminPage />
          </PanelNavigation>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <PanelNavigation>
            <AdminPage />
          </PanelNavigation>
        }
      />
      <Route
        path="/super-admin"
        element={
          <PanelNavigation>
            <SuperAdminPage />
          </PanelNavigation>
        }
      />
      <Route path="/access-denied" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
