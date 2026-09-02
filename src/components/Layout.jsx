import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const links = [
  { to: '/', label: 'Painel', end: true },
  { to: '/transacoes', label: 'Lançamentos' },
  { to: '/parcelamentos', label: 'Parcelamentos' },
  { to: '/fixas', label: 'Despesas Fixas' },
  { to: '/categorias', label: 'Categorias' },
  { to: '/metas', label: 'Metas' },
  { to: '/relatorio', label: 'Relatório' },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const household = profile?.households
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-btn"
        onClick={() => setMenuOpen((v) => !v)}
        type="button"
        aria-label="Abrir menu"
        aria-expanded={menuOpen}
      >
        <span className="hamburger-dot" />
        <span className="hamburger-dot" />
        <span className="hamburger-dot" />
      </button>

      <div className="mobile-topbar">
        <div className="brand">Julius</div>
      </div>

      {menuOpen && (
        <>
          <div className="mobile-menu-backdrop" onClick={() => setMenuOpen(false)} />
          <div className="mobile-menu-panel">
            <div className="person-chip">{profile?.display_name}</div>
            {household?.invite_code && (
              <div className="person-chip mono">Código do lar: {household.invite_code}</div>
            )}
            <nav>
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <button className="btn btn-ghost" onClick={signOut} type="button">
              Sair
            </button>
          </div>
        </>
      )}

      <aside className="sidebar">
        <div>
          <div className="brand">Julius</div>
          <div className="brand-sub">{household?.name || 'seu lar'}</div>
        </div>
        <nav>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="person-chip">{profile?.display_name}</div>
          {household?.invite_code && (
            <div className="person-chip mono">Código do lar: {household.invite_code}</div>
          )}
          <button className="btn btn-ghost" onClick={signOut} type="button">
            Sair
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
