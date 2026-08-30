import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import MonthPicker from '../components/MonthPicker'
import CategoryTag from '../components/CategoryTag'
import VoiceExpenseModal from '../components/VoiceExpenseModal'
import { formatCurrency, formatDate, monthBounds, installmentEntriesForMonth, recurringEntriesForMonth, paymentMethodLabel } from '../lib/finance'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [month, setMonth] = useState(new Date())
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [installments, setInstallments] = useState([])
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)
  const [voiceOpen, setVoiceOpen] = useState(false)

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    setLoading(true)
    const { start, end } = monthBounds(month)
    const [txRes, catRes, instRes, recRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, description, amount, type, date, category_id, payment_method, categories ( name, color )')
        .eq('household_id', profile.household_id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase.from('categories').select('id, name, color, type, monthly_budget, pinned').eq('household_id', profile.household_id),
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
    setLoading(false)
  }, [profile, month])

  useEffect(() => {
    load()
  }, [load])

  // Junta os lançamentos reais do mês com parcelas e despesas fixas que "caem" nele
  const allEntries = useMemo(() => {
    const instEntries = installmentEntriesForMonth(installments, month)
    const recEntries = recurringEntriesForMonth(recurring, month)
    return [...transactions, ...instEntries, ...recEntries].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [transactions, installments, recurring, month])

  const { income, expense, balance, byCategory, spentByCategoryId } = useMemo(() => {
    let income = 0
    let expense = 0
    const cat = {}
    const byId = {}
    for (const t of allEntries) {
      if (t.type === 'income') {
        income += Number(t.amount)
      } else {
        expense += Number(t.amount)
        const key = t.categories?.name || 'Sem categoria'
        if (!cat[key]) cat[key] = { value: 0, color: t.categories?.color || 'var(--muted)' }
        cat[key].value += Number(t.amount)
        if (t.category_id) byId[t.category_id] = (byId[t.category_id] || 0) + Number(t.amount)
      }
    }
    const byCategory = Object.entries(cat)
      .map(([name, { value, color }]) => ({ name, value, color }))
      .sort((a, b) => b.value - a.value)
    return { income, expense, balance: income - expense, byCategory, spentByCategoryId: byId }
  }, [allEntries])

  const pinnedCategories = categories.filter((c) => c.pinned && c.type === 'expense')
  const recent = allEntries.slice(0, 6)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Painel</div>
          <h1>Como está o mês</h1>
        </div>
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <button className="voice-cta" onClick={() => setVoiceOpen(true)} type="button">
        <span className="mic-emoji">🎙</span> Registrar despesa
      </button>

      <VoiceExpenseModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onSaved={load}
        categories={categories}
        householdId={profile?.household_id}
        userId={user?.id}
      />

      <div className="stamp-row">
        <div className={`balance-stamp ${balance >= 0 ? 'positive' : 'negative'}`}>
          <div className="balance-stamp-inner">
            <div className="balance-stamp-label">Saldo do mês</div>
            <div className="balance-stamp-value mono">{formatCurrency(balance)}</div>
          </div>
        </div>
        <div className="summary-cards">
          <div className="summary-card income">
            <div className="label">Receitas</div>
            <div className="value">{formatCurrency(income)}</div>
          </div>
          <div className="summary-card expense">
            <div className="label">Despesas</div>
            <div className="value">{formatCurrency(expense)}</div>
          </div>
        </div>
      </div>

      {pinnedCategories.length > 0 && (
        <div className="panel">
          <h2>Orçamento por categoria</h2>
          {pinnedCategories.map((c) => {
            const spent = spentByCategoryId[c.id] || 0
            const budget = Number(c.monthly_budget) || 0
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
            const over = budget > 0 && spent > budget
            return (
              <div className="goal-card" key={c.id}>
                <div className="goal-head">
                  <CategoryTag name={c.name} color={c.color} />
                  <span className="mono" style={over ? { color: 'var(--brick)' } : {}}>
                    {formatCurrency(spent)} {budget > 0 ? `/ ${formatCurrency(budget)}` : '(sem limite definido)'}
                  </span>
                </div>
                {budget > 0 && (
                  <div className="goal-track">
                    <div
                      className="goal-fill"
                      style={{ width: `${pct}%`, background: over ? 'var(--brick)' : 'var(--gold)' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="panel">
        <h2>Despesas por categoria</h2>
        {loading ? (
          <div className="empty-state">Carregando…</div>
        ) : byCategory.length === 0 ? (
          <div className="empty-state">Nenhuma despesa lançada neste mês ainda.</div>
        ) : (
          byCategory.map((c) => {
            const pct = expense > 0 ? Math.min(100, (c.value / expense) * 100) : 0
            return (
              <div className="goal-card" key={c.name}>
                <div className="goal-head">
                  <CategoryTag name={c.name} color={c.color} />
                  <span className="mono">
                    {formatCurrency(c.value)} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="goal-track">
                  <div className="goal-fill" style={{ width: `${pct}%`, background: c.color }} />
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Últimos lançamentos</h2>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">Nada por aqui ainda. Adicione o primeiro lançamento em "Lançamentos".</div>
        ) : (
          recent.map((t) => (
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
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}
