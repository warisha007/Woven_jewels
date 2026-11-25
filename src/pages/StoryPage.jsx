import { useState } from "react";
import "../styles/story.css";

export default function StoryPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="./index.html" aria-label="Woven Jewels home">
            <span className="brand-symbol" aria-hidden="true" />
            <span className="brand-wordmark" aria-hidden="true" />
          </a>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="./collections.html">Collections</a>
            <a href="./our-story.html" aria-current="page">Our Story</a>
            <a href="./index.html#contact">Contact</a>
          </nav>
          <div className="header-actions"><a className="shop-link" href="./collections.html">Shop collection</a></div>
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
        <nav className={`container mobile-nav${menuOpen ? " is-open" : ""}`} id="mobileNav" aria-label="Mobile navigation">
          <a href="./collections.html">Collections</a>
          <a href="./our-story.html" aria-current="page">Our Story</a>
          <a href="./index.html#contact">Contact</a>
          <a className="mobile-shop" href="./collections.html">Shop collection</a>
        </nav>
      </header>
      <main>
        <div className="container">
          <header className="story-intro">
            <p className="eyebrow">Our story</p>
            <h1>Jewelry woven with a little magic.</h1>
            <p>Woven Jewels brings together handcrafted jewelry and thoughtful gifts, with warm tones and one-of-a-kind details made to bring a little joy to every day.</p>
          </header>
          <section className="story-card" aria-labelledby="story-title">
            <img className="story-image" src="/woven-jewels-logo.jpeg" alt="Woven Jewels logo" />
            <div className="story-copy">
              <p className="eyebrow">Handmade with heart</p>
              <h2 id="story-title">Made with care, meant to be treasured.</h2>
              <p>Each piece is handmade with care, bringing thoughtful details and a personal touch to jewelry you can wear or share as a gift.</p>
              <p>Everything we make starts with our own ideas and creativity. We create each piece from scratch using high-quality raw materials, then present it to you with love and care.</p>
              <p>From colorful beads and soft pearls to delicate golden accents, every design is made to feel special and woven into your everyday.</p>
              <a className="story-cta" href="./collections.html">Explore the collection</a>
            </div>
          </section>
        </div>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span>© {new Date().getFullYear()} Woven Jewels · Handmade with care</span>
          <nav className="footer-links" aria-label="Footer navigation">
            <a href="./index.html">Home</a>
            <a href="./collections.html">Shop all collections</a>
            <a href="mailto:wisha0007@gmail.com">wisha0007@gmail.com</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
