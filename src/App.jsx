import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Installments from './pages/Installments'
import FixedExpenses from './pages/FixedExpenses'
import Categories from './pages/Categories'
import Goals from './pages/Goals'
import Report from './pages/Report'

function Gate({ children }) {
  const { session, profile, loadingProfile, recoveryMode } = useAuth()

  // Prioridade máxima: se o link de "esqueci minha senha" foi clicado,
  // sempre mostra a tela de definir nova senha, independente de tudo mais.
  if (recoveryMode) {
    return <ResetPassword />
  }
  if (session === undefined) {
    return <div className="loading-screen">Carregando…</div>
  }
  if (session === null) {
    return <Login />
  }
  if (loadingProfile || profile === null) {
    return <div className="loading-screen">Carregando…</div>
  }
  if (!profile.household_id) {
    return <Onboarding />
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transacoes" element={<Transactions />} />
            <Route path="/parcelamentos" element={<Installments />} />
            <Route path="/fixas" element={<FixedExpenses />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/metas" element={<Goals />} />
            <Route path="/relatorio" element={<Report />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Gate>
      </HashRouter>
    </AuthProvider>
  )
}
