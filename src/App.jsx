import { useEffect, useState } from "react";

const routes = {
  "/": () => import("./pages/HomePage.jsx"),
  "/index.html": () => import("./pages/HomePage.jsx"),
  "/index-static.html": () => import("./pages/HomePage.jsx"),
  "/react-app.html": () => import("./pages/HomePage.jsx"),
  "/collections.html": () => import("./pages/CollectionsPage.jsx"),
  "/our-story.html": () => import("./pages/StoryPage.jsx"),
  "/product-details.html": () => import("./pages/ProductPage.jsx"),
  "/order-summary.html": () => import("./pages/OrderSummaryPage.jsx"),
  "/checkout.html": () => import("./pages/CheckoutPage.jsx"),
  "/payment.html": () => import("./pages/PaymentPage.jsx"),
  "/admin.html": () => import("./pages/AdminPage.jsx")
};

export default function App() {
  const [Page, setPage] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    const loadPage = routes[window.location.pathname] || routes["/"];
    loadPage().then((module) => {
      if (active) setPage(() => module.default);
    }).catch((error) => {
      console.error("Could not load the Woven Jewels page.", error);
      if (active) setLoadError("This page could not be loaded. Please refresh and try again.");
    });
    return () => { active = false; };
  }, []);

  if (loadError) return <main role="alert">{loadError}</main>;
  if (!Page) return <main aria-live="polite">Loading Woven Jewels…</main>;
  return <Page />;
}
