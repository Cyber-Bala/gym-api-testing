import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';

interface SSEContextType {
  liveOccupancy: any | null;
  latestNotification: any | null;
}

const SSEContext = createContext<SSEContextType>({
  liveOccupancy: null,
  latestNotification: null,
});

export const useSSE = () => useContext(SSEContext);

export const SSEProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [liveOccupancy, setLiveOccupancy] = useState<any | null>(null);
  const [latestNotification, setLatestNotification] = useState<any | null>(null);

  useEffect(() => {
    if (!user) {
      setLiveOccupancy(null);
      setLatestNotification(null);
      return;
    }

    // Connect to backend SSE route
    const evtSource = new EventSource('/api/v1/sse', { withCredentials: true });

    evtSource.onmessage = (event) => {
      console.log('SSE message received (unhandled default):', event.data);
    };

    evtSource.addEventListener('connected', (event) => {
      console.log('SSE connected:', event.data);
    });

    evtSource.addEventListener('occupancy_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setLiveOccupancy(data);
      } catch (err) {
        console.error('Failed to parse occupancy_update SSE', err);
      }
    });

    evtSource.addEventListener('new_notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        setLatestNotification(data);
      } catch (err) {
        console.error('Failed to parse new_notification SSE', err);
      }
    });

    evtSource.onerror = (err) => {
      console.error('EventSource failed:', err);
    };

    return () => {
      evtSource.close();
    };
  }, [user]);

  return (
    <SSEContext.Provider value={{ liveOccupancy, latestNotification }}>
      {children}
    </SSEContext.Provider>
  );
};
