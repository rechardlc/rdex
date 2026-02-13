'use client';

import { KlineChartProvider } from '@/lib/kline';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <KlineChartProvider>{children}</KlineChartProvider>;
}
