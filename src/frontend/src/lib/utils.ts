import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Debounce function for delayed execution
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

// Generate short unique ID (8 characters)
// Uses timestamp (base36) + random chars for uniqueness
export function generateId(): string {
  const timestamp = Date.now().toString(36); // ~8 chars
  const random = Math.random().toString(36).substring(2, 6); // 4 chars
  return `${timestamp.slice(-4)}${random}`; // 8 chars total
}

// Generate UUID v4 (for cases that need full UUID)
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getNodeColor(type: string): string {
  const colors: Record<string, string> = {
    trigger: '#10B981',
    transform: '#8B5CF6',
    http: '#3B82F6',
    condition: '#F59E0B',
    loop: '#EC4899',
    code: '#6366F1',
    delay: '#64748B',
    email: '#EF4444',
    webhook: '#10B981',
  };
  return colors[type] || '#6B7280';
}

export function getNodeIcon(type: string): string {
  const icons: Record<string, string> = {
    trigger: 'play',
    transform: 'shuffle',
    http: 'globe',
    condition: 'git-branch',
    loop: 'repeat',
    code: 'code',
    delay: 'clock',
    email: 'mail',
    webhook: 'webhook',
  };
  return icons[type] || 'box';
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}
