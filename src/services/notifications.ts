/**
 * Browser Notifications service.
 * Requests permission once; sends notifications when the window is not focused.
 */

let _permissionRequested = false;

export async function requestNotificationPermission(): Promise<boolean> {
  if (_permissionRequested) return Notification.permission === 'granted';
  _permissionRequested = true;

  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function sendAgentReplyNotification(
  agentName: string,
  agentEmoji: string,
  preview: string,
): void {
  if (document.hasFocus()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const body = preview.length > 100 ? preview.slice(0, 97) + '...' : preview;
  new Notification(`${agentEmoji} ${agentName} respondeu`, {
    body,
    icon: '/favicon.ico',
    tag: `agent-reply-${agentName}`, // replaces previous notification from the same agent
  });
}
