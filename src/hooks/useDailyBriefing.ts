import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';

/**
 * Hook that checks every minute whether it's time to send the daily briefing.
 * Mounts once in App.tsx.
 */
export function useDailyBriefing() {
  const dailyBriefingEnabled = useStore((s) => s.dailyBriefingEnabled);
  const dailyBriefingTime = useStore((s) => s.dailyBriefingTime);
  const lastBriefingDate = useStore((s) => s.lastBriefingDate);
  const sendDailyBriefing = useStore((s) => s.sendDailyBriefing);
  const setLastBriefingDate = useStore((s) => s.setLastBriefingDate);

  // Keep a ref to always have the latest values inside the interval callback
  const stateRef = useRef({
    dailyBriefingEnabled,
    dailyBriefingTime,
    lastBriefingDate,
    sendDailyBriefing,
    setLastBriefingDate,
  });
  stateRef.current = {
    dailyBriefingEnabled,
    dailyBriefingTime,
    lastBriefingDate,
    sendDailyBriefing,
    setLastBriefingDate,
  };

  useEffect(() => {
    const id = setInterval(() => {
      const {
        dailyBriefingEnabled: enabled,
        dailyBriefingTime: time,
        lastBriefingDate: lastDate,
        sendDailyBriefing: send,
        setLastBriefingDate: setDate,
      } = stateRef.current;

      if (!enabled) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hh}:${mm}`;
      const today = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

      if (currentTime === time && lastDate !== today) {
        setDate(today);
        send();
      }
    }, 60_000); // check every minute

    return () => clearInterval(id);
  }, []); // intentionally empty — we use the ref
}
