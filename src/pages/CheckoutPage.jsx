import { useState } from "react";
import { useCart, formatRupees } from "../context/CartContext.jsx";
import "../styles/checkout.css";

const initialCustomer = {
  fullName: "",
  country: "Pakistan",
  contactNumber: "",
  city: "",
  email: "",
  region: "",
  fullAddress: "",
  streetAddress: "",
  apartment: ""
};

const fields = [
  { className: "field-name", id: "fullName", label: "Full name (required)", placeholder: "Full name", autoComplete: "name", required: true, minLength: 2 },
  { className: "field-country", id: "country", label: "Country: Pakistan", value: "Pakistan", autoComplete: "country-name", required: true, readOnly: true },
  { className: "field-phone", id: "contactNumber", label: "Contact number, required", placeholder: "Contact number", autoComplete: "tel", type: "tel", inputMode: "tel", pattern: "\\+?[0-9]{7,19}", required: true },
  { className: "field-city", id: "city", label: "City, required", placeholder: "City", autoComplete: "address-level2", required: true },
  { className: "field-email", id: "email", label: "Email address, required", placeholder: "Email address", autoComplete: "email", type: "email", required: true },
  { className: "field-region", id: "region", label: "State, province, or region, required", placeholder: "State, province, or region", autoComplete: "address-level1", required: true },
  { className: "field-address", id: "fullAddress", label: "Full address, required", placeholder: "Full address", autoComplete: "street-address", minLength: 8, required: true },
  { className: "field-street", id: "streetAddress", label: "Street address, required", placeholder: "Street address", required: true },
  { className: "field-apartment", id: "apartment", label: "Apartment, suite, or house number, optional", placeholder: "Apartment / suite / house no.", autoComplete: "address-line2" }
];

export default function CheckoutPage() {
  const { items, removeOne } = useCart();
  const [customer, setCustomer] = useState(initialCustomer);
  const [error, setError] = useState("");
  const subtotal = items.reduce((sum, product) => sum + product.price, 0);
  const shipping = items.length ? 200 : 0;
  const total = subtotal + shipping;
  const grouped = new Map();
  items.forEach((product) => {
    const key = `${product.id}:${product.price}`;
    const entry = grouped.get(key);
    if (entry) entry.quantity += 1;
    else grouped.set(key, { ...product, quantity: 1 });
  });

  function updateField(event) {
    setCustomer((current) => ({ ...current, [event.target.name]: event.target.value }));
    event.target.removeAttribute("aria-invalid");
    setError("");
  }

  function submitCheckout(event) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const invalidField = [...form.querySelectorAll("input[required], select[required]")]
      .find((field) => !field.checkValidity());
    if (invalidField) {
      invalidField.setAttribute("aria-invalid", "true");
      setError(invalidField.validationMessage || "Please complete this required field.");
      invalidField.focus();
      return;
    }
    if (!items.length) {
      setError("Your bag is empty. Add jewelry before placing an order.");
      return;
    }
    try {
      window.sessionStorage.setItem("woven-jewels-checkout-draft", JSON.stringify({
        customer: Object.fromEntries(Object.entries(customer).map(([key, value]) => [key, value.trim()]))
      }));
      window.location.href = "./payment.html";
    } catch (storageError) {
      console.error("Could not save Woven Jewels checkout details.", storageError);
      setError("Checkout details could not be saved in this browser. Check storage settings and try again.");
    }
  }

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
        <h1 className="checkout-heading">Checkout info</h1>
        <div className="checkout-shell">
          <div className="design-stage">
            <img className="design-image" src="/checkout-reference.png" alt="Woven Jewels checkout form on a parchment scroll, with fields for your name, country, contact number, city, email, region, full address, street address, apartment number, and cash on delivery" />
          </div>
          <form className="checkout-form" id="checkoutForm" noValidate onSubmit={submitCheckout}>
            {fields.map((field) => (
              <div className={`field ${field.className}`} key={field.id}>
                <label className="visually-hidden" htmlFor={field.id}>{field.label}</label>
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type || "text"}
                  autoComplete={field.autoComplete}
                  value={customer[field.id]}
                  required={field.required}
                  minLength={field.minLength}
                  pattern={field.pattern}
                  inputMode={field.inputMode}
                  readOnly={field.readOnly}
                  placeholder={field.placeholder}
                  aria-label={field.label}
                  onChange={updateField}
                />
              </div>
            ))}
            <label className="delivery-choice" htmlFor="cashOnDelivery" aria-label="Select cash on delivery">
              <input id="cashOnDelivery" name="paymentMethod" type="radio" value="cash-on-delivery" defaultChecked required />
              <span aria-hidden="true" />
            </label>
            <p className="form-error" role="alert" aria-live="polite">{error}</p>
          </form>
        </div>

        <section className="order-panel" aria-labelledby="summaryTitle">
          <div className="order-summary">
            <h2 id="summaryTitle">Your order <span className="item-count">{items.length} {items.length === 1 ? "piece" : "pieces"}</span></h2>
            <div className="summary-items">
              {[...grouped.entries()].map(([key, product]) => (
                <span className="summary-item" key={key}>
                  {product.name} × {product.quantity} · {formatRupees(product.price * product.quantity)}
                  <button
                    type="button"
                    aria-label={`Remove ${product.name} from the order`}
                    onClick={() => removeOne(product.id, product.price)}
                  >×</button>
                </span>
              ))}
            </div>
            <div className="summary-total"><span>Subtotal</span><strong>{formatRupees(subtotal)}</strong></div>
            <div className="summary-total"><span>Shipping</span><strong>{formatRupees(shipping)}</strong></div>
            <div className="summary-total"><span>Order total</span><strong>{formatRupees(total)}</strong></div>
          </div>
          <div className="order-actions">
            <button className="place-order" type="submit" form="checkoutForm" disabled={!items.length}>
              Continue to payment · {formatRupees(total)}
            </button>
            <a className="secondary-link" href="./index.html#collections">Continue shopping</a>
          </div>
          <p className="prototype-note">Next: pay 50% of the total in advance and upload your transaction screenshot. The remaining 50% is due on delivery.</p>
        </section>

        {!items.length && (
          <section className="empty-state is-visible">
            <h2>Your bag is empty</h2>
            <p>Add jewelry to your bag before placing an order.</p>
            <a className="secondary-link" href="./index.html#collections">Browse the collection</a>
          </section>
        )}
      </main>
      <footer className="site-footer">© {new Date().getFullYear()} Woven Jewels · Handmade with care</footer>
    </>
  );
}
