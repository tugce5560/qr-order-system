import { Route, Routes } from 'react-router-dom'
import HomePage from './apps/HomePage'
import AdminLoginPage from './apps/admin/AdminLoginPage'
import AdminPage from './apps/admin/AdminPage'
import CustomerOrdersPage from './apps/customer/CustomerOrdersPage'
import CustomerPage from './apps/customer/CustomerPage'
import CustomerReceiptPage from './apps/customer/CustomerReceiptPage'
import KitchenBoardPage from './apps/kitchen/KitchenBoardPage'
import SuperAdminPage from './apps/super-admin/SuperAdminPage'
import WaiterPage from './apps/waiter/WaiterPage'
import AccessDenied from './components/AccessDenied'
import NotFound from './components/NotFound'
import PanelNavigation from './components/PanelNavigation'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={['Customer']}>
            <PanelNavigation>
              <CustomerPage />
            </PanelNavigation>
          </ProtectedRoute>
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
          <ProtectedRoute allowedRoles={['Customer']}>
            <PanelNavigation>
              <CustomerPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute allowedRoles={['Kitchen', 'RestaurantAdmin']}>
            <PanelNavigation>
              <KitchenBoardPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter"
        element={
          <ProtectedRoute allowedRoles={['Waiter', 'RestaurantAdmin']}>
            <PanelNavigation>
              <WaiterPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['RestaurantAdmin']}>
            <PanelNavigation>
              <AdminPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['RestaurantAdmin']}>
            <PanelNavigation>
              <AdminPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['SuperAdmin']}>
            <PanelNavigation>
              <SuperAdminPage />
            </PanelNavigation>
          </ProtectedRoute>
        }
      />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
