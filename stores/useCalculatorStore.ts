import { create } from 'zustand';
import Decimal from 'decimal.js';

type OrderSide = 'buy' | 'sell';
type OrderType = 'limit' | 'market';

interface CalculatorState {
  // Trading form
  side: OrderSide;
  orderType: OrderType;
  price: string;
  quantity: string;

  // Portfolio
  baseBalance: string; // BTC balance
  quoteBalance: string; // USDT balance

  // Actions
  setSide: (side: OrderSide) => void;
  setOrderType: (type: OrderType) => void;
  setPrice: (price: string) => void;
  setQuantity: (quantity: string) => void;

  // Calculated values
  getTotal: () => string;
  canExecute: () => boolean;

  // Execute trade (simulation)
  executeTrade: () => void;

  // Reset
  reset: () => void;
}

export const useCalculatorStore = create<CalculatorState>((set, get) => ({
  side: 'buy',
  orderType: 'limit',
  price: '',
  quantity: '',
  baseBalance: '1.0', // Starting with 1 BTC
  quoteBalance: '50000.0', // Starting with 50,000 USDT

  setSide: (side) => set({ side }),
  setOrderType: (orderType) => set({ orderType }),
  setPrice: (price) => set({ price }),
  setQuantity: (quantity) => set({ quantity }),

  getTotal: () => {
    const { price, quantity } = get();
    if (!price || !quantity) return '0';

    try {
      const priceDecimal = new Decimal(price);
      const quantityDecimal = new Decimal(quantity);
      return priceDecimal.mul(quantityDecimal).toFixed(2);
    } catch {
      return '0';
    }
  },

  canExecute: () => {
    const { side, price, quantity, baseBalance, quoteBalance, getTotal } = get();

    if (!quantity || !price) return false;

    try {
      const quantityDecimal = new Decimal(quantity);
      if (quantityDecimal.lte(0)) return false;

      if (side === 'buy') {
        const total = new Decimal(getTotal());
        const balance = new Decimal(quoteBalance);
        return total.lte(balance);
      } else {
        const balance = new Decimal(baseBalance);
        return quantityDecimal.lte(balance);
      }
    } catch {
      return false;
    }
  },

  executeTrade: () => {
    const { side, quantity, canExecute, getTotal, baseBalance, quoteBalance } = get();

    if (!canExecute()) return;

    try {
      const quantityDecimal = new Decimal(quantity);
      const total = new Decimal(getTotal());

      if (side === 'buy') {
        // Buy: decrease USDT, increase BTC
        set({
          baseBalance: new Decimal(baseBalance).plus(quantityDecimal).toFixed(8),
          quoteBalance: new Decimal(quoteBalance).minus(total).toFixed(2),
          quantity: '',
        });
      } else {
        // Sell: decrease BTC, increase USDT
        set({
          baseBalance: new Decimal(baseBalance).minus(quantityDecimal).toFixed(8),
          quoteBalance: new Decimal(quoteBalance).plus(total).toFixed(2),
          quantity: '',
        });
      }
    } catch (error) {
      console.error('Error executing trade:', error);
    }
  },

  reset: () => set({
    side: 'buy',
    orderType: 'limit',
    price: '',
    quantity: '',
    baseBalance: '1.0',
    quoteBalance: '50000.0',
  }),
}));
