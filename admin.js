import { createSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const config = window.WOVEN_JEWELS_CONFIG;
const loginPanel = document.querySelector("#loginPanel");
const loginForm = document.querySelector("#loginForm");
const adminStatus = document.querySelector("#adminStatus");
const dashboard = document.querySelector("#dashboard");
const dashboardActions = document.querySelector("#dashboardActions");
const ordersContainer = document.querySelector("#orders");
const emptyOrders = document.querySelector("#emptyOrders");
const orderCount = document.querySelector("#orderCount");
const signInButton = document.querySelector("#signIn");
const orderSearch = document.querySelector("#orderSearch");
const orderFilter = document.querySelector("#orderFilter");
let supabase;
let loadingOrders = false;
let allOrders = [];
let renderedOrders = [];

function setStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.dataset.error = String(isError);
}

function formatRupees(amount) {
  return `Rs. ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(Number(amount))}`;
}

function appendText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value;
  parent.append(element);
  return element;
}

function updateMetrics(orders) {
  const pendingReview = orders.filter((order) => order.payment_status === "pending_review").length;
  const pendingAdvance = orders
    .filter((order) => order.payment_status === "pending_review")
    .reduce((sum, order) => sum + Number(order.advance_amount || 0), 0);
  const accepted = orders.filter((order) => order.order_status === "accepted");
  document.querySelector("#metricAll").textContent = String(orders.length);
  document.querySelector("#metricReview").textContent = String(pendingReview);
  document.querySelector("#metricAccepted").textContent = String(accepted.length);
  document.querySelector("#metricAdvance").textContent = formatRupees(pendingAdvance);
  document.querySelector("#metricValue").textContent = formatRupees(
    orders.reduce((sum, order) => sum + Number(order.total || 0), 0)
  );
  document.querySelector("#metricSales").textContent = formatRupees(
    accepted.reduce((sum, order) => sum + Number(order.total || 0), 0)
  );
  document.querySelector("#metricCod").textContent = formatRupees(
    accepted.reduce((sum, order) => sum + Number(order.cod_balance || 0), 0)
  );
}

function getVisibleOrders() {
  const query = orderSearch.value.trim().toLowerCase();
  const filter = orderFilter.value;
  return allOrders.filter((order) => {
    const matchesFilter = filter === "all" ||
      (filter === "needs-review" && order.payment_status === "pending_review") ||
      (filter === "awaiting-proof" && order.payment_status === "awaiting_proof") ||
      (filter === "accepted" && order.order_status === "accepted");
    if (!matchesFilter) return false;
    if (!query) return true;
    const customer = order.customer || {};
    const searchable = [
      order.id,
      customer.fullName,
      customer.email,
      customer.contactNumber,
      customer.city,
      customer.region
    ].join(" ").toLowerCase();
    return searchable.includes(query);
  });
}

function renderVisibleOrders() {
  renderedOrders = getVisibleOrders();
  ordersContainer.replaceChildren();
  renderedOrders.forEach((order) => ordersContainer.append(order.card));
  orderCount.textContent = `${renderedOrders.length} of ${allOrders.length} ${
    allOrders.length === 1 ? "order" : "orders"
  }`;
  emptyOrders.hidden = renderedOrders.length !== 0;
}

