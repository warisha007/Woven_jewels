import { useMemo, useState } from "react";
import { useCart, formatRupees } from "../context/CartContext.jsx";
import { requireSupabase, supabaseConfigured } from "../lib/supabase.js";
import "../styles/payment.css";

const draftKey = "woven-jewels-checkout-draft";
const pendingOrderKey = "woven-jewels-pending-payment";
const paymentAccount = {
  ready: import.meta.env.VITE_PAYMENT_ACCOUNT_READY === "true",
  bankName: import.meta.env.VITE_PAYMENT_BANK_NAME?.trim() || "",
  accountTitle: import.meta.env.VITE_PAYMENT_ACCOUNT_TITLE?.trim() || "",
  accountNumber: import.meta.env.VITE_PAYMENT_ACCOUNT_NUMBER?.trim() || ""
};
const accountReady = paymentAccount.ready &&
  [paymentAccount.bankName, paymentAccount.accountTitle, paymentAccount.accountNumber].every(Boolean);

function readSessionJson(key) {
  const saved = window.sessionStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

function getFingerprint(customer, items) {
  return JSON.stringify({
    customer,
    productIds: items.map((product) => product.id)
  });
}

function makeUploadName(orderId, file) {
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const extension = extensionByType[file.type];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP screenshot.");
  return `${orderId}/${crypto.randomUUID()}.${extension}`;
}

export default function PaymentPage() {
  const { items, clearCart } = useCart();
  const [draft] = useState(() => {
    try {
      return readSessionJson(draftKey);
    } catch (error) {
      console.error("Could not restore the Woven Jewels checkout details.", error);
      return null;
    }
  });
  const [file, setFile] = useState(null);
  const [initialStatus, initialStatusIsError] = useMemo(() => {
    if (!items.length || !draft) {
      return ["Add items to your bag and complete checkout details before starting payment.", true];
    }
    if (!supabaseConfigured) {
      return ["Setup required: configure the Supabase project URL and public anon key in .env.local.", true];
    }
    if (!accountReady) {
      return ["Demo only: configure real payment account details before accepting transfers.", true];
    }
    return ["", false];
  }, [draft, items.length]);
  const [status, setStatus] = useState(initialStatus);
  const [isError, setIsError] = useState(initialStatusIsError);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState(() => {
    try {
      const lastOrder = readSessionJson("woven-jewels-last-order");
      return lastOrder && !items.length ? lastOrder : null;
    } catch (error) {
      console.error("Could not restore the last Woven Jewels order.", error);
      return null;
    }
  });

  const grouped = useMemo(() => {
    const groups = new Map();
    items.forEach((product) => {
      const key = `${product.id}:${product.price}`;
      const current = groups.get(key);
      if (current) current.quantity += 1;
      else groups.set(key, { ...product, quantity: 1 });
    });
    return [...groups.values()];
  }, [items]);
  const subtotal = items.reduce((sum, product) => sum + product.price, 0);
  const shipping = items.length ? 200 : 0;
  const total = subtotal + shipping;
  const advance = Math.round(total * 50) / 100;
  const codBalance = total - advance;
  const canSubmit = Boolean(
    file && items.length && draft?.customer && supabaseConfigured && accountReady && !busy
  );

  function setMessage(message, error = false) {
    setStatus(message);
    setIsError(error);
  }

  async function submitOrder(event) {
    event.preventDefault();
    setMessage("");
    if (!file) return setMessage("Select a transaction screenshot before placing your order.", true);
    if (file.size > 5 * 1024 * 1024) return setMessage("The screenshot is larger than 5 MB. Choose a smaller image.", true);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return setMessage("Choose a JPG, PNG, or WebP screenshot.", true);
    }
    if (!items.length || !draft?.customer) {
      return setMessage("Your order or checkout details are missing. Return to checkout and try again.", true);
    }
    if (!accountReady) return setMessage("Live order submission is disabled until real payment account details are configured.", true);
    if (!supabaseConfigured) return setMessage("Setup required: configure the Supabase project URL and public anon key in .env.local.", true);

    setBusy(true);
    try {
      const client = requireSupabase();
      const fingerprint = getFingerprint(draft.customer, items);
      let pending = null;
      try {
        pending = readSessionJson(pendingOrderKey);
      } catch (error) {
        console.error("Could not read the pending Woven Jewels order.", error);
        throw new Error("A pending order could not be verified. Clear this tab's session storage and restart checkout.");
      }

      let orderId = pending?.fingerprint === fingerprint ? pending.id : null;
      let orderTotal = orderId ? Number(pending.total) : total;
      if (!orderId) {
        const { data, error } = await client.rpc("wj_create_order", {
          p_customer: draft.customer,
          p_items: items.map((product) => ({ id: product.id }))
        });
        if (error) throw error;
        const createdOrder = Array.isArray(data) ? data[0] : data;
        if (!createdOrder?.order_id) throw new Error("The order service did not return an order reference.");
        orderId = createdOrder.order_id;
        orderTotal = Number(createdOrder.total);
        window.sessionStorage.setItem(pendingOrderKey, JSON.stringify({ id: orderId, fingerprint, total: orderTotal }));
      }

      if (orderTotal !== total) {
        throw new Error(`The database total is ${formatRupees(orderTotal)}, while this page shows ${formatRupees(total)}. Please contact Woven Jewels before transferring.`);
      }

      setMessage("Uploading your transaction screenshot…");
      const proofPath = makeUploadName(orderId, file);
      const { error: uploadError } = await client.storage
        .from("wj-payment-proofs")
        .upload(proofPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: proofError } = await client.rpc("wj_submit_payment_proof", {
        p_order_id: orderId,
        p_proof_path: proofPath
      });
      if (proofError) throw proofError;

      const receipt = { id: orderId, total: orderTotal };
      window.sessionStorage.setItem("woven-jewels-last-order", JSON.stringify(receipt));
      window.sessionStorage.removeItem(pendingOrderKey);
      window.sessionStorage.removeItem(draftKey);
      clearCart();
      setConfirmation(receipt);
      setMessage("");
    } catch (error) {
      console.error("Could not submit the Woven Jewels order.", error);
      setMessage(`Your order was not submitted: ${error.message || "The payment service returned an unexpected error."}`, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./index.html" aria-label="Woven Jewels home">
          <span className="brand-symbol" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </a>
        <a className="back-link" href="./checkout.html">← Back to checkout</a>
      </header>
      <main className="page-shell">
        <p className="eyebrow">Secure your order</p>
        <h1>Payment &amp; order review</h1>
        <p className="intro">Pay half of your order total in advance. The remaining half is payable in cash when your order is delivered.</p>

        {!accountReady && (
          <aside className="demo-warning" role="alert">
            Demo payment details are shown below. Do not transfer money until Woven Jewels adds its real account details.
          </aside>
        )}

        {!confirmation && (
          <>
            <div className="workflow-grid">
              <section className="panel" aria-labelledby="accountTitle">
                <h2 id="accountTitle">Woven Jewels payment account</h2>
                <dl className="account-details">
                  <div><dt>Bank / provider</dt><dd>{paymentAccount.bankName || "Easypaisa"}</dd></div>
                  <div><dt>Recipient name</dt><dd>{paymentAccount.accountTitle || "Asad Naeem"}</dd></div>
                  <div><dt>Easypaisa account number</dt><dd>{paymentAccount.accountNumber || "Not configured"}</dd></div>
                </dl>
                <p className="policy-note"><strong>Payment policy:</strong> 50% advance is required to submit your order. The other 50% is collected on delivery (COD).</p>
              </section>
              <section className="panel" aria-labelledby="orderTitle">
                <h2 id="orderTitle">Your bill</h2>
                <ul className="bill-items">
                  {grouped.map((product) => (
                    <li key={`${product.id}:${product.price}`}>
                      <span>{product.name} × {product.quantity}</span>
                      <span>{formatRupees(product.price * product.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="bill-totals">
                  <div><dt>Subtotal</dt><dd>{formatRupees(subtotal)}</dd></div>
                  <div><dt>Shipping</dt><dd>{formatRupees(shipping)}</dd></div>
                  <div className="total-row"><dt>Total bill</dt><dd>{formatRupees(total)}</dd></div>
                  <div className="advance-row"><dt>Pay now · 50%</dt><dd>{formatRupees(advance)}</dd></div>
                  <div><dt>Due on delivery · 50%</dt><dd>{formatRupees(codBalance)}</dd></div>
                </dl>
              </section>
            </div>
            <section className="panel upload-panel" aria-labelledby="proofTitle">
              <h2 id="proofTitle">Upload transaction screenshot</h2>
              <p>After transferring the advance, upload a clear screenshot of the successful transaction. The image is stored privately for order review.</p>
              <form onSubmit={submitOrder}>
                <label className="file-picker" htmlFor="transactionProof">
                  <span>Choose transaction screenshot</span>
                  <input
                    id="transactionProof"
                    name="transactionProof"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
                <p className="file-help">{file ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB` : "PNG, JPG, or WebP · maximum 5 MB"}</p>
                <button className="primary-button" type="submit" disabled={!canSubmit}>{busy ? "Submitting order…" : "Place order"}</button>
              </form>
              <p className="status-message" data-error={String(isError)} role="status" aria-live="polite">{status}</p>
            </section>
          </>
        )}

        {confirmation && (
          <section className="panel confirmation-panel" aria-labelledby="confirmationTitle">
            <h2 id="confirmationTitle">Order submitted for review</h2>
            <p>Your payment screenshot has been received. Woven Jewels will review the advance before accepting your order.</p>
            <p className="order-reference">Order {confirmation.id} · {formatRupees(confirmation.total)}</p>
            <a className="secondary-button" href="./index.html#collections">Continue shopping</a>
          </section>
        )}
        {!draft && !confirmation && (
          <p className="status-message" data-error="true" role="alert">
            Checkout details are missing. Return to checkout and enter your delivery details again.
          </p>
        )}
      </main>
      <footer className="site-footer">
        © {new Date().getFullYear()} Woven Jewels · <a href="./admin.html">Admin sign-in</a>
      </footer>
    </>
  );
}
