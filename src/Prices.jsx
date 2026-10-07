import { useState, useEffect, useCallback, useRef } from "react";
import { useZxing } from "react-zxing";
import "./Prices.css";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { getPrices, pctLabel, DESC_EFECTIVO, DESC_TRANSFERENCIA } from "./pricing";

const CACHE_KEY = "pickalto_prices_cache";
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 horas

// BarcodeDetector: API nativa del browser (Chrome Android/Edge)
// Mucho más rápida que ZXing porque corre en la capa del sistema
const hasBarcodeDetector =
  typeof window !== "undefined" && "BarcodeDetector" in window;

function Prices() {
  const [products, setProducts] = useState([]);
  const [foundProduct, setFoundProduct] = useState(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [cant, setCant] = useState(8);
  const [mode, setMode] = useState("camera"); // "camera" | "manual"
  const [manualInput, setManualInput] = useState("");
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null); // usado por BarcodeDetector
  const manualRef = useRef(null);
  const lastScanRef = useRef("");
  const debounceRef = useRef(null);

  // ── Cache + carga de Firebase ────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL) {
            setProducts(data);
            setIsLoading(false);
            return;
          }
        }
      } catch (_) {}
      try {
        const snap = await getDocs(collection(db, "pickalto_products"));
        const data = [];
        snap.forEach((doc) => data.push(doc.data()));
        setProducts(data);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
        } catch (_) {}
      } catch (err) {
        console.error("Error cargando productos:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, []);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // ── Búsqueda del producto ────────────────────────────────
  const processBarcode = useCallback(
    (raw) => {
      if (isLocked || !raw) return;
      const cleaned = raw.trim().toUpperCase();
      const match = cleaned.match(/[A-Z]{3}\d{3}[A-Z]{2}/);
      const sku = match ? match[0] : cleaned;
      if (sku === lastScanRef.current) return;
      lastScanRef.current = sku;
      const product = products.find((p) => p.Name?.toUpperCase() === sku);
      if (product) {
        setFoundProduct(product);
        setError(false);
      } else {
        setFoundProduct(null);
        setError(true);
      }
      setIsLocked(true);
    },
    [isLocked, products]
  );

  // ── BarcodeDetector (API nativa — Chrome/Edge/Android) ───
  // Escanea cada frame en tiempo real, sin delay artificial
  useEffect(() => {
    if (!hasBarcodeDetector) return;
    if (mode !== "camera" || isLocked || isLoading) return;

    let stream = null;
    let animFrame = null;

    const start = async () => {
      // Iniciar stream de cámara
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        setCameraError("No se pudo acceder a la cámara");
        setMode("manual");
        return;
      }

      // Iniciar detector nativo
      const detector = new window.BarcodeDetector({
        formats: [
          "code_128", "ean_13", "ean_8",
          "code_39",  "upc_a",  "upc_e",
          "qr_code",  "itf",
        ],
      });

      // Loop de escaneo — cada frame del video
      const scan = async () => {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          try {
            const results = await detector.detect(video);
            if (results.length > 0) {
              processBarcode(results[0].rawValue);
              return; // para el loop; el effect se limpiará solo
            }
          } catch (_) {}
        }
        animFrame = requestAnimationFrame(scan);
      };

      animFrame = requestAnimationFrame(scan);
    };

    start();

    return () => {
      cancelAnimationFrame(animFrame);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [hasBarcodeDetector, mode, isLocked, isLoading, processBarcode]);

  // ── ZXing fallback (Safari / Firefox / iOS) ──────────────
  const { ref: zxingRef } = useZxing({
    paused: hasBarcodeDetector || mode !== "camera" || isLocked || isLoading,
    onDecodeResult(result) {
      const text = result.getText();
      if (text) processBarcode(text);
    },
    onError(err) {
      if (
        ["NotAllowedError", "NotFoundError", "OverconstrainedError"].includes(
          err?.name
        )
      ) {
        setCameraError("No se pudo acceder a la cámara");
        setMode("manual");
      }
    },
    constraints: { video: { facingMode: "environment" } },
    timeBetweenDecodingAttempts: 200,
  });

  // ── Input manual (scanner físico) ────────────────────────
  const handleManualChange = useCallback(
    (e) => {
      const val = e.target.value;
      setManualInput(val);
      if (!val.trim()) return;
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        processBarcode(val);
        setManualInput("");
      }, 120);
    },
    [processBarcode]
  );

  const handleManualKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && manualInput.trim()) {
        clearTimeout(debounceRef.current);
        processBarcode(manualInput);
        setManualInput("");
      }
    },
    [processBarcode, manualInput]
  );

  // ── Countdown y reset automático ─────────────────────────
  useEffect(() => {
    if (!isLocked) {
      setCant(8);
      lastScanRef.current = "";
      if (mode === "manual") setTimeout(() => manualRef.current?.focus(), 80);
      return;
    }
    const interval = setInterval(() => {
      setCant((prev) => {
        if (prev <= 1) {
          setFoundProduct(null);
          setError(false);
          setIsLocked(false);
          setManualInput("");
          return 8;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, mode]);

  useEffect(() => {
    if (mode === "manual") setTimeout(() => manualRef.current?.focus(), 150);
  }, [mode]);

  const reset = useCallback(() => {
    setFoundProduct(null);
    setError(false);
    setIsLocked(false);
    setManualInput("");
    lastScanRef.current = "";
    setCant(8);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === "camera" ? "manual" : "camera"));
    reset();
  }, [reset]);

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="prices-app">
        <div className="prices-loading">
          <div className="loading-spinner" />
          <p>Cargando catálogo…</p>
        </div>
      </div>
    );
  }

  const showResult = (foundProduct || error) && isLocked;
  const prices = foundProduct ? getPrices(foundProduct) : null;

  return (
    <div className="prices-app">

      {/* Input oculto para scanner físico */}
      {mode === "manual" && (
        <input
          ref={manualRef}
          className="prices-hidden-input"
          value={manualInput}
          onChange={handleManualChange}
          onKeyDown={handleManualKeyDown}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      )}

      {/* Cámara */}
      {mode === "camera" && (
        <div className="scanner-wrap">
          {/* Un solo video: controlado por BarcodeDetector o por ZXing según el browser */}
          <video
            ref={hasBarcodeDetector ? videoRef : zxingRef}
            className="scanner-video"
            playsInline
            muted
          />
          <div className="scanner-overlay">
            <div className="scanner-frame">
              <span className="corner tl" />
              <span className="corner tr" />
              <span className="corner bl" />
              <span className="corner br" />
              {!isLocked && <div className="scan-line" />}
              {isLocked && <div className="scan-locked" />}
            </div>
          </div>
          {!showResult && (
            <div className="scanner-hint">
              <p>Enfocá el código de barras del producto</p>
            </div>
          )}
        </div>
      )}

      {/* Idle modo manual */}
      {mode === "manual" && !showResult && (
        <div className="manual-idle" onClick={() => manualRef.current?.focus()}>
          <div className="manual-icon-wrap">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4"  y="8" width="4" height="32" rx="2" fill="currentColor" opacity="0.6" />
              <rect x="10" y="8" width="2" height="32" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="14" y="8" width="6" height="32" rx="2" fill="currentColor" opacity="0.5" />
              <rect x="22" y="8" width="3" height="32" rx="1" fill="currentColor" opacity="0.8" />
              <rect x="27" y="8" width="5" height="32" rx="2" fill="currentColor" opacity="0.6" />
              <rect x="34" y="8" width="2" height="32" rx="1" fill="currentColor" opacity="0.9" />
              <rect x="38" y="8" width="6" height="32" rx="2" fill="currentColor" opacity="0.55" />
            </svg>
          </div>
          <p className="manual-title">Esperando scanner</p>
          <p className="manual-hint">Apuntá el lector al código de barras del producto</p>
          <p className="manual-tap">Tocá aquí si el cursor perdió el foco</p>
        </div>
      )}

      {/* Header */}
      <div className="prices-header">
        <div className="header-left">
          <h1 className="header-title">Precios</h1>
          {isLocked && <span className="header-countdown">{cant}s</span>}
        </div>
        <div className="header-right">
          {isLocked && (
            <button className="btn-reset" onClick={reset}>Nuevo scan</button>
          )}
          <button className="btn-toggle" onClick={toggleMode}>
            {mode === "camera" ? "⌨️" : "📷"}
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="camera-error-banner">
          {cameraError} — usando modo manual
        </div>
      )}

      {/* Sheet de error */}
      {error && isLocked && (
        <div className="result-sheet error-sheet">
          <div className="sheet-handle" />
          <div className="error-body">
            <div className="error-circle">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <line x1="8" y1="8" x2="24" y2="24" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                <line x1="24" y1="8" x2="8" y2="24" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="error-title">Producto no encontrado</p>
            <p className="error-hint">El código escaneado no está en el sistema</p>
            <button className="btn-retry" onClick={reset}>Intentar de nuevo</button>
          </div>
        </div>
      )}

      {/* Sheet de resultado */}
      {foundProduct && isLocked && (
        <div className="result-sheet">
          <div className="sheet-handle" />

          <div className="result-product-row">
            {foundProduct.img && (
              <img
                src={foundProduct.img}
                alt={foundProduct.Name}
                className="result-img"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            )}
            <div className="result-product-info">
              {foundProduct.Hot === "SI" && (
                <span className="hot-badge">🔥 OFERTA</span>
              )}
              <p className="result-desc">
                {foundProduct.Description || foundProduct.MODELO || "Sin descripción"}
              </p>
              <span className="result-sku-chip">{foundProduct.Name}</span>
            </div>
          </div>

          <div className="prices-grid">
            {prices.hasOferta ? (
              <>
                <div className="price-card card-before">
                  <span className="pc-label">Precio lista</span>
                  <span className="pc-value pc-strike">{prices.lista}</span>
                  <span className="pc-badge">{prices.porcentajeOferta} OFF</span>
                </div>
                <div className="price-card card-offer">
                  <span className="pc-label">Precio oferta</span>
                  <span className="pc-value pc-blue">{prices.oferta}</span>
                </div>
              </>
            ) : (
              <div className="price-card card-offer full-width">
                <span className="pc-label">Precio</span>
                <span className="pc-value pc-blue">{prices.lista || "Consultar"}</span>
              </div>
            )}

            <div className="price-card card-cash">
              <span className="pc-label">Efectivo · {pctLabel(DESC_EFECTIVO)} off</span>
              <span className="pc-value pc-orange">{prices.efectivo || "Consultar"}</span>
            </div>
            <div className="price-card card-transfer">
              <span className="pc-label">Transferencia · {pctLabel(DESC_TRANSFERENCIA)} off</span>
              <span className="pc-value pc-green">{prices.transferencia || "Consultar"}</span>
            </div>
          </div>

          <div className="result-perks">
            <span className="perk">✓ 3 cuotas sin interés</span>
            <span className="perk-dot">·</span>
            <span className="perk">✓ {pctLabel(DESC_EFECTIVO)} off efectivo</span>
            <span className="perk-dot">·</span>
            <span className="perk">✓ {pctLabel(DESC_TRANSFERENCIA)} off transferencia</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Prices;