function renderOrder(order, proofUrl, proofError) {
  const card = document.createElement("article");
  card.className = "order-card";
  const details = document.createElement("div");
  const actions = document.createElement("div");
  appendText(details, "h3", "", `Order ${order.id}`);
  appendText(details, "p", "order-meta", `Submitted ${new Date(order.created_at).toLocaleString()}`);

  const badges = document.createElement("div");
  badges.className = "status-badges";
  appendText(badges, "span", "status-badge", `Payment: ${order.payment_status.replaceAll("_", " ")}`);
  appendText(badges, "span", "status-badge", `Order: ${order.order_status}`);
  details.append(badges);

  const customer = order.customer || {};
  const address = [
    customer.streetAddress,
    customer.apartment,
    customer.fullAddress,
    [customer.city, customer.region, customer.country].filter(Boolean).join(", ")
  ].filter(Boolean).join(" · ");
  appendText(
    details,
    "p",
    "customer-details",
    `${customer.fullName || "Customer"} · ${customer.email || "No email"} · ${customer.contactNumber || "No phone"}${address ? ` · ${address}` : ""}`
  );

  const products = document.createElement("ul");
  products.className = "order-products";
  (Array.isArray(order.items) ? order.items : []).forEach((item) => {
    appendText(products, "li", "", `${item.name} × ${item.quantity} · ${formatRupees(item.unitPrice * item.quantity)}`);
  });
  details.append(products);

  const totals = document.createElement("dl");
  totals.className = "order-totals";
  [
    ["Subtotal", formatRupees(order.subtotal)],
    ["Shipping", formatRupees(order.shipping)],
    ["Total", formatRupees(order.total)],
    ["Advance (50%)", formatRupees(order.advance_amount)],
    ["Balance due on delivery", formatRupees(order.cod_balance)]
  ].forEach(([label, amount]) => {
    const row = document.createElement("div");
    appendText(row, "dt", "", label);
    appendText(row, "dd", "", amount);
    totals.append(row);
  });
  actions.append(totals);

  if (proofUrl) {
    const link = document.createElement("a");
    link.className = "proof-link";
    link.href = proofUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open transaction screenshot";
    actions.append(link);
    const preview = document.createElement("img");
    preview.className = "proof-preview";
    preview.src = proofUrl;
    preview.alt = `Transaction screenshot for order ${order.id}`;
    actions.append(preview);
  } else {
    appendText(actions, "p", "proof-error", proofError || "No transaction proof is attached.");
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "order-actions";
  const approve = document.createElement("button");
  approve.className = "primary-button";
  approve.type = "button";
  approve.dataset.action = "approve-payment";
  approve.dataset.orderId = order.id;
  approve.textContent = "Approve payment";
  approve.disabled = order.payment_status !== "pending_review" || !order.proof_path;

  const accept = document.createElement("button");
  accept.className = "primary-button";
  accept.type = "button";
  accept.dataset.action = "accept-order";
  accept.dataset.orderId = order.id;
  accept.textContent = "Accept order";
  accept.disabled = order.payment_status !== "approved" || order.order_status !== "pending";
  buttonRow.append(approve, accept);
  actions.append(buttonRow);
  card.append(details, actions);
  return card;
}

async function loadOrders() {
  if (loadingOrders) return;
  loadingOrders = true;
  setStatus("Loading orders…");
  try {
    const orders = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("wj_orders")
        .select("id,customer,items,subtotal,shipping,total,advance_amount,cod_balance,payment_status,order_status,proof_path,created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      orders.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    allOrders = await Promise.all(orders.map(async (order) => {
      let proofUrl = "";
      let proofError = "";
      if (order.proof_path) {
        const { data: signedProof, error: signedProofError } = await supabase.storage
          .from("wj-payment-proofs")
          .createSignedUrl(order.proof_path, 300);
        if (signedProofError) {
          console.error(`Could not create a private proof link for order ${order.id}.`, signedProofError);
          proofError = `Could not load the transaction screenshot: ${signedProofError.message}`;
        } else {
          proofUrl = signedProof.signedUrl;
        }
      }
      return {
        ...order,
        card: renderOrder(order, proofUrl, proofError)
      };
    }));
    updateMetrics(allOrders);
    renderVisibleOrders();
    setStatus(orders.length ? "Orders loaded." : "No orders have been submitted yet.");
  } catch (error) {
    console.error("Could not load Woven Jewels orders.", error);
    setStatus(`Orders could not be loaded: ${error.message || "The order service returned an unexpected error."}`, true);
  } finally {
    loadingOrders = false;
  }
}

async function showSession(session) {
  const isExpectedAdmin = session && session.user.email &&
    session.user.email.toLowerCase() === String(config.adminEmail).toLowerCase();
  loginPanel.hidden = Boolean(isExpectedAdmin);
  dashboard.hidden = !isExpectedAdmin;
  dashboardActions.hidden = !isExpectedAdmin;
  if (!session) return;
  if (!isExpectedAdmin) {
    await supabase.auth.signOut();
    setStatus(`Signed in as ${session.user.email || "an unknown user"}, but only ${config.adminEmail} is authorized.`, true);
    return;
  }
  await loadOrders();
}

