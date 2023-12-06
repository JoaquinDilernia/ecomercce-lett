import { useState, useEffect } from 'react'
import './App.css'
import NoSleep from 'nosleep.js';
import Loading from './Loading'

function App() {

  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [filteredProducts, setFilteredProducts] = useState([])
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('https://apimocha.com/apilett/posts')
      .then(response => response.json())
      .then(data => {
        setProducts(data)
        setFilteredProducts(data)
      })
  }
    , [])

  const handleSearch = (e) => {
    setSearch(e.target.value)
    if (e.target.value !== '') {
      const filteredProducts = products.filter(product => {
        return product.Name.toLowerCase().includes(e.target.value.toLowerCase())
      })
      if (filteredProducts.length === 0) {
        setError(true)
      } else {
        setError(false)
      }
      setFilteredProducts(filteredProducts)
    } else {
      setFilteredProducts(products)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && filteredProducts.length === 1) {
      setSearch('')
      setFilteredProducts(products)

    }
  }


  var noSleep = new NoSleep();

  function enableNoSleep() {
    noSleep.enable();
    document.removeEventListener('touchstart', enableNoSleep, false);
  }
  
  // Habilitar el seguro para no bloquear la pantalla
  document.addEventListener('touchstart', enableNoSleep, false)

  

  
  function reloaderror() {
    setTimeout(function () {
      window.location.reload();
    }, 3000);
  }



  return (
    <>

      <div className="App">
        
        <div className="search">
          <input
            type="text"
            placeholder="Buscar producto"
            value={search}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
          />

          <p>Espere unos segundos.</p>

        </div>
        <div className="products-contenedor">
          {filteredProducts.length === 0 && <Loading />}
          {filteredProducts.map((product, key) => {
            
            return (
              <div className="product-card" key={key}>
                <div className='product-header'>
                {product.Descuento === 'SI' ? <div className='porcentaje'><p>{product.Porcentaje}</p></div> : null}
                  <h5>{product.Description}</h5>
                  </div>
                  <div className='product-body'>
     
                  <div className='cont-precios'>
                  {product.Descuento === 'SI' ? <p className='Precio-lista-tachado'>ANTES <span>{product.Precio}</span></p> : <p className='Precio-lista'>Precio Lista: <span>{product.Precio}</span></p> }
                  {product.Descuento === 'SI' ? <p className='Precio-descuento'>SALE 🔥: <span>{product.Pdesceunto}</span></p> : null}
                  </div>
                  <p className='Precio-efectivo'>EFECTIVO: <span>{product.Efecivo}</span></p>
                </div>

                <div className='product-footer-medidas'>
                <div className='medidas-cont'>
                    <p className='medidas'>ALTO CM: <span>{product.Alto}</span></p>
                    <p className='medidas'>ANCHO CM: <span>{product.Ancho}</span></p>
                    <p className='medidas'>PROFUNDIDAD CM: <span>{product.Porfundidad}</span></p>
                    <p className='medidas'>DIAMETRO CM: <span>{product.Diametro}</span></p>
                    <p className='medidas'>PESO KG: <span>{product.Peso}</span></p>
                  </div>
                </div>

                <div className='product-footer-info'>
                <p className='info'>3 cuotas sin interes - 20% off abonando en efectivo</p>
                  <p>{product.Name}</p>
                </div>
              </div >
            )
          }
          )}
        </div>
        {error && <p className='error'>Producto no encontrado</p> && reloaderror()}
        {}
      </div>






    </>
  )
}

export default App
