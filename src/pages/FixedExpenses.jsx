import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import CategoryTag from '../components/CategoryTag'
import { formatCurrency, todayISO, PAYMENT_METHODS, paymentMethodLabel } from '../lib/finance'

const getEmptyForm = () => ({
  description: '',
  amount: '',
  type: 'expense',
  category_id: '',
  day_of_month: '5',
  start_date: todayISO(),
  payment_method: '',
})

export default function FixedExpenses() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(getEmptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    const [itemsRes, catRes] = await Promise.all([
      supabase
        .from('recurring_expenses')
        .select('id, description, amount, type, category_id, day_of_month, start_date, active, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id)
        .order('day_of_month'),
      supabase.from('categories').select('id, name, color, type').eq('household_id', profile.household_id).order('name'),
    ])
    setItems(itemsRes.data || [])
    setCategories(catRes.data || [])
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm(getEmptyForm())
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.description || !form.amount || !form.day_of_month || !form.category_id || !form.payment_method) {
      setError('Preencha todos os campos: descrição, valor, categoria, forma de pagamento e o dia do mês.')
      return
    }
    const payload = {
      description: form.description,
      amount: Number(form.amount),
      type: form.type,
      category_id: form.category_id || null,
      day_of_month: parseInt(form.day_of_month, 10),
      start_date: form.start_date,
      payment_method: form.payment_method,
      household_id: profile.household_id,
    }
    const { error: err } = editingId
      ? await supabase.from('recurring_expenses').update(payload).eq('id', editingId)
      : await supabase.from('recurring_expenses').insert(payload)
    if (err) setError(err.message)
    resetForm()
    load()
  }

  const handleEdit = (r) => {
    setEditingId(r.id)
    setForm({
      description: r.description,
      amount: String(r.amount),
      type: r.type,
      category_id: r.category_id || '',
      day_of_month: String(r.day_of_month),
      start_date: r.start_date,
      payment_method: r.payment_method || '',
    })
  }

  const handleToggleActive = async (r) => {
    await supabase.from('recurring_expenses').update({ active: !r.active }).eq('id', r.id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta despesa fixa? Ela deixará de aparecer nos próximos meses.')) return
    await supabase.from('recurring_expenses').delete().eq('id', id)
    load()
  }

  const relevantCategories = categories.filter((c) => c.type === form.type)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Despesas fixas</div>
          <h1>Contas que se repetem todo mês</h1>
        </div>
      </div>

      <div className="panel">
        <h2>{editingId ? 'Editar despesa fixa' : 'Nova despesa fixa'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field span-2">
            <label>Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Aluguel, internet, academia…"
            />
          </div>
          <div className="field">
            <label>Valor (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tipo</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, category_id: '' })}>
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div className="field">
            <label>Categoria *</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Selecione…</option>
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Forma de pagamento *</label>
            <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
              <option value="">Selecione…</option>
              {PAYMENT_METHODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Dia do mês *</label>
            <input
              type="number"
              min="1"
              max="31"
              value={form.day_of_month}
              onChange={(e) => setForm({ ...form, day_of_month: e.target.value })}
            />
          </div>
          <div className="field" style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" style={{ width: 'auto' }}>
              {editingId ? 'Salvar alterações' : 'Adicionar'}
            </button>
            {editingId && (
              <button className="btn btn-ghost" type="button" onClick={resetForm}>
                Cancelar edição
              </button>
            )}
          </div>
        </form>
        {error && <div className="error-text">{error}</div>}
        <p className="voice-hint" style={{ margin: 0 }}>
          Aparece automaticamente no Painel e em Lançamentos todo mês, no dia informado, até você desativar.
        </p>
      </div>

      <div className="panel">
        <h2>Fixas cadastradas</h2>
        {items.length === 0 ? (
          <div className="empty-state">Nenhuma despesa fixa cadastrada ainda.</div>
        ) : (
          items.map((r) => (
            <div className="ledger-row" key={r.id} style={{ gridTemplateColumns: '1fr auto auto auto auto', opacity: r.active ? 1 : 0.5 }}>
              <div className="ledger-desc">{r.description}</div>
              {r.categories ? <CategoryTag name={r.categories.name} color={r.categories.color} /> : <span />}
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                dia {r.day_of_month}{r.payment_method ? ` · ${paymentMethodLabel(r.payment_method)}` : ''}
              </span>
              <div className={`ledger-amount ${r.type}`}>
                {r.type === 'expense' ? '-' : '+'} {formatCurrency(r.amount)}
              </div>
              <div className="row-actions">
                <button className="icon-btn" onClick={() => handleToggleActive(r)} type="button">
                  {r.active ? 'Desativar' : 'Ativar'}
                </button>
                <button className="icon-btn" onClick={() => handleEdit(r)} type="button">Editar</button>
                <button className="icon-btn" onClick={() => handleDelete(r.id)} type="button">Excluir</button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
