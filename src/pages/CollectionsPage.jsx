import { useCart } from "../context/CartContext.jsx";
import { products } from "../data/products.js";
import "../styles/collections.css";

export default function CollectionsPage() {
  const { items } = useCart();

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./index.html" aria-label="Woven Jewels home">
          <span className="brand-symbol" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </a>
        <nav className="header-actions" aria-label="Collection navigation">
          <a href="./index.html">← Home</a>
          <a className="bag-link" href="./order-summary.html">View order (<span>{items.length}</span>)</a>
        </nav>
      </header>
      <main>
        <h1 className="visually-hidden">Woven Jewels collection</h1>
        <section className="collection-art" aria-label="Shop the Woven Jewels collection">
          <img
            src="/collection-reference.png"
            alt="Woven Jewels collection featuring Ethereal Handchain, Moonlace bracelets, Rainbow bracelets, Joyful Bloom Bracelet, Starfall Earrings, Lilac Bracelet, Pearle Bracelet, Beaded Bracelets, and Blossom Bracelet"
          />
          {products.map((product) => {
            const [column, row] = product.collectionCell;
            const position = {
              left: `${14.5 + (column * 24.7)}%`,
              top: `${9.5 + (row * 29)}%`,
              width: "21.5%",
              height: row === 1 ? "27.5%" : "28%"
            };
            return (
              <a
                className="product-hotspot"
                key={product.id}
                href={`./product-details.html?id=${encodeURIComponent(product.id)}`}
                style={position}
                aria-label={`View details for ${product.name}`}
                title={`View ${product.name} details`}
              />
            );
          })}
        </section>
        <p className="status" role="status" aria-live="polite" />
        <p className="helper">Select a product to view its details. Use “View order” when you’re ready.</p>
      </main>
      <footer className="site-footer">© {new Date().getFullYear()} Woven Jewels · Handmade with care</footer>
    </>
  );
}
