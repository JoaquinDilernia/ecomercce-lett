import { useState, useEffect } from "react";
import "./App.css";
import NoSleep from "nosleep.js";
import Loading from "./Loading";

function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("https://apimocha.com/apilett/posts")
      .then((response) => response.json())
      .then((data) => {
        setProducts(data);
        setFilteredProducts(data);
      });
  }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    // esperar a que se ingresen 8 caracteres para buscar
    if (e.target.value.length >= 8 && e.target.value.length <= 10) {
      const filteredProducts = products.filter((product) => {
        return product.Name.toLowerCase().includes(
          e.target.value.toLowerCase()
        );
      });
      if (filteredProducts.length === 0) {
        setError(true);
      } else {
        setError(false);
      }
      setFilteredProducts(filteredProducts);
    } else {
      setFilteredProducts(products);
    }
  };

  var noSleep = new NoSleep();

  function enableNoSleep() {
    noSleep.enable();
    document.removeEventListener("touchstart", enableNoSleep, false);
  }

  // Habilitar el seguro para no bloquear la pantalla
  document.addEventListener("touchstart", enableNoSleep, false);


  // funcion para cuenta regresiva de 5 segundos para volver a buscar producto, cuando termine se reinicia el contador


  const [cant, setCant] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCant(cant - 1);
    }, 1500);

    if (cant === 0) {
      setCant(5);
      setSearch("");
      setFilteredProducts(products);
    }
    return () => clearInterval(interval);
  });

  return (
    <>
      <div className="App">
        <div className="search">
          <input
            type="text"
            placeholder="Buscar producto"
            value={search}
            onChange={handleSearch}
          />
        </div>

        {search.length < 8 ? (
          <div className="inicio">
            <h1>Busca tu producto</h1>
            <p>Ingresa el código de tu producto</p>

            <Loading />
          </div>
        ) : (
          <div className="products-contenedor">
            <p className="segundo">
              Espere unos segundos para volver a buscar: <span>{cant}s</span>
            </p>

            {filteredProducts.map((product, key) => {
              return (
                <div className="product-card" key={key}>
                  <div className="product-header">
                    {product.Descuento === "SI" ? (
                      <div className="porcentaje">
                        <p>{product.Porcentaje}</p>
                      </div>
                    ) : null}
                    <h5>{product.Description}</h5>
                  </div>
                  <div className="product-body">
                    <div className="product-img">
                      <img src={product.img} alt="" />
                    </div>
                    <div className="product-cont-desc">
                      <div className="cont-precios">
                        {product.Descuento === "SI" ? (
                          <p className="Precio-lista-tachado">
                            ANTES <span>{product.Precio}</span>
                          </p>
                        ) : (
                          <p className="Precio-lista">
                            Precio Lista: <span>{product.Precio}</span>
                          </p>
                        )}
                        {product.Descuento === "SI" ? (
                          <p className="Precio-descuento">
                            <span className="fuego">🔥</span> SALE:{" "}
                            <span>{product.Pdesceunto}</span>
                          </p>
                        ) : null}
                      </div>
                      <p className="Precio-efectivo">
                        EFECTIVO: <span>{product.Efecivo}</span>
                      </p>
                    </div>
                  </div>
                  <div className="product-footer-medidas">
                    <div className="medidas-cont">
                      <p className="medidas">
                        ALTO CM: <span>{product.Alto}</span>
                      </p>
                      <p className="medidas">
                        ANCHO CM: <span>{product.Ancho}</span>
                      </p>
                      <p className="medidas">
                        PROFUNDIDAD CM: <span>{product.Porfundidad}</span>
                      </p>
                      <p className="medidas">
                        DIAMETRO CM: <span>{product.Diametro}</span>
                      </p>
                      <p className="medidas">
                        PESO KG: <span>{product.Peso}</span>
                      </p>
                    </div>
                  </div>

                  <div className="product-footer-info">
                    <p className="info">
                      3 cuotas sin interes - 20% off abonando en efectivo
                    </p>
                    <p>{product.Name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default App;
