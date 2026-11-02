export function Avatar({ name, photo, large = false }: { name: string; photo?: string; large?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?"
  return (
    <span className={`avatar ${large ? "large" : ""}`} style={photo ? { background: `center / cover url(${photo})` } : undefined}>
      {!photo && initials}
    </span>
  )
}
