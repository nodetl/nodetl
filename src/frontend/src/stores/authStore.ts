import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types
export type ThemePreference = 'light' | 'dark' | 'system';
export type UserStatus = 'invited' | 'active' | 'inactive';

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  status: UserStatus;
  roleId: string;
  role?: Role;
  isActive: boolean;
  themePreference: ThemePreference;
  mustChangePassword: boolean;
  permissions: string[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
}

export interface AppSettings {
  projectName: string;
  logoUrl: string;
  faviconUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

interface AuthState {
  // User state
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // App settings (fetched from backend)
  appSettings: AppSettings | null;
  
  // Theme (resolved from user preference)
  theme: 'light' | 'dark';
  
  // Actions
  login: (response: LoginResponse) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setTokens: (tokens: TokenPair) => void;
  setAppSettings: (settings: AppSettings) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  updateThemePreference: (preference: ThemePreference) => void;
  setLoading: (loading: boolean) => void;
  
  // Permission helpers
  hasPermission: (resourceOrPermission: string, action?: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  
  // Initialize from stored tokens
  initialize: () => void;
}

// Resolve theme preference to actual theme
const resolveTheme = (preference: ThemePreference): 'light' | 'dark' => {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
};

// Apply theme to document
const applyTheme = (theme: 'light' | 'dark') => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      appSettings: null,
      theme: 'light',

      login: (response: LoginResponse) => {
        const theme = resolveTheme(response.user.themePreference);
        applyTheme(theme);
        
        set({
          user: response.user,
          accessToken: response.tokens.accessToken,
          refreshToken: response.tokens.refreshToken,
          isAuthenticated: true,
          isLoading: false,
          theme,
        });
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
        // Keep theme as is after logout
      },

      setUser: (user: User) => {
        const theme = resolveTheme(user.themePreference);
        applyTheme(theme);
        set({ user, theme });
      },

      setTokens: (tokens: TokenPair) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      },

      setAppSettings: (settings: AppSettings) => {
        set({ appSettings: settings });
        
        // Apply CSS variables for colors
        const root = document.documentElement;
        root.style.setProperty('--primary-color', settings.primaryColor);
        root.style.setProperty('--secondary-color', settings.secondaryColor);
        
        // Update favicon
        if (settings.faviconUrl) {
          const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (favicon) {
            favicon.href = settings.faviconUrl;
          }
        }
        
        // Update document title
        document.title = settings.projectName;
      },

      setTheme: (theme: 'light' | 'dark') => {
        applyTheme(theme);
        set({ theme });
      },

      updateThemePreference: (preference: ThemePreference) => {
        const { user } = get();
        if (user) {
          const theme = resolveTheme(preference);
          applyTheme(theme);
          set({
            user: { ...user, themePreference: preference },
            theme,
          });
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      hasPermission: (resourceOrPermission: string, action?: string) => {
        const { user } = get();
        const permission = action ? `${resourceOrPermission}:${action}` : resourceOrPermission;
        return user?.permissions?.includes(permission) ?? false;
      },

      hasAnyPermission: (...permissions: string[]) => {
        const { user } = get();
        if (!user?.permissions) return false;
        return permissions.some(p => user.permissions.includes(p));
      },

      hasAllPermissions: (...permissions: string[]) => {
        const { user } = get();
        if (!user?.permissions) return false;
        return permissions.every(p => user.permissions.includes(p));
      },

      initialize: () => {
        const state = get();
        
        // Apply theme immediately if user exists
        if (state.user) {
          const theme = resolveTheme(state.user.themePreference);
          applyTheme(theme);
          set({ theme, isLoading: false, isAuthenticated: !!state.accessToken });
        } else {
          // Check system preference for initial theme
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          applyTheme(systemTheme);
          set({ theme: systemTheme, isLoading: false });
        }
      },
    }),
    {
      name: 'nodetl-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        theme: state.theme,
      }),
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useAuthStore.getState();
    if (state.user?.themePreference === 'system') {
      const theme = e.matches ? 'dark' : 'light';
      applyTheme(theme);
      useAuthStore.setState({ theme });
    }
  });
}

// Permission constants (matching backend)
export const Permissions = {
  // Workflow
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_EDIT: 'workflow:edit',
  WORKFLOW_DELETE: 'workflow:delete',
  
  // Schema
  SCHEMA_VIEW: 'schema:view',
  SCHEMA_EDIT: 'schema:edit',
  SCHEMA_DELETE: 'schema:delete',
  
  // Node Type
  NODE_TYPE_VIEW: 'nodetype:view',
  NODE_TYPE_EDIT: 'nodetype:edit',
  NODE_TYPE_DELETE: 'nodetype:delete',
  
  // Mapping
  MAPPING_VIEW: 'mapping:view',
  MAPPING_EDIT: 'mapping:edit',
  MAPPING_DELETE: 'mapping:delete',
  
  // Execution
  EXECUTION_VIEW: 'execution:view',
  EXECUTION_DELETE: 'execution:delete',
  
  // Version
  VERSION_VIEW: 'version:view',
  VERSION_EDIT: 'version:edit',
  VERSION_DELETE: 'version:delete',
  
  // User Management
  USER_VIEW: 'user:view',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  
  // Role Management
  ROLE_VIEW: 'role:view',
  ROLE_EDIT: 'role:edit',
  ROLE_DELETE: 'role:delete',
  
  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
} as const;
