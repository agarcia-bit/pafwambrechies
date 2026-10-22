import { useState } from 'react';

/** Spinner state for a pull-to-refresh that only shows when the member pulls. */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }
  return { refreshing, onRefresh };
}
