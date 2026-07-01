import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import './AdminPanel.css';

function AdminPanel() {
  const [products, setProducts] = useState([]);
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showCurrentData, setShowCurrentData] = useState(false);
  const [syncStatus, setSyncStatus]   = useState(null);   // null | 'loading' | 'success' | 'error'
  const [syncResult, setSyncResult]   = useState(null);
  const [lastSync,   setLastSync]     = useState(null);

  // Cargar productos actuales
  const loadProducts = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'pickalto_products'));
      const productsData = [];
      querySnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() });
      });
      setProducts(productsData);
      setMessage({ text: `${productsData.length} productos cargados`, type: 'success' });
    } catch (error) {
      console.error('Error loading products:', error);
      setMessage({ text: 'Error al cargar productos: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const url    = import.meta.env.VITE_SYNC_URL;
      const secret = import.meta.env.VITE_SYNC_SECRET;
      if (!url || !secret) return;
      const res  = await fetch(`${url}/api/status`, { headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json();
      if (data.ok && data.lastSync) setLastSync(data.lastSync);
    } catch (_) {}
  };

  const triggerSync = async () => {
    const url    = import.meta.env.VITE_SYNC_URL;
    const secret = import.meta.env.VITE_SYNC_SECRET;
    if (!url || !secret) {
      setMessage({ text: 'Sync no configurado (VITE_SYNC_URL / VITE_SYNC_SECRET faltantes)', type: 'error' });
      return;
    }
    setSyncStatus('loading');
    setSyncResult(null);
    try {
      const res  = await fetch(`${url}/api/sync`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
      const data = await res.json();
      if (data.ok) {
        setSyncStatus('success');
        setSyncResult(data);
        setMessage({ text: `Sync completado: ${data.synced} productos actualizados`, type: 'success' });
        await loadProducts();
        await loadSyncStatus();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      setSyncStatus('error');
      setMessage({ text: `Error en sync: ${err.message}`, type: 'error' });
    }
  };

  useEffect(() => {
    loadProducts();
    loadSyncStatus();
  }, []);

  // Eliminar todos los productos
  const deleteAllProducts = async () => {
    if (!window.confirm('¿Estás seguro de eliminar TODOS los productos? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setLoading(true);
      setMessage({ text: 'Eliminando productos...', type: 'info' });
      
      const querySnapshot = await getDocs(collection(db, 'pickalto_products'));
      const deletePromises = [];
      
      querySnapshot.forEach((document) => {
        deletePromises.push(deleteDoc(doc(db, 'pickalto_products', document.id)));
      });
      
      await Promise.all(deletePromises);
      setProducts([]);
      setMessage({ text: 'Todos los productos eliminados exitosamente', type: 'success' });
    } catch (error) {
      console.error('Error deleting products:', error);
      setMessage({ text: 'Error al eliminar productos: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Subir nuevo JSON
  const uploadJSON = async () => {
    try {
      setLoading(true);
      setMessage({ text: 'Procesando JSON...', type: 'info' });

      // Parsear el JSON
      const newProducts = JSON.parse(jsonInput);
      
      if (!Array.isArray(newProducts)) {
        throw new Error('El JSON debe ser un array de productos');
      }

      setMessage({ text: `Subiendo ${newProducts.length} productos...`, type: 'info' });

      // Subir productos en lotes para mejor performance
      const batchSize = 50;
      for (let i = 0; i < newProducts.length; i += batchSize) {
        const batch = newProducts.slice(i, i + batchSize);
        const uploadPromises = batch.map((product, index) => {
          // Usar el Name como ID único, o generar uno si no existe
          const productId = product.Name || `product_${i + index}`;
          return setDoc(doc(db, 'pickalto_products', productId), product);
        });
        
        await Promise.all(uploadPromises);
        setMessage({ 
          text: `Subidos ${Math.min(i + batchSize, newProducts.length)}/${newProducts.length} productos...`, 
          type: 'info' 
        });
      }

      setMessage({ text: `${newProducts.length} productos subidos exitosamente!`, type: 'success' });
      setJsonInput('');
      await loadProducts();
    } catch (error) {
      console.error('Error uploading JSON:', error);
      setMessage({ text: 'Error al subir JSON: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Actualizar productos (eliminar + subir)
  const updateProducts = async () => {
    if (!window.confirm('¿Actualizar productos? Esto eliminará los actuales y subirá los nuevos.')) {
      return;
    }

    await deleteAllProducts();
    if (jsonInput.trim()) {
      await uploadJSON();
    }
  };

  // Cargar desde archivo
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setJsonInput(event.target.result);
        setMessage({ text: 'Archivo cargado. Revisa el JSON y haz click en "Subir Nuevo JSON"', type: 'info' });
      };
      reader.readAsText(file);
      // Reset el input para poder cargar el mismo archivo nuevamente
      e.target.value = '';
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔧 Panel Admin - Pick Alto</h1>
        <div className="header-links">
          <a href="#/stats" className="back-link">📊 Estadísticas</a>
          <a href="#/" className="back-link">← Volver a la App</a>
        </div>
      </div>

      <div className="admin-container">
        {/* Mensaje de estado */}
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Estadísticas */}
        <div className="stats-card">
          <h2>📊 Productos en Firebase</h2>
          <div className="stats-number">{products.length}</div>
          <button 
            onClick={loadProducts} 
            disabled={loading}
            className="btn btn-secondary"
          >
            🔄 Recargar
          </button>
        </div>

        {/* Subir JSON */}
        <div className="card">
          <h2>📤 Subir / Actualizar Productos</h2>
          
          <div className="file-upload">
            <label className="file-label">
              📁 Cargar desde archivo JSON
              <input 
                type="file" 
                accept=".json"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </label>
          </div>

          <div className="or-divider">O pegar JSON directamente:</div>

          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='Pegar JSON aquí, ejemplo: [{"Name": "ALF001BN", "Precio": "$ 143.790,00", ...}, ...]'
            disabled={loading}
            rows={10}
          />

          <div className="button-group">
            <button 
              onClick={uploadJSON} 
              disabled={loading || !jsonInput.trim()}
              className="btn btn-primary"
            >
              ✅ Subir Nuevo JSON (Agregar)
            </button>
            <button 
              onClick={updateProducts} 
              disabled={loading || !jsonInput.trim()}
              className="btn btn-warning"
            >
              🔄 Actualizar (Eliminar + Subir)
            </button>
          </div>
        </div>

        {/* Ver datos actuales */}
        <div className="card">
          <h2>👁️ Datos Actuales</h2>
          <button 
            onClick={() => setShowCurrentData(!showCurrentData)}
            className="btn btn-secondary"
          >
            {showCurrentData ? '🙈 Ocultar' : '👀 Mostrar'} JSON actual ({products.length} productos)
          </button>

          {showCurrentData && (
            <div className="json-display">
              <pre>{JSON.stringify(products, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Sync desde Odoo */}
        <div className="card sync-card">
          <h2>🔄 Sincronizar desde Odoo</h2>
          {lastSync && (
            <p className="sync-last">
              Último sync:{' '}
              {lastSync.updatedAt?._seconds
                ? new Date(lastSync.updatedAt._seconds * 1000).toLocaleString('es-AR')
                : 'hace un momento'}
              {' — '}{lastSync.synced} productos
            </p>
          )}
          <button
            onClick={triggerSync}
            disabled={syncStatus === 'loading'}
            className="btn btn-sync"
          >
            {syncStatus === 'loading' ? '⏳ Sincronizando...' : '🔄 Sincronizar ahora'}
          </button>
          {syncResult && syncStatus === 'success' && (
            <div className="sync-result">
              <span>✅ {syncResult.synced} productos</span>
              <span>🗑️ {syncResult.deleted} eliminados</span>
              <span>⏱️ {(syncResult.durationMs / 1000).toFixed(1)}s</span>
            </div>
          )}
        </div>

        {/* Eliminar todo */}
        <div className="card danger-zone">
          <h2>⚠️ Zona de Peligro</h2>
          <p>Eliminar todos los productos de la base de datos</p>
          <button 
            onClick={deleteAllProducts} 
            disabled={loading || products.length === 0}
            className="btn btn-danger"
          >
            🗑️ Eliminar Todos los Productos
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Procesando...</p>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
