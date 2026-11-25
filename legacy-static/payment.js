import { createSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const config = window.WOVEN_JEWELS_CONFIG;
const cartKey = "woven-jewels-cart";
const draftKey = "woven-jewels-checkout-draft";
const pendingOrderKey = "woven-jewels-pending-payment";
const formatRupees = (amount) => `Rs. ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(amount)}`;

const form = document.querySelector("#paymentForm");
const fileInput = document.querySelector("#transactionProof");
const fileHelp = document.querySelector("#fileHelp");
const submitButton = document.querySelector("#placeOrder");
const statusMessage = document.querySelector("#paymentStatus");
const confirmation = document.querySelector("#confirmation");
const orderReference = document.querySelector("#orderReference");
let startupError = "";
let cart = [];
let draft = null;
try {
  cart = readCart();
  draft = readDraft();
} catch (error) {
  startupError = error.message;
  console.error("Could not restore the pending Woven Jewels checkout.", error);
}

function readCart() {
  const saved = localStorage.getItem(cartKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((item) =>
      !item || typeof item.id !== "string" || typeof item.name !== "string" ||
      !Number.isSafeInteger(item.price) || item.price < 0
    )) {
      throw new Error("Saved cart data is not a valid list of jewelry items.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not read the saved Woven Jewels cart.", error);
    throw new Error("Your saved cart could not be read. Return to your order summary and try again.");
  }
}

function readDraft() {
  const saved = sessionStorage.getItem(draftKey);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (!parsed.customer || typeof parsed.customer !== "object") {
      throw new Error("Saved checkout details are invalid.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not read the saved checkout details.", error);
    throw new Error("Your checkout details could not be read. Please return to checkout and enter them again.");
  }
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.dataset.error = String(isError);
}

function renderBill() {
  const billItems = document.querySelector("#billItems");
  billItems.replaceChildren();
  const grouped = new Map();
  cart.forEach((product) => {
    const key = `${product.id}:${product.price}`;
    const current = grouped.get(key);
    if (current) current.quantity += 1;
    else grouped.set(key, { ...product, quantity: 1 });
  });

  grouped.forEach((product) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${product.name} × ${product.quantity}`;
    const price = document.createElement("span");
    price.textContent = formatRupees(product.price * product.quantity);
    row.append(label, price);
    billItems.append(row);
  });

  const subtotal = cart.reduce((sum, product) => sum + product.price, 0);
  const shipping = cart.length ? 200 : 0;
  const total = subtotal + shipping;
  const advance = Math.round(total * 50) / 100;
  document.querySelector("#subtotal").textContent = formatRupees(subtotal);
  document.querySelector("#shipping").textContent = formatRupees(shipping);
  document.querySelector("#total").textContent = formatRupees(total);
  document.querySelector("#advance").textContent = formatRupees(advance);
  document.querySelector("#codBalance").textContent = formatRupees(total - advance);
  return { subtotal, shipping, total, advance };
}

function renderAccount() {
  const account = config && config.paymentAccount;
  document.querySelector("#bankName").textContent = account?.bankName || "Not configured";
  document.querySelector("#accountTitleValue").textContent = account?.accountTitle || "Not configured";
  document.querySelector("#accountNumber").textContent = account?.accountNumber || "Not configured";
  const ready = Boolean(
    account &&
    account.ready === true &&
    [account.bankName, account.accountTitle, account.accountNumber]
      .every((value) => typeof value === "string" && value.trim().length > 0)
  );
  document.querySelector("#demoWarning").hidden = ready;
  return ready;
}

function getFingerprint() {
  return JSON.stringify({
    customer: draft.customer,
    productIds: cart.map((product) => product.id)
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
  const randomPart = crypto.randomUUID
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) => value.toString(16)).join("");
  return `${orderId}/${randomPart}.${extension}`;
}

function showConfirmation(id, total) {
  form.hidden = true;
  document.querySelector(".workflow-grid").hidden = true;
  document.querySelector("#demoWarning").hidden = true;
  confirmation.hidden = false;
  orderReference.textContent = `Order ${id} · ${formatRupees(total)}`;
}

async function submitOrder(event) {
  event.preventDefault();
  setStatus("");
  const file = fileInput.files[0];
  if (!file) {
    setStatus("Select a transaction screenshot before placing your order.", true);
    fileInput.focus();
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setStatus("The screenshot is larger than 5 MB. Choose a smaller image.", true);
    fileInput.focus();
    return;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    setStatus("Choose a JPG, PNG, or WebP screenshot.", true);
    fileInput.focus();
    return;
  }
  if (!cart.length || !draft) {
    setStatus("Your order or checkout details are missing. Return to checkout and try again.", true);
    return;
  }
  if (!renderAccount()) {
    setStatus("Live order submission is disabled until real payment account details are configured.", true);
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting order…";
  try {
    const client = await createSupabaseClient();
    const fingerprint = getFingerprint();
    let pending = null;
    const savedPending = sessionStorage.getItem(pendingOrderKey);
    if (savedPending) {
      try {
        pending = JSON.parse(savedPending);
      } catch (error) {
        console.error("Could not read the pending Woven Jewels order.", error);
        throw new Error("A pending order could not be verified. Clear this tab's session storage and restart checkout.");
      }
    }

    let orderId = pending && pending.fingerprint === fingerprint ? pending.id : null;
    let total = bill.total;
    if (!orderId) {
      const { data, error } = await client.rpc("wj_create_order", {
        p_customer: draft.customer,
        p_items: cart.map((product) => ({ id: product.id }))
      });
      if (error) throw error;
      const createdOrder = Array.isArray(data) ? data[0] : data;
      if (!createdOrder || !createdOrder.order_id) {
        throw new Error("The order service did not return an order reference.");
      }
      orderId = createdOrder.order_id;
      total = Number(createdOrder.total);
      sessionStorage.setItem(pendingOrderKey, JSON.stringify({ id: orderId, fingerprint }));
    }

    setStatus("Uploading your transaction screenshot…");
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

    sessionStorage.setItem("woven-jewels-last-order", JSON.stringify({ id: orderId, total }));
    sessionStorage.removeItem(pendingOrderKey);
    sessionStorage.removeItem(draftKey);
    localStorage.removeItem(cartKey);
    showConfirmation(orderId, total);
  } catch (error) {
    console.error("Could not submit the Woven Jewels order.", error);
    setStatus(`Your order was not submitted: ${error.message || "The payment service returned an unexpected error."}`, true);
  } finally {
    if (confirmation.hidden) {
      submitButton.disabled = false;
      submitButton.textContent = "Place order";
    }
  }
}

document.querySelector("#year").textContent = String(new Date().getFullYear());
const bill = renderBill();
const accountReady = renderAccount();
let lastOrder = null;
try {
  lastOrder = sessionStorage.getItem("woven-jewels-last-order");
} catch (error) {
  startupError = "This browser cannot restore session data. Return to checkout and try again.";
  console.error("Could not read the last Woven Jewels order reference.", error);
}
if (lastOrder && !cart.length) {
  try {
    const previous = JSON.parse(lastOrder);
    showConfirmation(previous.id, previous.total);
  } catch (error) {
    console.error("Could not restore the last order confirmation.", error);
    setStatus("The last order confirmation could not be restored.", true);
  }
} else if (startupError) {
  setStatus(startupError, true);
} else if (!cart.length || !draft) {
  setStatus("Add items to your bag and complete checkout details before starting payment.", true);
} else if (!isSupabaseConfigured()) {
  setStatus("Setup required: add the Supabase project URL and public anon key to site-config.js.", true);
} else if (!accountReady) {
  setStatus("Demo only: configure real payment account details before accepting transfers.", true);
}

submitButton.disabled = Boolean(startupError) || !cart.length || !draft || !isSupabaseConfigured() || !accountReady;
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  fileHelp.textContent = file
    ? `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`
    : "PNG, JPG, or WebP · maximum 5 MB";
});
form.addEventListener("submit", submitOrder);
