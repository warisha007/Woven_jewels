import { useEffect, useState } from "react";
import { useCart, formatRupees } from "../context/CartContext.jsx";
import { productsById } from "../data/products.js";
import "../styles/product.css";

export default function ProductPage() {
  const product = productsById.get(new URLSearchParams(window.location.search).get("id"));
  const { items, addItems } = useCart();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    document.title = product ? `${product.name} — Woven Jewels` : "Product not found — Woven Jewels";
  }, [product]);

  if (!product) {
    return (
      <>
        <header className="site-header">
          <a className="brand" href="./index.html" aria-label="Woven Jewels home">
            <span className="brand-symbol" aria-hidden="true" />
            <span className="brand-wordmark" aria-hidden="true" />
          </a>
          <nav className="header-actions" aria-label="Product navigation">
            <a href="./collections.html">← Back to collection</a>
            <a className="bag-link" href="./order-summary.html">View order ({items.length})</a>
          </nav>
        </header>
        <main>
          <section className="not-found">
            <h2>Product not found</h2>
            <p>Choose a product from the collection to see its details.</p>
            <a href="./collections.html">Back to collection</a>
          </section>
        </main>
      </>
    );
  }

  const activeImage = product.images[activeImageIndex];
  const galleryStyle = {
    backgroundImage: `url("${activeImage.src}")`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat"
  };

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./index.html" aria-label="Woven Jewels home">
          <span className="brand-symbol" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </a>
        <nav className="header-actions" aria-label="Product navigation">
          <a href="./collections.html">← Back to collection</a>
          <a className="bag-link" href="./order-summary.html">View order ({items.length})</a>
        </nav>
      </header>
      <main>
        <h1 className="visually-hidden">Product details</h1>
        <section className="product-shell" aria-labelledby="productName">
          <img className="product-design" src="/product-details-reference.png" alt="" />
          <div className="gallery-main" role="img" aria-label={`${product.name}: ${activeImage.label}`} style={galleryStyle} />
          <div className="gallery-thumbnails" role="group" aria-label="Product images" hidden={product.images.length < 2}>
            {product.images.map((image, index) => (
              <button
                className="gallery-thumbnail"
                key={image.src}
                type="button"
                aria-label={`View ${image.label} of ${product.name}`}
                aria-pressed={index === activeImageIndex}
                style={{
                  backgroundImage: `url("${image.src}")`,
                  backgroundSize: "contain",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat"
                }}
                onClick={() => setActiveImageIndex(index)}
              />
            ))}
          </div>
          <div className="gallery-indicators" aria-hidden="true" hidden={product.images.length < 2}>
            {product.images.map((image, index) => (
              <span className={`gallery-dot${index === activeImageIndex ? " is-active" : ""}`} key={image.src} />
            ))}
          </div>
          <div className="product-info">
            <h2 id="productName">{product.name}</h2>
            <p className="product-price">{formatRupees(product.price)}</p>
          </div>
          <button
            className="add-button"
            type="button"
            onClick={() => {
              addItems([product]);
              setStatus(`${product.name} added to your order.`);
            }}
          >
            Add To Cart
          </button>
          <section className="description" aria-labelledby="descriptionTitle">
            <h2 className="description-heading" id="descriptionTitle">Description:</h2>
            <p>{product.description}</p>
          </section>
        </section>
        <p className="status" role="status" aria-live="polite">{status}</p>
      </main>
    </>
  );
}
