import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name } },
      })
      if (signUpError) {
        setError(traduzErro(signUpError.message))
      } else {
        setInfo('Conta criada! Se a confirmação por e-mail estiver ativa no seu projeto Supabase, verifique sua caixa de entrada antes de entrar.')
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) setError(traduzErro(signInError.message))
    }
    setBusy(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-eyebrow">Julius</div>
        <h1>Contas em dia,{'\u00A0'}a dois.</h1>
        <p className="sub">Controle financeiro simples para vocês dois acompanharem juntos.</p>

        <div className="tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
            Entrar
          </button>
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')} type="button">
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">Seu nome</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Victor" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          {error && <div className="error-text">{error}</div>}
          {info && <div className="error-text" style={{ color: '#3e7a57' }}>{info}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function traduzErro(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('User already registered')) return 'Já existe uma conta com esse e-mail.'
  if (msg.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.'
  return msg
}
