import { useEffect, useRef, useState } from "react";
import { useCart, formatRupees } from "../context/CartContext.jsx";
import { products } from "../data/products.js";
import "../styles/home.css";

export default function HomePage() {
  const { items, addItems } = useCart();
  const [giftBox, setGiftBox] = useState([]);
  const [status, setStatus] = useState("Drag a piece into the gift box, or tap a piece to add it.");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const [ghost, setGhost] = useState(null);
  const heroRef = useRef(null);
  const dropRef = useRef(null);
  const activeDrag = useRef(null);
  const suppressClick = useRef(false);

  const giftBoxTotal = giftBox.reduce((sum, product) => sum + product.price, 0);

  useEffect(() => {
    const cleanup = () => {
      const drag = activeDrag.current;
      if (!drag) return;
      document.removeEventListener("pointermove", drag.move);
      document.removeEventListener("pointerup", drag.end);
      document.removeEventListener("pointercancel", drag.cancel);
      document.documentElement.classList.remove("is-jewelry-dragging");
      activeDrag.current = null;
    };
    return cleanup;
  }, []);

  function addProduct(product) {
    setGiftBox((current) => [...current, product]);
    setStatus(`${product.name} added. Gift box total: ${formatRupees(giftBoxTotal + product.price, 2)}.`);
  }

  function startDrag(event, product) {
    if (event.button !== 0 || activeDrag.current) return;
    event.preventDefault();

    const buttonBounds = event.currentTarget.getBoundingClientRect();
    const imageBounds = heroRef.current.getBoundingClientRect();
    const scale = Math.min(1.5, 96 / buttonBounds.width);
    const image = heroRef.current.querySelector("img");
    const ghostStyle = {
      width: `${buttonBounds.width * scale}px`,
      height: `${buttonBounds.height * scale}px`,
      backgroundImage: `url("${image.currentSrc}")`,
      backgroundSize: `${imageBounds.width * scale}px ${imageBounds.height * scale}px`,
      backgroundPosition: `-${(buttonBounds.left - imageBounds.left) * scale}px -${(buttonBounds.top - imageBounds.top) * scale}px`,
      left: `${event.clientX + 14}px`,
      top: `${event.clientY + 14}px`
    };
    const drag = {
      product,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      ghostStyle
    };

    drag.move = (moveEvent) => {
      if (moveEvent.pointerId !== drag.pointerId) return;
      drag.moved ||= Math.hypot(moveEvent.clientX - drag.startX, moveEvent.clientY - drag.startY) > 5;
      setGhost({
        product,
        style: {
          ...drag.ghostStyle,
          left: `${Math.min(moveEvent.clientX + 14, window.innerWidth - buttonBounds.width * scale - 8)}px`,
          top: `${Math.min(moveEvent.clientY + 14, window.innerHeight - buttonBounds.height * scale - 8)}px`
        }
      });
      const bounds = dropRef.current.getBoundingClientRect();
      const inside = moveEvent.clientX >= bounds.left && moveEvent.clientX <= bounds.right &&
        moveEvent.clientY >= bounds.top && moveEvent.clientY <= bounds.bottom;
      setIsOver(inside);
    };
    drag.end = (endEvent) => {
      if (endEvent.pointerId !== drag.pointerId) return;
      const bounds = dropRef.current.getBoundingClientRect();
      const inside = endEvent.clientX >= bounds.left && endEvent.clientX <= bounds.right &&
        endEvent.clientY >= bounds.top && endEvent.clientY <= bounds.bottom;
      finishDrag(drag);
      if (!drag.moved) return;
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (inside) addProduct(product);
      else setStatus("Drop your jewelry inside the gift box to add it.");
    };
    drag.cancel = (cancelEvent) => {
      if (cancelEvent.pointerId !== drag.pointerId) return;
      finishDrag(drag);
      setStatus("Drag cancelled. Try dropping a piece into the gift box.");
    };

    activeDrag.current = drag;
    document.documentElement.classList.add("is-jewelry-dragging");
    setStatus(`Dragging ${product.name} · ${formatRupees(product.price)}. Drop it in the gift box.`);
    drag.move(event);
    document.addEventListener("pointermove", drag.move);
    document.addEventListener("pointerup", drag.end);
    document.addEventListener("pointercancel", drag.cancel);
  }

  function finishDrag(drag) {
    document.removeEventListener("pointermove", drag.move);
    document.removeEventListener("pointerup", drag.end);
    document.removeEventListener("pointercancel", drag.cancel);
    document.documentElement.classList.remove("is-jewelry-dragging");
    activeDrag.current = null;
    setGhost(null);
    setIsOver(false);
  }

  function handleAddToCart() {
    if (!giftBox.length) {
      setStatus("Your gift box is empty. Add a jewelry piece before checking out.");
      return;
    }
    addItems(giftBox);
    window.location.href = "./order-summary.html";
  }

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#home" aria-label="Woven Jewels home">
            <span className="brand-symbol" aria-hidden="true" />
            <span className="brand-wordmark" aria-hidden="true" />
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="./collections.html">Collections</a>
            <a href="./our-story.html">Our Story</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="header-actions">
            <a className="cart-link" href="./order-summary.html" aria-label={`Shopping bag, ${items.length} items`}>
              Bag <span className="cart-count" aria-hidden="true">{items.length}</span>
            </a>
            <a className="header-cta" href="./collections.html">Shop collection</a>
          </div>
          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="mobileNav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        <nav className={`mobile-nav${menuOpen ? " is-open" : ""}`} id="mobileNav" aria-label="Mobile navigation">
          <a href="./collections.html">Collections</a>
          <a href="./our-story.html">Our Story</a>
          <a href="#contact">Contact</a>
          <a className="mobile-shop" href="./collections.html">Shop collection</a>
        </nav>
      </header>

      <main id="home">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Handmade with heart</p>
              <h1 id="hero-title">Jewelry woven with a little magic.</h1>
              <p className="hero-description">Thoughtful details, warm tones, and one-of-a-kind pieces made to bring a little joy to every day.</p>
            </div>
            <div className="hero-media" id="collections" aria-label="Interactive Woven Jewels collection" ref={heroRef}>
              <img src="/woven-jewels-hero.jpeg" alt="Woven Jewels collection of handcrafted bracelets, earrings, and gift packaging" />
              <a className="view-collections-hotspot" href="./collections.html" aria-label="View all Woven Jewels collections" title="View All Collections" />
              {products.map((product) => (
                <button
                  className="jewel-picker"
                  key={product.id}
                  type="button"
                  data-id={product.id}
                  data-name={product.name}
                  data-price={product.price}
                  style={product.homePosition}
                  aria-label={`${product.name}, Rs. ${product.price}. Add to your gift box.`}
                  title={`${product.name} · Rs. ${product.price}`}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    addProduct(product);
                  }}
                  onPointerDown={(event) => startDrag(event, product)}
                />
              ))}
              <button className="button hero-add-to-cart" type="button" onClick={handleAddToCart}>Add to cart</button>
              <div className="machine-total" aria-label={`Current gift box total: ${formatRupees(giftBoxTotal, 2)}`} aria-live="polite" aria-atomic="true">
                {formatRupees(giftBoxTotal, 2)}
              </div>
              <div className={`gift-box-drop${isOver ? " is-over" : ""}`} id="giftBoxDrop" role="region" aria-label="Gift box. Drop jewelry here or select a piece to add it." ref={dropRef}>
                <span className="drop-hint">{giftBox.length ? "Your picks · tap an item to remove" : "Drop pieces here"}</span>
                <div className="box-items" aria-live="polite">
                  {giftBox.map((product, index) => (
                    <button
                      className="box-item"
                      key={`${product.id}-${index}`}
                      type="button"
                      aria-label={`Remove ${product.name}, ${formatRupees(product.price)}, from gift box`}
                      onClick={() => {
                        setGiftBox((current) => current.filter((_, itemIndex) => itemIndex !== index));
                        setStatus(`${product.name} removed from your gift box.`);
                      }}
                    >
                      {product.name} · {formatRupees(product.price)} ×
                    </button>
                  ))}
                </div>
              </div>
              <p className="interaction-status" role="status" aria-live="polite">{status}</p>
              {ghost && <div className="drag-ghost" data-label={`${ghost.product.name} · ${formatRupees(ghost.product.price)}`} style={ghost.style} />}
            </div>
            <div className="hero-bottom">
              <p>Handmade with care. Each piece adds to your gift-box total.</p>
              <a className="hero-cta" href="./collections.html">View All Collections <span className="arrow" aria-hidden="true">→</span></a>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="contact">
        <div className="container">
          <div className="footer-main">
            <div className="footer-brand" id="story">
              <a className="brand" href="#home" aria-label="Woven Jewels — Artistry in Every Strand">
                <span className="brand-symbol" aria-hidden="true" />
                <span className="brand-wordmark" aria-hidden="true" />
              </a>
              <p>Handcrafted jewelry and thoughtful gifts, made with care and woven into your everyday.</p>
            </div>
            <div>
              <h2 className="footer-title">Explore</h2>
              <nav className="footer-links" aria-label="Footer navigation">
                <a href="./collections.html">Shop all collections</a>
                <a href="./our-story.html">Our story</a>
                <a href="./admin.html">Admin sign-in</a>
                <a href="#home">Back to top</a>
              </nav>
            </div>
            <div>
              <h2 className="footer-title">Get in touch</h2>
              <div className="footer-links">
                <a href="mailto:wisha0007@gmail.com">wisha0007@gmail.com</a>
                <a href="https://www.instagram.com/wovenjewels.studio/" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a href="#contact">Shipping &amp; returns</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© {new Date().getFullYear()} Woven Jewels. Made with care.</p>
            <p>Handmade, thoughtfully yours.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
