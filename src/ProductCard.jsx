import React from 'react';
import './App.css';
import { getPrices, pctLabel, DESC_EFECTIVO, DESC_TRANSFERENCIA } from './pricing';

const ProductCard = React.memo(({ product }) => {
  const {
    img,
    Name,
    Description,
    Alto,
    Ancho,
    Profundidad,
    Peso,
    Diametro,
  } = product;

  const prices = getPrices(product);

  return (
    <div className="product-card slide-up">
      <div className="contenedor-izq">
        <div className="product-img">
          <img
            src={img || '/placeholder-product.svg'}
            alt={Name || 'Producto'}
            onError={(e) => { e.target.src = '/placeholder-product.svg'; }}
          />
        </div>

        <div className="contenedor-sku">
          <p className="sku">{Name || 'N/A'}</p>
        </div>
      </div>

      <div className="contenedor-derecha">
        <div className="contenedor-desc">
          <p>{Description || 'Descripción no disponible'}</p>
        </div>

        <div className="contenedor-precios">
          <div className="precio">
            {prices.hasOferta ? (
              <div className="Contenedor-descuento">
                <p className="text">Antes:</p>
                <p className="precio-antes">{prices.lista}</p>
                <p className="text">Oferta:</p>
                <p className="precio-ahora">{prices.oferta}</p>
              </div>
            ) : (
              <p className="precio-actual">{prices.lista || 'Consultar'}</p>
            )}
          </div>

          <div className="precio-ef">
            <p className="text-ef">Efectivo ({pctLabel(DESC_EFECTIVO)} off):</p>
            <p className="precio-efectivo">{prices.efectivo || 'Consultar'}</p>
          </div>

          <div className="precio-ef">
            <p className="text-ef text-transf">Transferencia ({pctLabel(DESC_TRANSFERENCIA)} off):</p>
            <p className="precio-efectivo precio-transf">{prices.transferencia || 'Consultar'}</p>
          </div>
        </div>

        <div className="conteendor-info">
          <div className="info-coutas">
            <p className="text-info">✓ 3 cuotas sin interés</p>
            <p className="text-info">✓ {pctLabel(DESC_EFECTIVO)} off abonando en efectivo</p>
            <p className="text-info">✓ {pctLabel(DESC_TRANSFERENCIA)} off abonando por transferencia</p>
          </div>

          <div className="info-medidas">
            {Alto && <p className="text-medidas">Alto: {Alto} cm</p>}
            {Ancho && <p className="text-medidas">Ancho: {Ancho} cm</p>}
            {Profundidad && <p className="text-medidas">Profund: {Profundidad} cm</p>}
            {Peso && <p className="text-medidas">Peso: {Peso} kg</p>}
            {Diametro && <p className="text-medidas">Ø: {Diametro} cm</p>}
          </div>
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;
