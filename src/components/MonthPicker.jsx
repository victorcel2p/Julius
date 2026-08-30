import { addMonths, formatMonthLabel } from '../lib/finance'

export default function MonthPicker({ month, onChange }) {
  return (
    <div className="month-picker">
      <button type="button" onClick={() => onChange(addMonths(month, -1))} aria-label="Mês anterior">
        ‹
      </button>
      <span>{formatMonthLabel(month)}</span>
      <button type="button" onClick={() => onChange(addMonths(month, 1))} aria-label="Próximo mês">
        ›
      </button>
    </div>
  )
}
