import { useState, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { parseVoiceTranscript, formatCurrency, todayISO, PAYMENT_METHODS } from '../lib/finance'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

const getEmptyForm = () => ({ description: '', amount: '', category_id: '', installments: '1', payment_method: '' })

export default function VoiceExpenseModal({ open, onClose, onSaved, categories, householdId, userId }) {
  const [status, setStatus] = useState('idle') // idle | listening | review | saving | error
  const [transcript, setTranscript] = useState('')
  const [form, setForm] = useState(getEmptyForm)
  const [errorMsg, setErrorMsg] = useState('')
  const recognitionRef = useRef(null)

  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const startListening = useCallback(() => {
    setErrorMsg('')
    if (!SpeechRecognitionAPI) {
      setStatus('error')
      setErrorMsg(
        'Seu navegador não tem suporte a reconhecimento de voz. No celular ou computador, tente abrir o app no Google Chrome.'
      )
      return
    }
    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'pt-BR'
    recognition.interimResults = false
    recognition.maxAlternatives = 3

    recognition.onstart = () => setStatus('listening')

    recognition.onresult = (event) => {
      // usa a alternativa com maior confiança entre as retornadas
      const alternatives = Array.from(event.results[0])
      const best = alternatives.reduce((a, b) => ((b.confidence || 0) > (a.confidence || 0) ? b : a))
      const text = best.transcript
      setTranscript(text)
      const parsed = parseVoiceTranscript(text, expenseCategories)
      setForm({
        description: parsed.description,
        amount: parsed.amount === '' ? '' : String(parsed.amount),
        category_id: parsed.categoryId,
        installments: String(parsed.installments || 1),
        payment_method: '',
      })
      setStatus('review')
    }

    recognition.onerror = (event) => {
      setStatus('error')
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setErrorMsg('Permita o acesso ao microfone nas configurações do navegador e tente de novo.')
      } else if (event.error === 'no-speech') {
        setErrorMsg('Não consegui te ouvir. Tente falar novamente, mais perto do microfone.')
      } else {
        setErrorMsg('Não consegui entender. Tente de novo ou preencha manualmente.')
      }
    }

    recognition.onend = () => {
      setStatus((s) => (s === 'listening' ? 'idle' : s))
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [expenseCategories])

  const isInstallment = Number(form.installments) > 1
  const missing = () =>
    ['description', 'amount', 'category_id', 'payment_method'].filter((f) => !form[f])

  const handleConfirm = async () => {
    const missingFields = missing()
    if (missingFields.length > 0) {
      setErrorMsg('Preencha descrição, valor, categoria e forma de pagamento antes de confirmar.')
      return
    }
    setStatus('saving')

    if (isInstallment) {
      const { error } = await supabase.from('installments').insert({
        description: form.description,
        total_amount: Number(form.amount),
        installments_count: parseInt(form.installments, 10),
        first_date: todayISO(),
        category_id: form.category_id,
        payment_method: form.payment_method,
        household_id: householdId,
      })
      if (error) {
        setStatus('review')
        setErrorMsg(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('transactions').insert({
        description: form.description,
        amount: Number(form.amount),
        type: 'expense',
        category_id: form.category_id,
        payment_method: form.payment_method,
        date: todayISO(),
        household_id: householdId,
        user_id: userId,
      })
      if (error) {
        setStatus('review')
        setErrorMsg(error.message)
        return
      }
    }
    handleClose()
    onSaved?.()
  }

  const handleClose = () => {
    recognitionRef.current?.stop()
    setStatus('idle')
    setTranscript('')
    setForm(getEmptyForm())
    setErrorMsg('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Registrar despesa por voz</h2>
          <button className="icon-btn" onClick={handleClose} type="button" aria-label="Fechar">
            ✕
          </button>
        </div>

        {status === 'idle' && (
          <div className="voice-stage">
            <p className="voice-hint">
              Diga o valor e o que foi. Se for parcelado, fale o número de vezes — ex:{' '}
              <em>"celular mil e duzentos reais em dez vezes"</em> ou <em>"cinquenta reais no mercado"</em>
            </p>
            <button className="mic-btn" onClick={startListening} type="button">
              🎙
            </button>
          </div>
        )}

        {status === 'listening' && (
          <div className="voice-stage">
            <p className="voice-hint">Ouvindo… pode falar</p>
            <button className="mic-btn listening" onClick={() => recognitionRef.current?.stop()} type="button">
              🎙
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="voice-stage">
            <div className="error-text">{errorMsg}</div>
            <button className="btn btn-primary" onClick={startListening} type="button" style={{ width: 'auto' }}>
              Tentar de novo
            </button>
          </div>
        )}

        {(status === 'review' || status === 'saving') && (
          <div>
            <div className="voice-transcript">"{transcript}"</div>
            <p className="voice-hint">
              {isInstallment ? 'Entendi como uma compra parcelada. Confira antes de salvar:' : 'Confira antes de salvar:'}
            </p>

            <div className="field">
              <label>Descrição *</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="field">
              <label>{isInstallment ? 'Valor total (R$) *' : 'Valor (R$) *'}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Nº de parcelas</label>
              <input
                type="number"
                min="1"
                value={form.installments}
                onChange={(e) => setForm({ ...form, installments: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Categoria *</label>
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Selecione…</option>
                {expenseCategories.map((c) => (
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

            {isInstallment && form.amount && (
              <p className="voice-hint" style={{ marginBottom: 8 }}>
                {form.installments}x de {formatCurrency(Number(form.amount) / Number(form.installments))}
              </p>
            )}

            {errorMsg && <div className="error-text">{errorMsg}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleConfirm} type="button" disabled={status === 'saving'} style={{ width: 'auto' }}>
                {status === 'saving'
                  ? 'Salvando…'
                  : `Confirmar ${form.amount ? formatCurrency(form.amount) : ''}`}
              </button>
              <button className="btn btn-ghost" onClick={startListening} type="button" disabled={status === 'saving'}>
                Falar de novo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
