import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function Onboarding() {
  const { refreshProfile, signOut } = useAuth()
  const [mode, setMode] = useState('create')
  const [householdName, setHouseholdName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('create_household', {
      household_name: householdName,
    })
    if (rpcError) setError(rpcError.message)
    else await refreshProfile()
    setBusy(false)
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('join_household', {
      code: code.trim().toUpperCase(),
    })
    if (rpcError) setError('Código não encontrado. Confira com quem te enviou.')
    else await refreshProfile()
    setBusy(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-eyebrow">Quase lá</div>
        <h1>Criem ou entrem num lar</h1>
        <p className="sub">
          Um "lar" é o espaço compartilhado onde os lançamentos de vocês dois aparecem juntos.
        </p>

        <div className="tabs">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')} type="button">
            Criar lar
          </button>
          <button className={mode === 'join' ? 'active' : ''} onClick={() => setMode('join')} type="button">
            Entrar com código
          </button>
        </div>

        {mode === 'create' ? (
          <form onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="hname">Nome do lar</label>
              <input
                id="hname"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="Casa do Victor"
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Criando…' : 'Criar lar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin}>
            <div className="field">
              <label htmlFor="code">Código de convite</label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: 7XQK2P"
                required
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Entrando…' : 'Entrar no lar'}
            </button>
          </form>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={signOut} type="button">
          Sair da conta
        </button>
      </div>
    </div>
  )
}
