import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import "./App.css";
import NoSleep from "nosleep.js";
import Loading from "./Loading";
import ProductCard from "./ProductCard";
import LocalSelector, { LOCALES } from './LocalSelector';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';

const LOCAL_NAMES = Object.fromEntries(LOCALES.map((l) => [l.id, l.name]));

function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState(""); // Aseguramos que siempre sea string
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [cant, setCant] = useState(5);
  const [isInputLocked, setIsInputLocked] = useState(false);
  const inputRef = useRef(null);

  // Local selection (persisted in localStorage)
  const [local, setLocal] = useState(() => localStorage.getItem('pickalto_local') || '');

  const handleSelectLocal = useCallback((selectedLocal) => {
    localStorage.setItem('pickalto_local', selectedLocal);
    setLocal(selectedLocal);
  }, []);

  const handleChangeLocal = useCallback(() => {
    localStorage.removeItem('pickalto_local');
    setLocal('');
  }, []);

  // Configuración de NoSleep
  const noSleep = useMemo(() => new NoSleep(), []);

  const enableNoSleep = useCallback(() => {
    noSleep.enable();
    document.removeEventListener("touchstart", enableNoSleep, false);
  }, [noSleep]);

  useEffect(() => {
    document.addEventListener("touchstart", enableNoSleep, false);
    return () => {
      document.removeEventListener("touchstart", enableNoSleep, false);
    };
  }, [enableNoSleep]);

  // Cargar productos desde Firebase
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const querySnapshot = await getDocs(collection(db, 'pickalto_products'));
        const productsData = [];
        
        querySnapshot.forEach((doc) => {
          productsData.push(doc.data());
        });
        
        setProducts(productsData);
        setError(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError(true);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Búsqueda instantánea - sin debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Validar formato de SKU: 3 letras + 3 números + 2 letras (ej: IME005BL)
  const isValidSKU = useCallback((sku) => {
    if (!sku || sku.length !== 8) return false;
    const skuPattern = /^[A-Z]{3}\d{3}[A-Z]{2}$/i;
    return skuPattern.test(sku);
  }, []);

  // Filtrado ultra-rápido para mejor performance
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch || debouncedSearch.length !== 8) {
      return products;
    }

    const searchUpper = debouncedSearch.toUpperCase();
    const results = [];
    
    // Primera pasada: búsqueda exacta en Name (más rápida)
    for (let i = 0; i < products.length && results.length < 20; i++) {
      const product = products[i];
      if (product.Name?.toUpperCase() === searchUpper) {
        results.push(product);
      }
    }
    
    return results;
  }, [debouncedSearch, products]);

  // Actualizar error state cuando cambie la búsqueda debounced
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.length === 8) {
      setError(filteredProducts.length === 0);
      if (filteredProducts.length > 0) {
        setIsInputLocked(true); // Bloquear si encontramos productos
        
        // Registrar búsqueda exitosa en Firebase
        const logSearch = async () => {
          try {
            const productFound = filteredProducts[0];
            await addDoc(collection(db, 'pickalto_searches'), {
              productName: productFound.Name,
              productDescription: productFound.Description || productFound.MODELO || '',
              searchTerm: debouncedSearch,
              timestamp: new Date(),
              precio: productFound.Precio || '',
              efecivo: productFound.Efecivo || '',
              local: local || 'sin_local'
            });
          } catch (error) {
            console.error('Error logging search:', error);
            // No mostramos error al usuario, es un log silencioso
          }
        };
        logSearch();
      }
    } else {
      setError(false);
    }
  }, [debouncedSearch, filteredProducts]);

  const handleSearch = useCallback((e) => {
    const newValue = e.target.value || "";
    
    // Si el input está bloqueado, no permitir cambios
    if (isInputLocked) {
      return;
    }
    
    // ACTUALIZACIÓN INMEDIATA DEL INPUT
    setSearch(newValue);
    
    // BÚSQUEDA INSTANTÁNEA solo si es un SKU válido
    if (newValue.length === 8 && isValidSKU(newValue)) {
      setDebouncedSearch(newValue);
      setIsSearching(false);
      setIsInputLocked(true); // BLOQUEAR INPUT cuando se encuentra un producto
    } else if (newValue.length < 8) {
      setDebouncedSearch("");
      setIsSearching(false);
      setIsInputLocked(false);
    }
  }, [isInputLocked, isValidSKU]);

  // Manejar paste para búsqueda inmediata
  const handlePaste = useCallback((e) => {
    // El handleSearch ya maneja la búsqueda instantánea
  }, []);

  // Manejar Enter (común en lectores de códigos de barras)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && search.length >= 8) {
      e.preventDefault();
      setDebouncedSearch(search);
      setIsSearching(false);
    }
  }, [search]);

  // Contador para reset automático
  useEffect(() => {
    if (search.length < 8) {
      setCant(5);
      setIsInputLocked(false); // Desbloquear cuando se limpia
      // Mantener foco en el input después de limpiar
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    const interval = setInterval(() => {
      setCant(prev => {
        if (prev <= 1) {
          setSearch("");
          setError(false);
          setIsInputLocked(false); // Desbloquear al resetear
          // Devolver foco al input después del reset
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          }, 100);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [search.length, products]);

  // Componente de error mejorado
  const ErrorMessage = ({ message, description }) => (
    <div className="error-message fade-in">
      <div className="error-icon">⚠</div>
      <h3 className="error-text">{message}</h3>
      <p className="error-description">{description}</p>
    </div>
  );

  // Mostrar selector de local si no hay local elegido
  if (!local) {
    return <LocalSelector onSelect={handleSelectLocal} />;
  }

  // Estado de carga inicial
  if (isLoading) {
    return (
      <div className="App">
        <div className="search">
          <input
            type="text"
            placeholder="Cargando productos..."
            disabled
          />
        </div>
        <div className="inicio">
          <h1>Cargando catálogo...</h1>
          <Loading message="Conectando con el servidor..." />
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="search">
        <input
          ref={inputRef}
          type="text"
          placeholder={isInputLocked ? "⏳ Esperando reset automático..." : "Escanea el código del producto (8 caracteres)"}
          value={search || ""} // Aseguramos que nunca sea undefined/null
          onChange={handleSearch}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={isInputLocked}
          className={isInputLocked ? "input-locked" : ""}
          autoFocus
        />
      </div>

      {/* Indicador de local activo */}
      <div className="local-chip-bar">
        <span className="local-chip">
          📍 {LOCAL_NAMES[local] || local}
        </span>
        <button className="local-chip-change" onClick={handleChangeLocal}>
          cambiar local
        </button>
      </div>

      {search.length < 8 ? (
        <div className="inicio">
          {/* Barcode icon */}
          <svg width="64" height="40" viewBox="0 0 64 40" fill="none" aria-hidden="true">
            {[0,5,9,13,18,22,27,31,36,40,45,49,54,58].map((x, i) => (
              <rect key={i} x={x} y="0" width={i % 3 === 0 ? 4 : 2} height="40"
                rx="1" fill="#d1d5db" />
            ))}
          </svg>
          <h1>Listo para escanear</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
            Apuntá el lector al código del producto<br/>
            (SKU de 8 caracteres · ej: IME005BL)
          </p>
        </div>
      ) : (
        <div className="products-contenedor">
          <p className="segundo">
            {isInputLocked ? (
              <>🔒 Input bloqueado - Reset automático en: <span>{cant}s</span></>
            ) : (
              <>Búsqueda activa - Reset automático en: <span>{cant}s</span></>
            )}
          </p>

          {error ? (
            <ErrorMessage 
              message="Producto no encontrado" 
              description="El código escaneado no existe en el sistema. Verifica que sea correcto (8 caracteres: 3 letras + 3 números + 2 letras)."
            />
          ) : isSearching && filteredProducts.length === 0 ? (
            <div className="searching-indicator">
              <Loading message="Buscando productos..." />
            </div>
          ) : (
            filteredProducts.map((product, index) => (
              <ProductCard 
                key={product.Name ? `${product.Name}-${index}` : `product-${index}`} 
                product={product} 
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App;
