import { useState, useEffect } from 'react'
import './App.css'
import { motion } from 'framer-motion'
import banner from './assets/ALTORANCHO.png'
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
    }
  }

  return (
    <>
      <div className="App">
        <div className="banner">
          <img src={banner} alt='banner' />
        </div>
        <div className="search">
          <input
            type="text"
            placeholder="Buscar producto"
            value={search}
            onChange={handleSearch}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="products-contenedor">
          {filteredProducts.length === 0 && <Loading />}
          {filteredProducts.map((product, key) => {
            
            return (
              <motion.div className="product-card" key={key}>
                <div className='product-header'>
                  <h2>{product.Modelo}</h2>
                  <h5>{product.Description}</h5>
                  <div className='medidas-cont'>
                    <p className='medidas'>ALTO CM: <span>{product.Alto}</span></p>
                    <p className='medidas'>ANCHO CM: <span>{product.Ancho}</span></p>
                    <p className='medidas'>PROFUNDIDAD CM: <span>{product.Porfundidad}</span></p>
                    <p className='medidas'>DIAMETRO CM: <span>{product.Diametro}</span></p>
                    <p className='medidas'>PESO KG: <span>{product.Peso}</span></p>
                  </div>
                  <p className='Precio-lista'>Precio Lista: <span>{product.Promocion}</span></p>
                  <p className='Precio-efectivo'>Precio Efectivo: <span>{product.Efecivo}</span></p>
                  <p className='info'>3 cuotas sin interes - 15% off abonando en efectivo</p>
                </div>
                <div className='product-footer'>
                  <p>{product.Name}</p>
                </div>
              </motion.div >
            )
          }
          )}
        </div>
        {error && <p className='error'>Producto no encontrado</p>}
      </div>




    </>
  )
}

export default App
