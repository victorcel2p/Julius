export function formatCurrency(value) {
  const n = Number(value) || 0
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Formata um objeto Date como "AAAA-MM-DD" usando o horário LOCAL do
// navegador — nunca usar toISOString() para isso, porque ele converte pra
// UTC e pode "pular" pro dia/mês seguinte à noite em fusos como o do Brasil.
export function formatLocalDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthBounds(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return {
    start: formatLocalDate(start),
    end: formatLocalDate(end),
  }
}

export function formatMonthLabel(date) {
  return date
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

export function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function formatDate(isoDate) {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

// Sempre calcula a data de hoje na hora da chamada, no horário local —
// nunca fica "congelada" e nunca pula de mês por causa de fuso horário.
export function todayISO() {
  return formatLocalDate(new Date())
}

export const CHART_COLORS = [
  '#a8452c',
  '#c98f22',
  '#3e7a57',
  '#4a6fa5',
  '#8c5b9e',
  '#b0813f',
  '#5b8a8f',
  '#9a4f6a',
]

export const PAYMENT_METHODS = [
  { value: 'debito', label: 'Cartão de débito' },
  { value: 'credito', label: 'Cartão de crédito' },
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
]

export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label || value
}

// Calcula, para um dado mês, as despesas/receitas fixas recorrentes ativas
// que já começaram até esse mês — repete indefinidamente, sem duplicar
// linhas no banco.
export function recurringEntriesForMonth(recurring, monthDate) {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const entries = []
  for (const r of recurring) {
    if (!r.active) continue
    const start = new Date(r.start_date + 'T00:00:00')
    const startsBeforeOrInMonth = start.getFullYear() < y || (start.getFullYear() === y && start.getMonth() <= m)
    if (!startsBeforeOrInMonth) continue
    const day = Math.min(r.day_of_month, new Date(y, m + 1, 0).getDate())
    const chargeDate = formatLocalDate(new Date(y, m, day))
    entries.push({
      id: `rec-${r.id}-${y}-${m}`,
      description: r.description,
      amount: Number(r.amount),
      type: r.type,
      date: chargeDate,
      category_id: r.category_id,
      categories: r.categories,
      payment_method: r.payment_method,
      isRecurring: true,
    })
  }
  return entries
}

// Calcula, para um dado mês, quais parcelas de compras parceladas "caem"
// nele — sem precisar duplicar linhas no banco para cada mês.
export function installmentEntriesForMonth(installments, monthDate) {
  const y = monthDate.getFullYear()
  const m = monthDate.getMonth()
  const entries = []
  for (const inst of installments) {
    const first = new Date(inst.first_date + 'T00:00:00')
    const monthsDiff = (y - first.getFullYear()) * 12 + (m - first.getMonth())
    if (monthsDiff < 0 || monthsDiff >= inst.installments_count) continue
    const perInstallment = Number(inst.total_amount) / inst.installments_count
    const day = Math.min(first.getDate(), new Date(y, m + 1, 0).getDate())
    const chargeDate = formatLocalDate(new Date(y, m, day))
    entries.push({
      id: `inst-${inst.id}-${monthsDiff}`,
      description: `${inst.description} (parcela ${monthsDiff + 1}/${inst.installments_count})`,
      amount: perInstallment,
      type: 'expense',
      date: chargeDate,
      category_id: inst.category_id,
      categories: inst.categories,
      payment_method: inst.payment_method,
      isInstallment: true,
    })
  }
  return entries
}

// ---------------------------------------------------------------------
// Reconhecimento de fala: números por extenso em português
// ---------------------------------------------------------------------

const NUMBER_WORDS = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18,
  dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
  duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
}

function wordsToNumber(tokens) {
  let total = 0
  let current = 0
  let found = false
  for (const tok of tokens) {
    if (tok === 'mil') {
      total += (current || 1) * 1000
      current = 0
      found = true
    } else if (tok in NUMBER_WORDS) {
      current += NUMBER_WORDS[tok]
      found = true
    }
    // "e" é apenas um conector, ignorado
  }
  total += current
  return found ? total : null
}

function isNumberToken(tok) {
  return tok === 'mil' || tok === 'e' || tok in NUMBER_WORDS
}

// Procura, perto de uma palavra-chave (ex: "reais", "vezes"), a sequência de
// palavras numéricas (por extenso) mais próxima e converte pra número.
function findSpokenNumberNear(tokens, keywordTest) {
  const idx = tokens.findIndex(keywordTest)
  if (idx > 0) {
    let i = idx - 1
    const span = []
    while (i >= 0 && isNumberToken(tokens[i])) {
      span.unshift(tokens[i])
      i--
    }
    if (span.length) {
      const value = wordsToNumber(span)
      if (value !== null) return { value, span }
    }
  }
  // fallback: maior sequência de palavras numéricas na frase toda
  let best = []
  let current = []
  for (const t of tokens) {
    if (isNumberToken(t)) {
      current.push(t)
    } else {
      if (current.length > best.length) best = current
      current = []
    }
  }
  if (current.length > best.length) best = current
  if (!best.length) return null
  const value = wordsToNumber(best)
  return value !== null ? { value, span: best } : null
}

// Tenta extrair valor, descrição, categoria e nº de parcelas de uma frase
// falada. Entende tanto dígitos ("50 reais") quanto números por extenso
// ("cinquenta reais", "cento e vinte reais", "dois mil reais"), incluindo
// centavos ("trinta reais e cinquenta centavos"). Também reconhece parcelas
// por extenso ("em dez vezes").
export function parseVoiceTranscript(transcript, categories = []) {
  const raw = transcript.trim()
  const lower = raw.toLowerCase()
  const tokens = lower.split(/\s+/).filter(Boolean)

  // --- Parcelas -------------------------------------------------------
  let installments = 1
  let installmentsSpanText = ''
  const digitInstallments = lower.match(
    /(?:em\s+)?(\d{1,2})\s*(?:x\b|vezes|parcelas?)|parcelad[oa]\s+em\s+(\d{1,2})/
  )
  if (digitInstallments) {
    installments = parseInt(digitInstallments[1] || digitInstallments[2], 10)
    installmentsSpanText = digitInstallments[0]
  } else {
    const spoken = findSpokenNumberNear(tokens, (t) => t === 'vezes' || t === 'parcelas' || t === 'parcela')
    if (spoken && spoken.value >= 2 && spoken.value <= 48) {
      installments = spoken.value
      installmentsSpanText = spoken.span.join(' ')
    }
  }

  // --- Valor ------------------------------------------------------------
  let amount = null
  let amountSpanText = ''
  const digitAmount = lower.match(/(\d+(?:[.,]\d{1,2})?)/)
  if (digitAmount) {
    amount = parseFloat(digitAmount[1].replace(',', '.'))
    amountSpanText = digitAmount[0]
  } else {
    const spoken = findSpokenNumberNear(tokens, (t) => t === 'reais' || t === 'real')
    if (spoken) {
      amount = spoken.value
      amountSpanText = spoken.span.join(' ')
      // centavos, ex: "... reais e cinquenta centavos"
      const centsIdx = tokens.findIndex((t) => t === 'centavos')
      if (centsIdx > 0) {
        const centsSpoken = findSpokenNumberNear(tokens, (t) => t === 'centavos')
        if (centsSpoken && centsSpoken.value < 100) {
          amount += centsSpoken.value / 100
        }
      }
    }
  }

  // --- Descrição: remove valor, parcelas e palavras de preenchimento ----
  let description = raw
  if (amountSpanText) description = description.replace(new RegExp(escapeRegExp(amountSpanText), 'i'), '')
  if (installmentsSpanText) description = description.replace(new RegExp(escapeRegExp(installmentsSpanText), 'i'), '')
  description = description
    .replace(/\breais?\b/gi, '')
    .replace(/\bcentavos?\b/gi, '')
    .replace(/\b(x|vezes|parcelas?|parcelad[oa])\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    // remove verbos/conectores comuns do início
    .replace(/^(gastei|paguei|comprei|foi|custou|de|em|no|na|com|e)\s+/i, '')
    .trim()

  if (!description) description = raw
  description = description.charAt(0).toUpperCase() + description.slice(1)

  // --- Categoria: nome de categoria mais longo que aparece na frase -----
  const matchedCategory = categories
    .filter((c) => lower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0]

  return {
    amount: amount ?? '',
    description,
    categoryId: matchedCategory?.id || '',
    installments,
  }
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
