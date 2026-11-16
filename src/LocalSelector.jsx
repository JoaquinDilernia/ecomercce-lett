import "./LocalSelector.css";

const LOCALES = [
  { id: "nordelta", name: "Nordelta",  icon: "🌊", color: "#3b82f6", bg: "#0f1f3d" },
  { id: "belgrano", name: "Belgrano", icon: "🏙️", color: "#8b5cf6", bg: "#1a0f3d" },
  { id: "lomas",    name: "Lomas",    icon: "🌳", color: "#10b981", bg: "#0a2d1e" },
];

function LocalSelector({ onSelect }) {
  return (
    <div className="ls-wrap">
      <div className="ls-top">
        <div className="ls-logo">PA</div>
        <h1 className="ls-title">Pick Alto</h1>
        <p className="ls-subtitle">¿Desde qué local estás trabajando?</p>
      </div>

      <div className="ls-cards">
        {LOCALES.map((loc) => (
          <button
            key={loc.id}
            className="ls-card"
            style={{ "--accent": loc.color, "--card-bg": loc.bg }}
            onClick={() => onSelect(loc.id)}
          >
            <span className="ls-card-icon">{loc.icon}</span>
            <span className="ls-card-name">{loc.name}</span>
            <span className="ls-card-arrow">→</span>
          </button>
        ))}
      </div>

      <p className="ls-footer">Podés cambiarlo desde la app en cualquier momento</p>
    </div>
  );
}

export { LOCALES };
export default LocalSelector;
