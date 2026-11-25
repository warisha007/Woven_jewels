import { useMemo, useState } from "react";
import { useCart, formatRupees } from "../context/CartContext.jsx";
import { productsById } from "../data/products.js";
import "../styles/summary.css";

function getThumbnailStyle(product) {
  const collectionCell = productsById.get(product.id)?.collectionCell;
  if (collectionCell) {
    const [column, row] = collectionCell;
    return {
      backgroundImage: 'url("/collection-reference.png")',
      backgroundSize: "400% 400%",
      backgroundPosition: `${17 + column * 33}% ${12 + row * 38}%`
    };
  }
  return {};
}

export default function OrderSummaryPage() {
  const { items, addItems, removeOne, removeAll } = useCart();
  const [status, setStatus] = useState("");
  const grouped = useMemo(() => {
    const groups = new Map();
    items.forEach((product) => {
      const key = `${product.id}:${product.price}`;
      const current = groups.get(key);
      if (current) current.quantity += 1;
      else groups.set(key, { ...product, quantity: 1 });
    });
    return [...groups.entries()];
  }, [items]);
  const subtotal = items.reduce((sum, product) => sum + product.price, 0);
  const shipping = items.length ? 200 : 0;

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./index.html" aria-label="Woven Jewels home">
          <span className="brand-symbol" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </a>
        <a className="back-link" href="./index.html#collections">← Back to collection</a>
      </header>
      <main>
        <h1 className="heading">Order summary</h1>
        <section className="summary-shell" aria-label="Your order summary">
          <img
            className="summary-image"
            src="/order-summary-reference.png"
            alt="Order summary on parchment listing product name, quantity, item price, subtotal, shipping, total, and order button"
          />
          <div className="items" aria-live="polite">
            {grouped.map(([key, product]) => (
              <article className="item" key={key}>
                <div className="item-thumb" role="img" aria-label={product.name} style={getThumbnailStyle(product)} />
                <div className="item-details">
                  <span className="item-name">{product.name}</span>
                  <span className="item-meta">Quantity: {product.quantity} · {formatRupees(product.price)} each</span>
                </div>
                <div className="item-actions">
                  <span className="item-price">{formatRupees(product.price * product.quantity)}</span>
                  <div className="quantity">
                    <button
                      type="button"
                      aria-label={`Remove one ${product.name}`}
                      onClick={() => removeOne(product.id, product.price)}
                    >−</button>
                    <span>{product.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Add one ${product.name}`}
                      onClick={() => addItems([product])}
                    >+</button>
                  </div>
                  <button
                    className="remove"
                    type="button"
                    aria-label={`Remove ${product.name} from order`}
                    onClick={() => {
                      removeAll(product.id, product.price);
                      setStatus(`${product.name} removed from your order.`);
                    }}
                  >
                    Remove item
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className={`empty-hint${items.length ? "" : " is-visible"}`}>Your gift box is empty.<br />Choose some handmade pieces to get started.</p>
          <div className="totals" aria-live="polite">
            <div className="total-row"><span>Subtotal:</span><span>{formatRupees(subtotal)}</span></div>
            <div className="total-row"><span>Discount:</span><span>{formatRupees(0)}</span></div>
            <div className="total-row"><span>Shipping:</span><span>{items.length ? formatRupees(shipping) : "Free"}</span></div>
            <div className="total-row"><span>Total:</span><span>{formatRupees(subtotal + shipping)}</span></div>
          </div>
          <button
            className="order-button"
            type="button"
            disabled={!items.length}
            onClick={() => {
              if (!items.length) {
                setStatus("Your order is empty. Add a piece from the collection first.");
                return;
              }
              window.location.href = "./checkout.html";
            }}
          >
            ORDER!
          </button>
        </section>
        <p className="status" role="status" aria-live="polite">{status}</p>
        <section className={`empty-state${items.length ? "" : " is-visible"}`}>
          <h2>Nothing in your order yet</h2>
          <p>Browse the collection and add some handmade pieces to your bag.</p>
          <a className="action-link" href="./collections.html">View all collections</a>
        </section>
      </main>
    </>
  );
}
