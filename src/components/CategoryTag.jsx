export default function CategoryTag({ name, color }) {
  return (
    <span className="category-tag" style={{ background: `${color}22`, color }}>
      <span className="category-dot" style={{ background: color }} />
      {name}
    </span>
  )
}
