import { useState, useEffect } from "react";
import "./App.css";
import NoSleep from "nosleep.js";
import Loading from "./Loading";

function App() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [error, setError] = useState(false);
  const [cant, setCant] = useState(12);


  useEffect(() => {
    fetch("https://mockly.app/api/ab761266-af2d-4739-a5aa-57f64ff411dd/pick")
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

  // Contador para volver a buscar
  useEffect(() => {
    const interval = setInterval(() => {
      setCant(cant - 1);
    }, 1000);

    if (cant === 0) {
      setCant(10);
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
                  
                  
                  <div className="contenedor-izq">
                    <div className="product-img">
                      <img src={product.img} alt={product.Name} />
                    </div>
                    <div className="contenedor-sku">
                      <p className="sku">{product.Name}</p>
                    </div>
                    </div>
                    <div className="contenedor-derecha">
                      <div className="contenedor-desc">
                        <p>{product.Description} </p>
                      </div>
                      <div className="contenedor-precios">
                        <div className="precio">
                        {product.Descuento === "NO" ? (
                          
                          <p className="precio-actual"> {product.Precio}</p>
                        ) : (
                          <div className="Contenedor-descuento">
                            <p className="text">Antes:</p>
                          <p className="precio-antes"> {product.Precio} </p>
                          <p className="text">Sale:</p>
                          <p className="precio-ahora"> {product.Pdesceunto}</p>
                          </div>
                        )}
                          

                        </div>
                        <div className="precio-ef">
                          <p className="text-ef">Efectivo:</p>
                          <p className="precio-efectivo">
                             {product.Efecivo}
                          </p>

                        </div>

                      </div>
                      <div className="conteendor-info">
                        <div className="info-coutas">
                          <p className="text-info">3 cuotas sin interés</p>
                          <p className="text-info">20% off abonando en efectivo</p>

                        </div>
                        <div className="info-medidas">
                          <p className="text-medidas">Alto: {product.Alto} cm</p>
                          <p className="text-medidas">Ancho: {product.Profundidad} cm</p>
                          <p className="text-medidas">Peso: {product.Peso} kg</p>
                          <p className="text-medidas">Ancho: {product.Ancho} cm</p>
                          <p className="text-medidas">Diamentro: {product.Diametro} cm</p>
                        </div>

                      </div>

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