async function signInAdmin(event) {
  event.preventDefault();
  setStatus("");
  const email = document.querySelector("#adminEmail").value.trim().toLowerCase();
  if (!email || email !== String(config.adminEmail).toLowerCase()) {
    setStatus(`Only the configured admin email (${config.adminEmail}) can sign in.`, true);
    return;
  }
  signInButton.disabled = true;
  signInButton.textContent = "Sending…";
  try {
    const password = document.querySelector("#adminPassword").value;
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    document.querySelector("#adminPassword").value = "";
    setStatus("Signed in. Loading your orders…");
  } catch (error) {
    console.error("Could not sign in to the Woven Jewels admin dashboard.", error);
    setStatus(`Sign-in failed: ${error.message || "Check your admin email and password."}`, true);
  } finally {
    signInButton.disabled = false;
    signInButton.textContent = "Sign in";
  }
}

function exportOrders() {
  const rows = [
    ["Order ID", "Submitted", "Customer", "Email", "Phone", "Address", "Items", "Subtotal", "Shipping", "Total", "Advance", "COD balance", "Payment status", "Order status"],
    ...renderedOrders.map((order) => {
      const customer = order.customer || {};
      const address = [
        customer.streetAddress,
        customer.apartment,
        customer.fullAddress,
        [customer.city, customer.region, customer.country].filter(Boolean).join(", ")
      ].filter(Boolean).join(" ");
      const items = (order.items || []).map((item) => `${item.name} x ${item.quantity}`).join("; ");
      return [
        order.id,
        new Date(order.created_at).toISOString(),
        customer.fullName || "",
        customer.email || "",
        customer.contactNumber || "",
        address,
        items,
        order.subtotal,
        order.shipping,
        order.total,
        order.advance_amount,
        order.cod_balance,
        order.payment_status,
        order.order_status
      ];
    })
  ];
  const escapeCell = (value) => {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const download = document.createElement("a");
  download.href = url;
  download.download = `woven-jewels-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleOrderAction(event) {
  const button = event.target.closest("button[data-action][data-order-id]");
  if (!button) return;
  const procedure = button.dataset.action === "approve-payment" ? "wj_approve_payment" : "wj_accept_order";
  const actionLabel = button.dataset.action === "approve-payment" ? "Approving payment…" : "Accepting order…";
  button.disabled = true;
  button.textContent = actionLabel;
  setStatus("");
  try {
    const { error } = await supabase.rpc(procedure, { p_order_id: button.dataset.orderId });
    if (error) throw error;
    setStatus(procedure === "wj_approve_payment" ? "Payment approved." : "Order accepted.");
    await loadOrders();
  } catch (error) {
    console.error(`Could not run ${procedure} for order ${button.dataset.orderId}.`, error);
    setStatus(`The order could not be updated: ${error.message || "The order service returned an unexpected error."}`, true);
    button.disabled = false;
    button.textContent = procedure === "wj_approve_payment" ? "Approve payment" : "Accept order";
  }
}

async function initialize() {
  document.querySelector("#year").textContent = String(new Date().getFullYear());
  document.querySelector("#adminEmail").value = config.adminEmail || "";
  if (!isSupabaseConfigured()) {
    signInButton.disabled = true;
    setStatus("Setup required: configure the Supabase project URL and public anon key in site-config.js.", true);
    return;
  }
  try {
    supabase = await createSupabaseClient();
    loginForm.addEventListener("submit", signInAdmin);
    ordersContainer.addEventListener("click", handleOrderAction);
    orderSearch.addEventListener("input", renderVisibleOrders);
    orderFilter.addEventListener("change", renderVisibleOrders);
    document.querySelector("#exportOrders").addEventListener("click", exportOrders);
    document.querySelector("#refreshOrders").addEventListener("click", loadOrders);
    document.querySelector("#signOut").addEventListener("click", async () => {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Could not sign out of the Woven Jewels admin dashboard.", error);
        setStatus(`Sign-out failed: ${error.message}`, true);
        return;
      }
      await showSession(null);
      setStatus("Signed out.");
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      void showSession(session);
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    await showSession(data.session);
  } catch (error) {
    console.error("Could not initialize the Woven Jewels admin dashboard.", error);
    setStatus(`Dashboard initialization failed: ${error.message || "Check the Supabase configuration."}`, true);
  }
}

initialize();
