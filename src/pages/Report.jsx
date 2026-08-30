import { useEffect, useMemo, useState, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import Layout from '../components/Layout'
import MonthPicker from '../components/MonthPicker'
import {
  formatCurrency,
  monthBounds,
  addMonths,
  installmentEntriesForMonth,
  recurringEntriesForMonth,
} from '../lib/finance'

const MONTHS_BACK = 6

export default function Report() {
  const { profile } = useAuth()
  const [refMonth, setRefMonth] = useState(new Date())
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [installments, setInstallments] = useState([])
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)

  const rangeStart = useMemo(() => addMonths(refMonth, -(MONTHS_BACK - 1)), [refMonth])

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    setLoading(true)
    const { start } = monthBounds(rangeStart)
    const { end } = monthBounds(refMonth)
    const [txRes, catRes, instRes, recRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('id, amount, type, date, category_id, categories ( name, color )')
        .eq('household_id', profile.household_id)
        .gte('date', start)
        .lte('date', end),
      supabase.from('categories').select('id, name, color, type, monthly_budget').eq('household_id', profile.household_id),
      supabase
        .from('installments')
        .select('id, description, total_amount, installments_count, first_date, category_id, categories ( name, color )')
        .eq('household_id', profile.household_id),
      supabase
        .from('recurring_expenses')
        .select('id, description, amount, type, category_id, day_of_month, start_date, active, categories ( name, color )')
        .eq('household_id', profile.household_id),
    ])
    setTransactions(txRes.data || [])
    setCategories(catRes.data || [])
    setInstallments(instRes.data || [])
    setRecurring(recRes.data || [])
    setLoading(false)
  }, [profile, rangeStart, refMonth])

  useEffect(() => {
    load()
  }, [load])

  // Gráfico 1: total de despesas por mês, últimos 6 meses
  const monthlyTotals = useMemo(() => {
    const months = []
    for (let i = 0; i < MONTHS_BACK; i++) {
      months.push(addMonths(rangeStart, i))
    }
    return months.map((m) => {
      const { start, end } = monthBounds(m)
      const real = transactions.filter((t) => t.type === 'expense' && t.date >= start && t.date <= end)
      const inst = installmentEntriesForMonth(installments, m)
      const rec = recurringEntriesForMonth(recurring, m).filter((r) => r.type === 'expense')
      const total = [...real, ...inst, ...rec].reduce((sum, t) => sum + Number(t.amount), 0)
      return {
        label: m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        total,
      }
    })
  }, [rangeStart, transactions, installments, recurring])

  // Gráfico 2: orçamento x gasto real por categoria, no mês de referência
  const budgetComparison = useMemo(() => {
    const { start, end } = monthBounds(refMonth)
    const real = transactions.filter((t) => t.type === 'expense' && t.date >= start && t.date <= end)
    const inst = installmentEntriesForMonth(installments, refMonth)
    const rec = recurringEntriesForMonth(recurring, refMonth).filter((r) => r.type === 'expense')
    const all = [...real, ...inst, ...rec]

    const expenseCategories = categories.filter((c) => c.type === 'expense')
    return expenseCategories
      .map((c) => {
        const spent = all.filter((t) => t.category_id === c.id).reduce((sum, t) => sum + Number(t.amount), 0)
        return { name: c.name, gasto: spent, orcamento: Number(c.monthly_budget) || 0 }
      })
      .filter((row) => row.gasto > 0 || row.orcamento > 0)
      .sort((a, b) => b.gasto - a.gasto)
      .slice(0, 8)
  }, [refMonth, transactions, installments, recurring, categories])

  return (
    <Layout>
      <div className="page-header">
        <div>
          <div className="eyebrow">Relatório</div>
          <h1>Onde o dinheiro foi</h1>
        </div>
        <MonthPicker month={refMonth} onChange={setRefMonth} />
      </div>

      <div className="panel">
        <h2>Total de despesas por mês</h2>
        <p className="voice-hint" style={{ marginTop: -8 }}>
          Últimos {MONTHS_BACK} meses, incluindo despesas fixas e parcelas — mostra se o gasto geral está subindo ou caindo.
        </p>
        {loading ? (
          <div className="empty-state">Carregando…</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} />
              <YAxis stroke="var(--muted)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="total" name="Total gasto" fill="var(--brick)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel">
        <h2>Orçamento x gasto real por categoria</h2>
        <p className="voice-hint" style={{ marginTop: -8 }}>
          No mês selecionado acima — aponta exatamente onde o gasto passou do combinado (defina o orçamento em Categorias).
        </p>
        {loading ? (
          <div className="empty-state">Carregando…</div>
        ) : budgetComparison.length === 0 ? (
          <div className="empty-state">Sem despesas ou orçamentos definidos neste mês.</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, budgetComparison.length * 44)}>
            <BarChart data={budgetComparison} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--paper-line)" />
              <XAxis type="number" stroke="var(--muted)" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" stroke="var(--muted)" fontSize={12} width={100} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="orcamento" name="Orçamento" fill="var(--gold)" />
              <Bar dataKey="gasto" name="Gasto real" fill="var(--brick)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Layout>
  )
}
