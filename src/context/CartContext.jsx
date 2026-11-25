import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const CART_KEY = "woven-jewels-cart";
const CartContext = createContext(null);

function readCart() {
  const saved = window.localStorage.getItem(CART_KEY);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some((item) =>
      !item || typeof item.id !== "string" || typeof item.name !== "string" ||
      !Number.isSafeInteger(item.price) || item.price < 0
    )) {
      throw new Error("Saved cart data is invalid.");
    }
    return parsed;
  } catch (error) {
    console.error("Could not read the saved Woven Jewels cart.", error);
    window.localStorage.removeItem(CART_KEY);
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(readCart);

  useEffect(() => {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("woven-jewels-cart-change"));
  }, [items]);

  const addItems = useCallback((products) => {
    const updated = [...items, ...products.map(({ id, name, price }) => ({ id, name, price }))];
    window.localStorage.setItem(CART_KEY, JSON.stringify(updated));
    setItems(updated);
  }, [items]);

  const removeOne = useCallback((id, price) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id && item.price === price);
      return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
    });
  }, []);

  const removeAll = useCallback((id, price) => {
    setItems((current) => current.filter((item) => item.id !== id || item.price !== price));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, addItems, removeOne, removeAll, clearCart }), [
    items, addItems, removeOne, removeAll, clearCart
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider.");
  return value;
}

export function formatRupees(amount, decimals = 0) {
  return `Rs. ${new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(amount)}`;
}
