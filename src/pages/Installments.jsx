import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import CategoryTag from '../components/CategoryTag'
import { formatCurrency, formatDate, addMonths, todayISO, PAYMENT_METHODS } from '../lib/finance'

const getEmptyForm = () => ({
  description: '',
  total_amount: '',
  installments_count: '2',
  first_date: todayISO(),
  category_id: '',
  payment_method: '',
})

export default function Installments() {
  const { profile } = useAuth()
  const [installments, setInstallments] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(getEmptyForm)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    const [instRes, catRes] = await Promise.all([
      supabase
        .from('installments')
        .select('id, description, total_amount, installments_count, first_date, category_id, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id)
        .order('first_date', { ascending: false }),
      supabase.from('categories').select('id, name, color').eq('household_id', profile.household_id).eq('type', 'expense').order('name'),
    ])
    setInstallments(instRes.data || [])
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
    if (!form.description || !form.total_amount || !form.installments_count || !form.category_id || !form.payment_method) {
      setError('Preencha todos os campos: descrição, valor total, parcelas, categoria e forma de pagamento.')
      return
    }
    const payload = {
      description: form.description,
      total_amount: Number(form.total_amount),
      installments_count: parseInt(form.installments_count, 10),
      first_date: form.first_date,
      category_id: form.category_id || null,
      payment_method: form.payment_method,
      household_id: profile.household_id,
    }
    const { error: err } = editingId
      ? await supabase.from('installments').update(payload).eq('id', editingId)
      : await supabase.from('installments').insert(payload)
    if (err) setError(err.message)
    resetForm()
    load()
  }

  const handleEdit = (i) => {
    setEditingId(i.id)
    setForm({
      description: i.description,
      total_amount: String(i.total_amount),
      installments_count: String(i.installments_count),
      first_date: i.first_date,
      category_id: i.category_id || '',
      payment_method: i.payment_method || '',
    })
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este parcelamento? Ele deixará de aparecer nos meses futuros.')) return
    await supabase.from('installments').delete().eq('id', id)
    load()
  }

  const today = new Date()

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Parcelamentos</div>
          <h1>Compras parceladas</h1>
        </div>
      </div>

      <div className="panel">
        <h2>{editingId ? 'Editar parcelamento' : 'Novo parcelamento'}</h2>
        <form className="inline-form" onSubmit={handleSubmit}>
          <div className="field span-2">
            <label>Descrição</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Geladeira, celular…"
            />
          </div>
          <div className="field">
            <label>Valor total (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Nº de parcelas</label>
            <input
              type="number"
              min="1"
              value={form.installments_count}
              onChange={(e) => setForm({ ...form, installments_count: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Categoria *</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Selecione…</option>
              {categories.map((c) => (
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
            <label>1ª parcela em *</label>
            <input type="date" value={form.first_date} onChange={(e) => setForm({ ...form, first_date: e.target.value })} />
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
          O valor total é dividido pelo número de parcelas e aparece automaticamente no Painel e em Lançamentos, mês a mês, sem precisar recadastrar.
        </p>
      </div>

      <div className="panel">
        <h2>Parcelamentos ativos</h2>
        {installments.length === 0 ? (
          <div className="empty-state">Nenhuma compra parcelada cadastrada ainda.</div>
        ) : (
          installments.map((i) => {
            const first = new Date(i.first_date + 'T00:00:00')
            const monthsDiff = (today.getFullYear() - first.getFullYear()) * 12 + (today.getMonth() - first.getMonth())
            const currentInstallment = Math.min(Math.max(monthsDiff + 1, 0), i.installments_count)
            const finished = monthsDiff >= i.installments_count
            const perInstallment = Number(i.total_amount) / i.installments_count
            const lastDate = addMonths(first, i.installments_count - 1)
            return (
              <div className="goal-card" key={i.id}>
                <div className="goal-head">
                  <strong>{i.description}</strong>
                  <div className="row-actions">
                    {i.categories && <CategoryTag name={i.categories.name} color={i.categories.color} />}
                    <span className="mono">{formatCurrency(perInstallment)} / parcela</span>
                    <button className="icon-btn" onClick={() => handleEdit(i)} type="button">Editar</button>
                    <button className="icon-btn" onClick={() => handleDelete(i.id)} type="button">Excluir</button>
                  </div>
                </div>
                <div className="goal-track">
                  <div
                    className="goal-fill"
                    style={{ width: `${Math.min(100, (currentInstallment / i.installments_count) * 100)}%` }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }} className="mono">
                  {finished
                    ? `Quitado — ${i.installments_count}/${i.installments_count} parcelas`
                    : `Parcela ${Math.max(currentInstallment, 1)}/${i.installments_count}`}{' '}
                  · total {formatCurrency(i.total_amount)} · começou em {formatDate(i.first_date)} · termina em{' '}
                  {lastDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </Layout>
  )
}
