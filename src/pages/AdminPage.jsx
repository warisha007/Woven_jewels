import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRupees } from "../context/CartContext.jsx";
import { requireSupabase, supabaseConfigured } from "../lib/supabase.js";
import "../styles/admin.css";

const adminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase() || "wisha0007@gmail.com";
const pageSize = 100;

function getAddress(customer = {}) {
  return [
    customer.streetAddress,
    customer.apartment,
    customer.fullAddress,
    [customer.city, customer.region, customer.country].filter(Boolean).join(", ")
  ].filter(Boolean).join(" · ");
}

function escapeCsvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export default function AdminPage() {
  const [supabase, setSupabase] = useState(null);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [ordersUnavailable, setOrdersUnavailable] = useState(false);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeView, setActiveView] = useState("orders");
  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [rejectingOrderId, setRejectingOrderId] = useState("");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState("");
  const loadingRef = useRef(false);
  const authorized = session?.user?.email?.toLowerCase() === adminEmail;

  const showStatus = useCallback((message, isError = false) => {
    setStatus(message);
    setStatusError(isError);
  }, []);

  useEffect(() => {
    document.title = "Woven Jewels Admin Dashboard";
    if (!supabaseConfigured) {
      showStatus("Setup required: configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.", true);
      return undefined;
    }

    const client = requireSupabase();
    setSupabase(client);
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Could not restore the Woven Jewels admin session.", error);
        showStatus(`Could not restore your sign-in: ${error.message}`, true);
        return;
      }
      setSession(data.session);
    }).catch((error) => {
      if (!active) return;
      console.error("Could not restore the Woven Jewels admin session.", error);
      showStatus(`Could not restore your sign-in: ${error.message || "Unexpected error."}`, true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [showStatus]);

  useEffect(() => {
    if (!session || authorized || !supabase) return;
    const email = session.user.email || "an unknown user";
    supabase.auth.signOut().then(({ error }) => {
      if (error) {
        console.error("Could not sign out an unauthorized Woven Jewels user.", error);
        showStatus(`Only ${adminEmail} is authorized. Sign-out failed: ${error.message}`, true);
        return;
      }
      showStatus(`Signed in as ${email}, but only ${adminEmail} is authorized.`, true);
    }).catch((error) => {
      console.error("Could not sign out an unauthorized Woven Jewels user.", error);
      showStatus(`Only ${adminEmail} is authorized. Sign-out failed: ${error.message || "Unexpected error."}`, true);
    });
  }, [authorized, session, showStatus, supabase]);

  const loadOrders = useCallback(async () => {
    if (!supabase || !authorized || loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    showStatus("Loading orders…");
    try {
      const collected = [];
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase
          .from("wj_orders")
          .select("id,customer,items,subtotal,shipping,total,advance_amount,cod_balance,payment_status,order_status,fulfillment_status,proof_path,created_at")
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        collected.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      const activities = collected.length
        ? await supabase
          .from("wj_order_activity")
          .select("id,order_id,activity_type,content,created_by,created_at")
          .in("order_id", collected.map((order) => order.id))
          .order("created_at", { ascending: false })
        : { data: [], error: null };
      if (activities.error) throw activities.error;
      const activitiesByOrder = new Map();
      (activities.data || []).forEach((activity) => {
        const orderActivities = activitiesByOrder.get(activity.order_id) || [];
        orderActivities.push(activity);
        activitiesByOrder.set(activity.order_id, orderActivities);
      });

      const withProofs = await Promise.all(collected.map(async (order) => {
        const activity = activitiesByOrder.get(order.id) || [];
        if (!order.proof_path) return { ...order, proofUrl: "", proofError: "" };
        const { data, error } = await supabase.storage
          .from("wj-payment-proofs")
          .createSignedUrl(order.proof_path, 300);
        if (error) {
          console.error(`Could not create a private proof link for order ${order.id}.`, error);
          return { ...order, activity, proofUrl: "", proofError: `Could not load the transaction screenshot: ${error.message}` };
        }
        return { ...order, activity, proofUrl: data.signedUrl, proofError: "" };
      }));
      setOrders(withProofs.map((order) => ({
        ...order,
        activity: activitiesByOrder.get(order.id) || []
      })));
      setOrdersUnavailable(false);
      showStatus(collected.length ? "Orders loaded." : "No orders have been submitted yet.");
    } catch (error) {
      console.error("Could not load Woven Jewels orders.", error);
      setOrdersUnavailable(true);
      const missingSchema = error.code === "PGRST205" || error.code === "42P01";
      showStatus(
        missingSchema
          ? `CRM database setup is incomplete. In Supabase SQL Editor, run 20261118153000_payment_orders.sql, then 20261124010000_admin_crm.sql, then 20261124230000_order_rejections.sql. Supabase reports: ${error.message}`
          : `Orders could not be loaded: ${error.message || "The order service returned an unexpected error."}`,
        true
      );
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [authorized, showStatus, supabase]);

  useEffect(() => {
    if (authorized) loadOrders();
  }, [authorized, loadOrders]);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesFilter = filter === "all" ||
        (filter === "needs-review" && order.order_status === "pending" && order.payment_status === "pending_review") ||
        (filter === "awaiting-proof" && order.order_status === "pending" && order.payment_status === "awaiting_proof") ||
        (filter === "accepted" && order.order_status === "accepted") ||
        (filter === "rejected" && order.order_status === "rejected") ||
        (["processing", "ready_to_ship", "shipped", "delivered"].includes(filter) &&
          order.fulfillment_status === filter);
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      const customer = order.customer || {};
      return [
        order.id,
        customer.fullName,
        customer.email,
        customer.contactNumber,
        customer.city,
        customer.region
      ].join(" ").toLowerCase().includes(normalizedQuery);
    });
  }, [filter, orders, query]);

  const metrics = useMemo(() => {
    const pendingReview = orders.filter((order) =>
      order.order_status === "pending" && order.payment_status === "pending_review"
    );
    const accepted = orders.filter((order) => order.order_status === "accepted");
    const rejected = orders.filter((order) => order.order_status === "rejected");
    const customerEmails = new Set(orders.map((order) =>
      String(order.customer?.email || order.customer?.contactNumber || order.customer?.fullName || order.id).trim().toLowerCase()
    ));
    const delivered = orders.filter((order) => order.fulfillment_status === "delivered");
    return {
      all: orders.length,
      review: pendingReview.length,
      accepted: accepted.length,
      rejected: rejected.length,
      customers: customerEmails.size,
      delivered: delivered.length,
      advance: pendingReview.reduce((sum, order) => sum + Number(order.advance_amount || 0), 0),
      value: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      sales: accepted.reduce((sum, order) => sum + Number(order.total || 0), 0),
      cod: accepted.reduce((sum, order) => sum + Number(order.cod_balance || 0), 0)
    };
  }, [orders]);

  const customers = useMemo(() => {
    const grouped = new Map();
    orders.forEach((order) => {
      const details = order.customer || {};
      const key = String(details.email || details.contactNumber || details.fullName || order.id).trim().toLowerCase();
      const customer = grouped.get(key) || {
        id: key,
        details,
        orders: [],
        totalSpent: 0,
        latestOrder: order.created_at
      };
      customer.orders.push(order);
      customer.totalSpent += Number(order.total || 0);
      if (new Date(order.created_at) > new Date(customer.latestOrder)) customer.latestOrder = order.created_at;
      grouped.set(key, customer);
    });
    return [...grouped.values()].sort((first, second) =>
      new Date(second.latestOrder).getTime() - new Date(first.latestOrder).getTime()
    );
  }, [orders]);

  const visibleCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();
    if (!normalizedQuery) return customers;
    return customers.filter(({ details }) => [
      details.fullName, details.email, details.contactNumber, details.city, details.region
    ].join(" ").toLowerCase().includes(normalizedQuery));
  }, [customerQuery, customers]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  async function signIn(event) {
    event.preventDefault();
    showStatus("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("adminEmail") || "").trim().toLowerCase();
    const password = String(formData.get("adminPassword") || "");
    const form = event.currentTarget;
    if (email !== adminEmail) {
      showStatus(`Only the configured admin email (${adminEmail}) can sign in.`, true);
      return;
    }
    try {
      const client = requireSupabase();
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      form.reset();
      showStatus("Signed in. Loading your orders…");
    } catch (error) {
      console.error("Could not sign in to the Woven Jewels admin dashboard.", error);
      showStatus(`Sign-in failed: ${error.message || "Check your admin email and password."}`, true);
    }
  }

  async function signOut() {
    try {
      const client = requireSupabase();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setOrders([]);
      showStatus("Signed out.");
    } catch (error) {
      console.error("Could not sign out of the Woven Jewels admin dashboard.", error);
      showStatus(`Sign-out failed: ${error.message || "Unexpected error."}`, true);
    }
  }

  async function runOrderAction(order, action) {
    const procedure = action === "approve-payment" ? "wj_approve_payment" : "wj_accept_order";
    setActionId(`${order.id}:${action}`);
    showStatus(action === "approve-payment" ? "Approving payment…" : "Accepting order…");
    try {
      const client = requireSupabase();
      const { error } = await client.rpc(procedure, { p_order_id: order.id });
      if (error) throw error;
      showStatus(action === "approve-payment" ? "Payment approved." : "Order accepted.");
      await loadOrders();
    } catch (error) {
      console.error(`Could not run ${procedure} for order ${order.id}.`, error);
      showStatus(`The order could not be updated: ${error.message || "The order service returned an unexpected error."}`, true);
    } finally {
      setActionId("");
    }
  }

  async function rejectOrder(event, order) {
    event.preventDefault();
    const form = event.currentTarget;
    const reason = String(new FormData(form).get("reason") || "").trim();
    if (!reason) {
      showStatus("Enter a reason before rejecting this order.", true);
      return;
    }

    setActionId(`${order.id}:reject`);
    showStatus("Rejecting order…");
    try {
      const client = requireSupabase();
      const { error } = await client.rpc("wj_reject_order", {
        p_order_id: order.id,
        p_reason: reason
      });
      if (error) throw error;
      setRejectingOrderId("");
      showStatus(order.payment_status === "approved"
        ? "Order rejected. Refund the approved advance manually outside this website."
        : "Order rejected.");
      await loadOrders();
    } catch (error) {
      console.error(`Could not reject order ${order.id}.`, error);
      const message = error.code === "PGRST202"
        ? "Supabase's API schema cache cannot find wj_reject_order. Re-run the order-rejections migration in the same project, then retry."
        : error.message || "Unexpected error.";
      showStatus(`The order was not rejected: ${message}`, true);
    } finally {
      setActionId("");
    }
  }

  async function updateFulfillment(order, nextStatus) {
    if (nextStatus === order.fulfillment_status) return;
    setActionId(`${order.id}:fulfillment`);
    showStatus("Updating fulfillment status…");
    try {
      const client = requireSupabase();
      const { error } = await client.rpc("wj_update_fulfillment_status", {
        p_order_id: order.id,
        p_status: nextStatus
      });
      if (error) throw error;
      showStatus("Fulfillment status updated.");
      await loadOrders();
    } catch (error) {
      console.error(`Could not update fulfillment for order ${order.id}.`, error);
      showStatus(`Fulfillment was not updated: ${error.message || "Unexpected error."}`, true);
    } finally {
      setActionId("");
    }
  }

  async function addOrderNote(event, order) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(noteDrafts[order.id] || "").trim();
    if (!note) {
      showStatus("Enter a note before saving.", true);
      return;
    }
    setActionId(`${order.id}:note`);
    showStatus("Saving internal note…");
    try {
      const client = requireSupabase();
      const { error } = await client.rpc("wj_add_order_note", {
        p_order_id: order.id,
        p_note: note
      });
      if (error) throw error;
      setNoteDrafts((current) => ({ ...current, [order.id]: "" }));
      form.reset();
      showStatus("Internal note saved.");
      await loadOrders();
    } catch (error) {
      console.error(`Could not save an internal note for order ${order.id}.`, error);
      showStatus(`Note was not saved: ${error.message || "Unexpected error."}`, true);
    } finally {
      setActionId("");
    }
  }

  function exportOrders() {
    const rows = [
      ["Order ID", "Submitted", "Customer", "Email", "Phone", "Address", "Items", "Subtotal", "Shipping", "Total", "Advance", "COD balance", "Payment status", "Order status", "Fulfillment status"],
      ...visibleOrders.map((order) => {
        const customer = order.customer || {};
        const lineItems = (order.items || []).map((item) => `${item.name} x ${item.quantity}`).join("; ");
        return [
          order.id,
          new Date(order.created_at).toISOString(),
          customer.fullName || "",
          customer.email || "",
          customer.contactNumber || "",
          getAddress(customer),
          lineItems,
          order.subtotal,
          order.shipping,
          order.total,
          order.advance_amount,
          order.cod_balance,
          order.payment_status,
          order.order_status,
          order.fulfillment_status
        ];
      })
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `woven-jewels-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href="./index.html" aria-label="Woven Jewels home">
          <span className="brand-symbol" aria-hidden="true" />
          <span className="brand-wordmark" aria-hidden="true" />
        </a>
        <a className="back-link" href="./index.html">← Storefront</a>
      </header>
      <main className="page-shell">
        <p className="eyebrow">Woven Jewels · internal</p>
        <div className="dashboard-heading">
          <div>
            <h1>Admin dashboard</h1>
            <p className="intro">Track incoming orders, review payments, and manage fulfillment.</p>
          </div>
          {authorized && (
            <div className="dashboard-actions">
              <button className="secondary-button" type="button" onClick={loadOrders} disabled={loading}>Refresh orders</button>
              <button className="secondary-button" type="button" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>

        <p className="status-message" data-error={String(statusError)} role="status" aria-live="polite">{status}</p>

        {!authorized && (
          <section className="panel login-panel" aria-labelledby="loginTitle">
            <h2 id="loginTitle">Admin sign-in</h2>
            <p>Sign in with your authorized Woven Jewels admin account.</p>
            <form onSubmit={signIn}>
              <label htmlFor="adminEmail">Admin email</label>
              <input id="adminEmail" name="adminEmail" type="email" autoComplete="email" defaultValue={adminEmail} required />
              <label htmlFor="adminPassword">Password</label>
              <input id="adminPassword" name="adminPassword" type="password" autoComplete="current-password" required />
              <button className="primary-button" type="submit" disabled={!supabaseConfigured}>Sign in</button>
            </form>
          </section>
        )}

        {authorized && (
          <section aria-label="CRM dashboard">
            {ordersUnavailable ? (
              <section className="panel crm-setup-error" role="alert">
                <h2>Finish Supabase database setup</h2>
                <p>The admin account is signed in, but the CRM tables or migration are missing. Run the migrations in order:</p>
                <ol>
                  <li><code>supabase/migrations/20261118153000_payment_orders.sql</code></li>
                  <li><code>supabase/migrations/20261124010000_admin_crm.sql</code></li>
                  <li><code>supabase/migrations/20261124230000_order_rejections.sql</code></li>
                </ol>
                <p>Then select <strong>Refresh orders</strong>.</p>
              </section>
            ) : <>
            <div className="dashboard-metrics" aria-live="polite">
              <article className="metric-card"><span>All orders</span><strong>{metrics.all}</strong><small>Every request received</small></article>
              <article className="metric-card"><span>Needs review</span><strong>{metrics.review}</strong><small>Payment proofs waiting</small></article>
              <article className="metric-card"><span>Accepted orders</span><strong>{metrics.accepted}</strong><small>Ready for fulfillment</small></article>
              <article className="metric-card"><span>Rejected orders</span><strong>{metrics.rejected}</strong><small>Kept in CRM history</small></article>
              <article className="metric-card"><span>Customers</span><strong>{metrics.customers}</strong><small>Unique customer records</small></article>
              <article className="metric-card"><span>Delivered</span><strong>{metrics.delivered}</strong><small>Fulfilled orders</small></article>
              <article className="metric-card"><span>Advance to review</span><strong>{formatRupees(metrics.advance)}</strong><small>Pending payment proofs</small></article>
              <article className="metric-card"><span>Order value</span><strong>{formatRupees(metrics.value)}</strong><small>All submitted requests</small></article>
              <article className="metric-card"><span>Accepted sales</span><strong>{formatRupees(metrics.sales)}</strong><small>Accepted orders only</small></article>
              <article className="metric-card"><span>COD to collect</span><strong>{formatRupees(metrics.cod)}</strong><small>Accepted order balances</small></article>
            </div>
            <div className="crm-tabs" role="tablist" aria-label="CRM sections">
              <button type="button" role="tab" aria-selected={activeView === "orders"} onClick={() => setActiveView("orders")}>Orders</button>
              <button type="button" role="tab" aria-selected={activeView === "customers"} onClick={() => setActiveView("customers")}>Customers ({customers.length})</button>
            </div>
            {activeView === "orders" && <>
            <div className="list-heading">
              <h2 id="ordersTitle">Orders</h2>
              <p className="list-count">{visibleOrders.length} of {orders.length} {orders.length === 1 ? "order" : "orders"}</p>
            </div>
            <div className="order-tools">
              <label className="search-control" htmlFor="orderSearch">
                <span>Search orders</span>
                <input id="orderSearch" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order ID, customer, email, phone…" />
              </label>
              <label className="filter-control" htmlFor="orderFilter">
                <span>Show</span>
                <select id="orderFilter" value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">All orders</option>
                  <option value="needs-review">Needs payment review</option>
                  <option value="awaiting-proof">Awaiting screenshot</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="processing">Processing</option>
                  <option value="ready_to_ship">Ready to ship</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </label>
              <button className="secondary-button" type="button" onClick={exportOrders}>Export visible CSV</button>
            </div>
            <div className="order-list">
              {visibleOrders.map((order) => {
                const customer = order.customer || {};
                const working = actionId.startsWith(`${order.id}:`);
                return (
                  <article className="order-card" key={order.id}>
                    <div>
                      <h3>Order {order.id}</h3>
                      <p className="order-meta">Submitted {new Date(order.created_at).toLocaleString()}</p>
                      <div className="status-badges">
                        <span className="status-badge">Payment: {order.payment_status.replaceAll("_", " ")}</span>
                        <span className="status-badge">Order: {order.order_status}</span>
                        <span className="status-badge">Fulfillment: {(order.fulfillment_status || "pending").replaceAll("_", " ")}</span>
                      </div>
                      <p className="customer-details">
                        {customer.fullName || "Customer"} · {customer.email || "No email"} · {customer.contactNumber || "No phone"}
                        {getAddress(customer) ? ` · ${getAddress(customer)}` : ""}
                      </p>
                      <ul className="order-products">
                        {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                          <li key={`${item.id || item.name}-${index}`}>{item.name} × {item.quantity} · {formatRupees(item.unitPrice * item.quantity)}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <dl className="order-totals">
                        {[
                          ["Subtotal", order.subtotal],
                          ["Shipping", order.shipping],
                          ["Total", order.total],
                          ["Advance (50%)", order.advance_amount],
                          ["Balance due on delivery", order.cod_balance]
                        ].map(([label, amount]) => (
                          <div key={label}><dt>{label}</dt><dd>{formatRupees(amount)}</dd></div>
                        ))}
                      </dl>
                      {order.proofUrl ? (
                        <>
                          <a className="proof-link" href={order.proofUrl} target="_blank" rel="noopener noreferrer">Open transaction screenshot</a>
                          <img className="proof-preview" src={order.proofUrl} alt={`Transaction screenshot for order ${order.id}`} />
                        </>
                      ) : (
                        <p className="proof-error">{order.proofError || "No transaction proof is attached."}</p>
                      )}
                      <div className="order-actions">
                        <button
                          className="primary-button"
                          type="button"
                          disabled={working || order.order_status !== "pending" || order.payment_status !== "pending_review" || !order.proof_path}
                          onClick={() => runOrderAction(order, "approve-payment")}
                        >{actionId === `${order.id}:approve-payment` ? "Approving payment…" : "Approve payment"}</button>
                        <button
                          className="primary-button"
                          type="button"
                          disabled={working || order.payment_status !== "approved" || order.order_status !== "pending"}
                          onClick={() => runOrderAction(order, "accept-order")}
                        >{actionId === `${order.id}:accept-order` ? "Accepting order…" : "Accept order"}</button>
                        {order.order_status === "pending" && (
                          <button
                            className="reject-button"
                            type="button"
                            disabled={working}
                            aria-expanded={rejectingOrderId === order.id}
                            aria-controls={`reject-form-${order.id}`}
                            onClick={() => {
                              if (rejectingOrderId === order.id) {
                                setRejectingOrderId("");
                                showStatus("Rejection canceled.");
                              } else {
                                setRejectingOrderId(order.id);
                                showStatus("Enter a rejection reason, then select Confirm rejection.");
                              }
                            }}
                          >
                            {rejectingOrderId === order.id ? "Close rejection form" : "Reject order"}
                          </button>
                        )}
                      </div>
                      {rejectingOrderId === order.id && (
                        <form id={`reject-form-${order.id}`} className="reject-form" onSubmit={(event) => rejectOrder(event, order)}>
                          <label htmlFor={`reject-reason-${order.id}`}>Reason for rejection (required)</label>
                          <textarea
                            id={`reject-reason-${order.id}`}
                            name="reason"
                            required
                            maxLength={2000}
                            rows={3}
                            autoFocus
                            placeholder="Explain why this order cannot be accepted."
                          />
                          {order.payment_status === "approved" && (
                            <p className="refund-warning">
                              The 50% advance has been approved. Rejecting this request does not issue a refund; refund the customer manually outside this website.
                            </p>
                          )}
                          <div>
                            <button className="reject-button" type="submit" disabled={working}>
                              {actionId === `${order.id}:reject` ? "Rejecting order…" : "Confirm rejection"}
                            </button>
                          </div>
                        </form>
                      )}
                      <label className="fulfillment-control">
                        <span>Fulfillment stage</span>
                        <select
                          value={order.fulfillment_status || "pending"}
                          disabled={working || order.order_status !== "accepted" || order.payment_status !== "approved"}
                          onChange={(event) => updateFulfillment(order, event.target.value)}
                        >
                          <option value="pending">Awaiting fulfillment</option>
                          <option value="processing">Processing</option>
                          <option value="ready_to_ship">Ready to ship</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                        </select>
                      </label>
                      <section className="order-activity" aria-label={`Internal timeline for order ${order.id}`}>
                        <h4>Internal timeline</h4>
                        {order.activity?.length ? (
                          <ol>
                            {order.activity.map((entry) => (
                              <li key={entry.id}>
                                <span className="activity-label">
                                  {entry.activity_type === "note"
                                    ? "Note"
                                    : entry.activity_type === "order_rejected"
                                      ? "Order rejected"
                                      : "Fulfillment"} · {entry.created_by}
                                </span>
                                <p>{entry.activity_type === "fulfillment_status" ? entry.content.replaceAll("_", " ") : entry.content}</p>
                                <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                              </li>
                            ))}
                          </ol>
                        ) : <p className="activity-empty">No notes or status updates yet.</p>}
                        <form className="note-form" onSubmit={(event) => addOrderNote(event, order)}>
                          <label htmlFor={`note-${order.id}`}>Add internal note</label>
                          <textarea
                            id={`note-${order.id}`}
                            value={noteDrafts[order.id] || ""}
                            maxLength={2000}
                            rows={3}
                            placeholder="Record a customer follow-up or order detail…"
                            onChange={(event) => setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                          />
                          <button className="secondary-button" type="submit" disabled={working || !noteDrafts[order.id]?.trim()}>
                            {actionId === `${order.id}:note` ? "Saving…" : "Save note"}
                          </button>
                        </form>
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
            {!visibleOrders.length && <p className="empty-orders">No orders match this view.</p>}
            </>}
            {activeView === "customers" && (
              <section className="customer-crm" aria-label="Customer directory">
                <div className="customer-directory">
                  <div className="list-heading">
                    <h2>Customer directory</h2>
                    <p className="list-count">{visibleCustomers.length} of {customers.length} customers</p>
                  </div>
                  <label className="search-control customer-search" htmlFor="customerSearch">
                    <span>Search customers</span>
                    <input id="customerSearch" type="search" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Name, email, phone, city…" />
                  </label>
                  <div className="customer-list">
                    {visibleCustomers.map((customer) => (
                      <button
                        className={`customer-row${selectedCustomerId === customer.id ? " is-selected" : ""}`}
                        key={customer.id}
                        type="button"
                        onClick={() => setSelectedCustomerId(customer.id)}
                      >
                        <span><strong>{customer.details.fullName || "Customer"}</strong><small>{customer.details.email || customer.details.contactNumber || "No contact details"}</small></span>
                        <span><strong>{customer.orders.length} orders</strong><small>{formatRupees(customer.totalSpent)} total</small></span>
                      </button>
                    ))}
                    {!visibleCustomers.length && <p className="empty-orders">No customers match this search.</p>}
                  </div>
                </div>
                <aside className="customer-profile">
                  {selectedCustomer ? (
                    <>
                      <p className="eyebrow">Customer profile</p>
                      <h2>{selectedCustomer.details.fullName || "Customer"}</h2>
                      <p>{selectedCustomer.details.email || "No email address"}</p>
                      <p>{selectedCustomer.details.contactNumber || "No phone number"}</p>
                      <p>{getAddress(selectedCustomer.details) || "No address on file"}</p>
                      <dl>
                        <div><dt>Orders</dt><dd>{selectedCustomer.orders.length}</dd></div>
                        <div><dt>Lifetime order value</dt><dd>{formatRupees(selectedCustomer.totalSpent)}</dd></div>
                        <div><dt>Last order</dt><dd>{new Date(selectedCustomer.latestOrder).toLocaleDateString()}</dd></div>
                      </dl>
                      <h3>Order history</h3>
                      <ul>
                        {selectedCustomer.orders.map((order) => (
                          <li key={order.id}>
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                            <strong>{formatRupees(order.total)}</strong>
                            <small>{order.payment_status.replaceAll("_", " ")} · {order.order_status} · {(order.fulfillment_status || "pending").replaceAll("_", " ")}</small>
                          </li>
                        ))}
                      </ul>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setQuery(selectedCustomer.details.email || selectedCustomer.details.contactNumber || "");
                          setFilter("all");
                          setActiveView("orders");
                        }}
                      >
                        View these orders
                      </button>
                    </>
                  ) : (
                    <p>Select a customer to review contact details and order history.</p>
                  )}
                </aside>
              </section>
            )}
            </>}
          </section>
        )}
      </main>
      <footer className="site-footer">
        © {new Date().getFullYear()} Woven Jewels · Payment proofs are private and visible only to authorized admins.
      </footer>
    </>
  );
}
