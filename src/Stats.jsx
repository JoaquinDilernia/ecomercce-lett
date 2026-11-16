import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import './Stats.css';

const LOCALES = [
  { id: 'nordelta', name: 'Nordelta', color: '#3b82f6' },
  { id: 'belgrano', name: 'Belgrano', color: '#8b5cf6' },
  { id: 'lomas',    name: 'Lomas',    color: '#10b981' },
];

const LOCAL_NAMES = { nordelta: 'Nordelta', belgrano: 'Belgrano', lomas: 'Lomas', sin_local: 'Sin local' };

function Stats() {
  const [allSearches, setAllSearches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLocal, setSelectedLocal] = useState(''); // '' = todos

  // Load all data (filter date server-side, filter local client-side)
  const loadStats = async () => {
    try {
      setLoading(true);
      let q;

      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        q = query(
          collection(db, 'pickalto_searches'),
          where('timestamp', '>=', start),
          where('timestamp', '<=', end),
          orderBy('timestamp', 'desc')
        );
      } else {
        q = query(collection(db, 'pickalto_searches'), orderBy('timestamp', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      const data = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        data.push({ id: doc.id, ...d, timestamp: d.timestamp?.toDate() || new Date() });
      });

      setAllSearches(data);
    } catch (error) {
      console.error('Error loading stats:', error);
      alert('Error al cargar estadísticas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(lastMonth.toISOString().split('T')[0]);
  }, []);

  // Client-side filter by local
  const searches = useMemo(() => {
    if (!selectedLocal) return allSearches;
    return allSearches.filter((s) => s.local === selectedLocal);
  }, [allSearches, selectedLocal]);

  const totalSearches = searches.length;

  // Top products from filtered data
  const topProducts = useMemo(() => {
    const counts = {};
    searches.forEach((s) => {
      const key = s.productName;
      if (!counts[key]) {
        counts[key] = { name: s.productName, description: s.productDescription, count: 0, precio: s.precio, efecivo: s.efecivo };
      }
      counts[key].count++;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 20);
  }, [searches]);

  // Activity by hour of day (0–23)
  const hourCounts = useMemo(() => {
    const counts = new Array(24).fill(0);
    searches.forEach((s) => { counts[s.timestamp.getHours()]++; });
    return counts;
  }, [searches]);

  const maxHourCount = useMemo(() => Math.max(...hourCounts, 1), [hourCounts]);

  // Activity by day of week (0 = Dom … 6 = Sáb)
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayOfWeekCounts = useMemo(() => {
    const counts = new Array(7).fill(0);
    searches.forEach((s) => { counts[s.timestamp.getDay()]++; });
    return counts;
  }, [searches]);

  const maxDayCount = useMemo(() => Math.max(...dayOfWeekCounts, 1), [dayOfWeekCounts]);

  // Breakdown by local (computed from allSearches for the "Todos" view)
  const localCounts = useMemo(() => {
    const counts = {};
    allSearches.forEach((s) => {
      const key = s.local || 'sin_local';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [allSearches]);

  const clearFilter = () => { setStartDate(''); setEndDate(''); };

  return (
    <div className="stats-panel">
      <div className="stats-header">
        <h1>Estadísticas · Pick Alto</h1>
        <div className="header-links">
          <a href="#/admin" className="back-link">Admin</a>
          <a href="#/" className="back-link">← Pick</a>
        </div>
      </div>

      <div className="stats-container">

        {/* ── Filtro por local ── */}
        <div className="card">
          <h2>Filtrar por local</h2>
          <div className="local-tabs">
            <button
              className={`local-tab ${selectedLocal === '' ? 'active' : ''}`}
              onClick={() => setSelectedLocal('')}
            >
              Todos
            </button>
            {LOCALES.map((loc) => (
              <button
                key={loc.id}
                className={`local-tab ${selectedLocal === loc.id ? 'active' : ''}`}
                style={{ '--tab-color': loc.color }}
                onClick={() => setSelectedLocal(loc.id)}
              >
                {loc.name}
                {localCounts[loc.id] ? (
                  <span className="tab-count">{localCounts[loc.id]}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* ── Filtro por fecha ── */}
        <div className="card">
          <h2>Filtrar por fecha</h2>
          <div className="date-filters">
            <div className="date-input-group">
              <label>Desde:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={loading} />
            </div>
            <div className="date-input-group">
              <label>Hasta:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={loading} />
            </div>
            <button onClick={loadStats} disabled={loading} className="btn btn-primary">Filtrar</button>
            <button onClick={clearFilter} disabled={loading} className="btn btn-secondary">Limpiar</button>
          </div>
        </div>

        {/* ── Resumen general ── */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon">🔍</div>
            <div className="summary-content">
              <div className="summary-number">{totalSearches}</div>
              <div className="summary-label">
                Búsquedas {selectedLocal ? `· ${LOCAL_NAMES[selectedLocal]}` : 'Totales'}
              </div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">🏆</div>
            <div className="summary-content">
              <div className="summary-number">{topProducts.length}</div>
              <div className="summary-label">Productos Únicos</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon">📈</div>
            <div className="summary-content">
              <div className="summary-number">{topProducts.length > 0 ? topProducts[0].count : 0}</div>
              <div className="summary-label">Máx. Búsquedas</div>
            </div>
          </div>
        </div>

        {/* ── Desglose por local (solo en vista "Todos") ── */}
        {!selectedLocal && allSearches.length > 0 && (
          <div className="card">
            <h2>Búsquedas por local</h2>
            <div className="local-breakdown">
              {LOCALES.map((loc) => {
                const count = localCounts[loc.id] || 0;
                const pct = allSearches.length > 0 ? ((count / allSearches.length) * 100).toFixed(0) : 0;
                return (
                  <div key={loc.id} className="breakdown-row" onClick={() => setSelectedLocal(loc.id)}>
                    <div className="breakdown-info">
                      <span className="breakdown-name">{loc.name}</span>
                      <span className="breakdown-count">{count} búsquedas</span>
                    </div>
                    <div className="breakdown-bar-wrap">
                      <div
                        className="breakdown-bar"
                        style={{ width: `${pct}%`, background: loc.color }}
                      />
                    </div>
                    <span className="breakdown-pct">{pct}%</span>
                  </div>
                );
              })}
              {localCounts['sin_local'] > 0 && (
                <div className="breakdown-row">
                  <div className="breakdown-info">
                    <span className="breakdown-name" style={{ color: '#9ca3af' }}>Sin local asignado</span>
                    <span className="breakdown-count">{localCounts['sin_local']} búsquedas</span>
                  </div>
                  <div className="breakdown-bar-wrap">
                    <div
                      className="breakdown-bar"
                      style={{ width: `${((localCounts['sin_local'] / allSearches.length) * 100).toFixed(0)}%`, background: '#4b5563' }}
                    />
                  </div>
                  <span className="breakdown-pct">
                    {((localCounts['sin_local'] / allSearches.length) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Actividad por hora ── */}
        {searches.length > 0 && (
          <div className="card">
            <h2>Actividad por hora del día</h2>
            <div className="hour-chart">
              {hourCounts.map((count, hour) => (
                <div key={hour} className="hour-bar-col">
                  <div className="hour-bar-wrap">
                    <div
                      className={`hour-bar${count === maxHourCount && count > 0 ? ' is-peak' : ''}`}
                      style={{ height: `${(count / maxHourCount) * 100}%` }}
                      title={`${String(hour).padStart(2,'0')}:00 — ${count} búsquedas`}
                    />
                  </div>
                  <span className="hour-label">
                    {hour % 6 === 0 ? String(hour).padStart(2, '0') : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Actividad por día de semana ── */}
        {searches.length > 0 && (
          <div className="card">
            <h2>Actividad por día de la semana</h2>
            <div className="day-chart">
              {dayOfWeekCounts.map((count, day) => (
                <div key={day} className="day-bar-col">
                  <span className="day-count">{count > 0 ? count : ''}</span>
                  <div className="day-bar-wrap">
                    <div
                      className={`day-bar${count === maxDayCount && count > 0 ? ' is-peak' : ''}`}
                      style={{ height: `${(count / maxDayCount) * 100}%` }}
                    />
                  </div>
                  <span className="day-label">{DAY_NAMES[day]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Top Productos ── */}
        <div className="card">
          <h2>Top 20 · Más buscados</h2>
          {loading ? (
            <div className="loading-center"><div className="spinner" /><p>Cargando estadísticas...</p></div>
          ) : topProducts.length === 0 ? (
            <div className="empty-state"><p>No hay búsquedas registradas en el período seleccionado</p></div>
          ) : (
            <div className="products-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>SKU</th>
                    <th>Descripción</th>
                    <th>Precio</th>
                    <th>Efectivo</th>
                    <th>Búsquedas</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((product, index) => (
                    <tr key={product.name}>
                      <td className="rank">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `${index + 1}`}
                      </td>
                      <td className="sku">{product.name}</td>
                      <td className="description">{product.description}</td>
                      <td className="price">{product.precio}</td>
                      <td className="price-cash">{product.efecivo}</td>
                      <td className="count">{product.count}</td>
                      <td className="percentage">{((product.count / totalSearches) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Historial reciente ── */}
        <div className="card">
          <h2>Historial reciente</h2>
          {searches.length === 0 ? (
            <div className="empty-state"><p>No hay búsquedas registradas</p></div>
          ) : (
            <div className="searches-list">
              {searches.slice(0, 50).map((search) => (
                <div key={search.id} className="search-item">
                  <div className="search-product">
                    <strong>{search.productName}</strong>
                    <span className="search-desc">{search.productDescription}</span>
                  </div>
                  <div className="search-item-right">
                    {search.local && search.local !== 'sin_local' && (
                      <span className="search-local-badge"
                        style={{ '--badge-color': LOCALES.find(l => l.id === search.local)?.color || '#9ca3af' }}
                      >
                        {LOCAL_NAMES[search.local] || search.local}
                      </span>
                    )}
                    <div className="search-time">
                      {search.timestamp.toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Stats;
