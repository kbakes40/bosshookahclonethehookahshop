// Cart Context - Neo-Brutalism meets Luxury Retail
// Manages shopping cart state across the application

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { Product } from "@/lib/products";

/** Matches Tailwind `md` (768px): viewports below this are treated as mobile for cart UX. */
function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export interface CartItem extends Product {
  quantity: number;
  selectedVariantId?: string; // Track which variant was selected
  selectedVariantName?: string; // Display name of the variant
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity: number, variantId?: string) => void;
  removeFromCart: (productId: string, variantId?: string) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void;
  /** Replace cart contents (e.g. restore Zelle checkout after refresh). */
  replaceCart: (items: CartItem[]) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addToCart = (product: Product, quantity: number, variantId?: string) => {
    setItems((prev) => {
      // Create a unique key combining product ID and variant ID
      const existingItem = prev.find(
        (item) => item.id === product.id && item.selectedVariantId === variantId
      );
      
      // Get variant name if variant ID is provided
      const variantName = variantId 
        ? product.variants?.find(v => v.id === variantId)?.name 
        : undefined;
      
      if (existingItem) {
        return prev.map((item) =>
          item.id === product.id && item.selectedVariantId === variantId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { 
        ...product, 
        quantity,
        selectedVariantId: variantId,
        selectedVariantName: variantName
      }];
    });
    
    // Haptic vibration feedback
    if ("vibrate" in navigator) {
      navigator.vibrate(50);
    }

    if (isMobileViewport()) {
      const line =
        quantity > 1 ? `${quantity} × ${product.name}` : product.name;
      const description = line.length > 52 ? `${line.slice(0, 49)}…` : line;
      toast.success("Added to cart", {
        description,
        duration: 2200,
      });
    } else {
      setIsOpen(true);
    }
  };

  const removeFromCart = (productId: string, variantId?: string) => {
    setItems((prev) => 
      prev.filter((item) => 
        !(item.id === productId && item.selectedVariantId === variantId)
      )
    );
  };

  const updateQuantity = (productId: string, quantity: number, variantId?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === productId && item.selectedVariantId === variantId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const replaceCart = useCallback((next: CartItem[]) => {
    setItems(next);
  }, []);

  const cartTotal = items.reduce(
    (sum, item) => sum + (item.salePrice || item.price) * item.quantity,
    0
  );

  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        replaceCart,
        clearCart,
        cartTotal,
        cartCount,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
