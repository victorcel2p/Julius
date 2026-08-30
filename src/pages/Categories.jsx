import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import CategoryTag from '../components/CategoryTag'
import { CHART_COLORS, formatCurrency } from '../lib/finance'

const emptyForm = { name: '', type: 'expense', color: CHART_COLORS[0], monthly_budget: '', pinned: false }

export default function Categories() {
  const { profile } = useAuth()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    const { data } = await supabase
      .from('categories')
      .select('id, name, type, color, monthly_budget, pinned')
      .eq('household_id', profile.household_id)
      .order('type')
      .order('name')
    setCategories(data || [])
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
    if (!form.name) {
      setError('Dê um nome para a categoria.')
      return
    }
    const payload = {
      name: form.name,
      type: form.type,
      color: form.color,
      monthly_budget: form.monthly_budget === '' ? null : Number(form.monthly_budget),
      pinned: form.pinned,
      household_id: profile.household_id,
    }
    const { error: err } = editingId
      ? await supabase.from('categories').update(payload).eq('id', editingId)
      : await supabase.from('categories').insert(payload)
    if (err) setError(err.message)
    resetForm()
    load()
  }

  const handleEdit = (c) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      type: c.type,
      color: c.color,
      monthly_budget: c.monthly_budget ?? '',
      pinned: c.pinned,
    })
  }

  const handleTogglePin = async (c) => {
    await supabase.from('categories').update({ pinned: !c.pinned }).eq('id', c.id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta categoria? Lançamentos associados ficarão sem categoria.')) return
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  const income = categories.filter((c) => c.type === 'income')
  const expense = categories.filter((c) => c.type === 'expense')

  const renderRow = (c) => (
    <div className="ledger-row" key={c.id} style={{ gridTemplateColumns: '1fr auto auto auto' }}>
      <CategoryTag name={c.name} color={c.color} />
      <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
        {c.monthly_budget ? `Orçamento: ${formatCurrency(c.monthly_budget)}` : 'Sem orçamento'}
      </span>
      <button
        className="icon-btn"
        onClick={() => handleTogglePin(c)}
        type="button"
        style={c.pinned ? { borderColor: 'var(--gold)', color: 'var(--gold)' } : {}}
      >
        {c.pinned ? '★ Fixado' : '☆ Fixar no Painel'}
      </button>
      <div className="row-actions">
        <button className="icon-btn" onClick={() => handleEdit(c)} type="button">Editar</button>
        <button className="icon-btn" onClick={() => handleDelete(c.id)} type="button">Excluir</button>
      </div>
    </div>
  )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Categorias</div>
          <h1>Organize os gastos</h1>
        </div>
      </div>

      <div className="panel">
        <h2>{editingId ? 'Editar categoria' : 'Nova categoria'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field span-2">
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mercado" />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div className="field">
            <label>Cor</label>
            <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
              {CHART_COLORS.map((c) => (
                <option key={c} value={c} style={{ background: c }}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Orçamento mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="Opcional"
              value={form.monthly_budget}
              onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
            />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="pinned"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <label htmlFor="pinned" style={{ marginBottom: 0 }}>Fixar no Painel</label>
          </div>
          <div className="field" style={{ display: 'flex', gap: 10, gridColumn: '1 / -1' }}>
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
        <p className="voice-hint" style={{ margin: 0 }}>
          Categorias fixadas (★) aparecem com barra de progresso na tela principal, comparando o gasto do mês com o orçamento definido.
        </p>
      </div>

      <div className="panel">
        <h2>Despesas</h2>
        {expense.length === 0 ? (
          <div className="empty-state">Nenhuma categoria de despesa ainda.</div>
        ) : (
          expense.map(renderRow)
        )}
      </div>

      <div className="panel">
        <h2>Receitas</h2>
        {income.length === 0 ? (
          <div className="empty-state">Nenhuma categoria de receita ainda.</div>
        ) : (
          income.map(renderRow)
        )}
      </div>
    </Layout>
  )
}
