import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import { formatCurrency } from '../lib/finance'

const emptyForm = { name: '', target_amount: '', current_amount: '0', deadline: '' }

export default function Goals() {
  const { profile } = useAuth()
  const [goals, setGoals] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('goals')
      .select('id, name, target_amount, current_amount, deadline')
      .eq('household_id', profile.household_id)
      .order('deadline', { nullsFirst: false })
    setGoals(data || [])
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.target_amount) {
      setError('Dê um nome e um valor alvo para a meta.')
      return
    }
    const payload = {
      name: form.name,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount || 0),
      deadline: form.deadline || null,
      household_id: profile.household_id,
    }
    const { error: err } = editingId
      ? await supabase.from('goals').update(payload).eq('id', editingId)
      : await supabase.from('goals').insert(payload)
    if (err) setError(err.message)
    resetForm()
    load()
  }

  const handleEdit = (g) => {
    setEditingId(g.id)
    setForm({
      name: g.name,
      target_amount: String(g.target_amount),
      current_amount: String(g.current_amount),
      deadline: g.deadline || '',
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    load()
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Metas</div>
          <h1>Objetivos do casal</h1>
        </div>
      </div>

      <div className="panel">
        <h2>{editingId ? 'Editar meta' : 'Nova meta'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field span-2">
            <label>Nome da meta</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Viagem, reserva de emergência…" />
          </div>
          <div className="field">
            <label>Valor alvo (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.target_amount}
              onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Já guardado (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.current_amount}
              onChange={(e) => setForm({ ...form, current_amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Prazo</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="field" style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" style={{ width: 'auto' }}>
              {editingId ? 'Salvar' : 'Adicionar'}
            </button>
            {editingId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="panel">
        <h2>Metas em andamento</h2>
        {goals.length === 0 ? (
          <div className="empty-state">Nenhuma meta cadastrada ainda.</div>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100 || 0)
            return (
              <div className="goal-card" key={g.id}>
                <div className="goal-head">
                  <strong>{g.name}</strong>
                  <div className="row-actions">
                    <span className="mono">
                      {formatCurrency(g.current_amount)} / {formatCurrency(g.target_amount)}
                    </span>
                    <button className="icon-btn" onClick={() => handleEdit(g)} type="button">Editar</button>
                    <button className="icon-btn" onClick={() => handleDelete(g.id)} type="button">Excluir</button>
                  </div>
                </div>
                <div className="goal-track">
                  <div className="goal-fill" style={{ width: `${pct}%` }} />
                </div>
                {g.deadline && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    Prazo: {new Date(g.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}
