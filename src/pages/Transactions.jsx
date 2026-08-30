import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import MonthPicker from '../components/MonthPicker'
import CategoryTag from '../components/CategoryTag'
import { formatCurrency, formatDate, monthBounds, installmentEntriesForMonth, recurringEntriesForMonth, todayISO, PAYMENT_METHODS, paymentMethodLabel } from '../lib/finance'

const getEmptyForm = () => ({
  description: '',
  amount: '',
  type: 'expense',
  category_id: '',
  payment_method: '',
  date: todayISO(),
})

const REQUIRED_FIELDS = ['description', 'amount', 'type', 'category_id', 'payment_method', 'date']

export default function Transactions() {
  const { profile, user } = useAuth()
  const [month, setMonth] = useState(new Date())
  const [transactions, setTransactions] = useState([])
  const [installments, setInstallments] = useState([])
  const [recurring, setRecurring] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(getEmptyForm)
  const [editingId, setEditingId] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    const { start, end } = monthBounds(month)
    const [txRes, catRes, instRes, recRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, description, amount, type, date, category_id, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('categories').select('id, name, color, type').eq('household_id', profile.household_id).order('name'),
      supabase
        .from('installments')
        .select('id, description, total_amount, installments_count, first_date, category_id, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id),
      supabase
        .from('recurring_expenses')
        .select('id, description, amount, type, category_id, day_of_month, start_date, active, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id),
    ])
    setTransactions(txRes.data || [])
    setCategories(catRes.data || [])
    setInstallments(instRes.data || [])
    setRecurring(recRes.data || [])
  }, [profile, month])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setForm(getEmptyForm())
    setEditingId(null)
  }

  const missingFields = () => REQUIRED_FIELDS.filter((f) => !form[f])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const missing = missingFields()
    if (missing.length > 0) {
      setError('Preencha todos os campos antes de confirmar: descrição, valor, tipo, categoria, forma de pagamento e data.')
      return
    }
    const payload = {
      description: form.description,
      amount: Number(form.amount),
      type: form.type,
      category_id: form.category_id,
      payment_method: form.payment_method,
      date: form.date,
      household_id: profile.household_id,
      user_id: user.id,
    }
    if (editingId) {
      const { error: err } = await supabase.from('transactions').update(payload).eq('id', editingId)
      if (err) setError(err.message)
    } else {
      const { error: err } = await supabase.from('transactions').insert(payload)
      if (err) setError(err.message)
    }
    resetForm()
    load()
  }

  const handleEdit = (t) => {
    setEditingId(t.id)
    setForm({
      description: t.description,
      amount: String(t.amount),
      type: t.type,
      category_id: t.category_id || '',
      payment_method: t.payment_method || '',
      date: t.date,
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  const installmentEntries = useMemo(
    () => installmentEntriesForMonth(installments, month),
    [installments, month]
  )
  const recurringEntries = useMemo(
    () => recurringEntriesForMonth(recurring, month),
    [recurring, month]
  )
  const combined = useMemo(
    () => [...transactions, ...installmentEntries, ...recurringEntries].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, installmentEntries, recurringEntries]
  )

  const searchFiltered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return combined.filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (term && !t.description.toLowerCase().includes(term)) return false
      return true
    })
  }, [combined, typeFilter, search])

  const visible = searchFiltered.slice(0, 10)
  const relevantCategories = categories.filter((c) => c.type === form.type)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Lançamentos</div>
          <h1>Receitas e despesas</h1>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="panel">
        <h2>{editingId ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field span-2">
            <label>Descrição *</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Mercado, salário…"
            />
          </div>
          <div className="field">
            <label>Valor (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Tipo *</label>
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
            <label>Data *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
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

        <div className="filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descrição…"
            style={{
              padding: '8px 10px',
              border: '2px solid var(--border-strong)',
              background: '#ece7d9',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              minWidth: 220,
            }}
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="income">Só receitas</option>
            <option value="expense">Só despesas</option>
          </select>
        </div>

        {searchFiltered.length === 0 ? (
          <div className="empty-state">Nenhum lançamento neste mês com esse filtro.</div>
        ) : (
          <>
            {visible.map((t) => (
              <div className="ledger-row" key={t.id}>
                <div className="ledger-desc">{t.description}</div>
                {t.categories ? <CategoryTag name={t.categories.name} color={t.categories.color} /> : <span />}
                <div className="ledger-date">
                  {formatDate(t.date)}
                  {t.payment_method ? ` · ${paymentMethodLabel(t.payment_method)}` : ''}
                </div>
                <div className={`ledger-amount ${t.type}`}>
                  {t.type === 'expense' ? '-' : '+'} {formatCurrency(t.amount)}
                </div>
                {t.isInstallment ? (
                  <span className="ledger-date">parcela</span>
                ) : t.isRecurring ? (
                  <span className="ledger-date">fixa</span>
                ) : (
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => handleEdit(t)} type="button">
                      Editar
                    </button>
                    <button className="icon-btn" onClick={() => handleDelete(t.id)} type="button">
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            ))}
            {searchFiltered.length > 10 && (
              <p className="voice-hint" style={{ marginTop: 12, marginBottom: 0 }}>
                Mostrando os 10 mais recentes de {searchFiltered.length} lançamentos encontrados. Refine a busca para ver outros.
              </p>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
