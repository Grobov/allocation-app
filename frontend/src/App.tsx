import { NavLink, Navigate, Route, Routes } from 'react-router'

import { DashboardPage } from './features/dashboard/DashboardPage'
import { EngineersPage } from './features/engineers/EngineersPage'

export function App() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="side">
        <div className="brand">
          QA Allocation<small>Management</small>
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end>
            Allocation Dashboard
          </NavLink>
          <NavLink to="/engineers">Engineers</NavLink>
        </nav>
      </aside>
      <main className="main" id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/engineers" element={<EngineersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
