import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authApi, settingsApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Loader2, Chrome, Building } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, appSettings, setAppSettings } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  // Get redirect path from location state
  const from = (location.state as { from?: string })?.from || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Load app settings and OAuth providers
  useEffect(() => {
    const loadData = async () => {
      try {
        const [settings, providers] = await Promise.all([
          settingsApi.getPublic(),
          authApi.getOAuthProviders(),
        ]);
        setAppSettings(settings);
        setOauthProviders(providers.providers);
      } catch {
        // Ignore errors
      }
    };
    loadData();
  }, [setAppSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password);
      login(response);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    // Redirect to OAuth endpoint
    window.location.href = `/api/v1/auth/${provider}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            {appSettings?.logoUrl ? (
              <img 
                src={appSettings.logoUrl} 
                alt={appSettings.projectName} 
                className="h-16 w-auto"
              />
            ) : (
              <img 
                src="/logo.svg" 
                alt="NodeTL" 
                className="h-16 w-16"
              />
            )}
          </div>
          
          <h2 className="text-3xl font-extrabold text-white">
            {appSettings?.projectName || 'NodeTL'}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Visual Data Mapping & ETL Platform
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
            Sign in to your account
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2"
              style={{ backgroundColor: appSettings?.primaryColor }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </div>

          {/* OAuth providers */}
          {oauthProviders.length > 0 && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-50 dark:bg-gray-900 text-gray-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {oauthProviders.includes('google') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthLogin('google')}
                    className="w-full"
                  >
                    <Chrome className="w-5 h-5 mr-2" />
                    Google
                  </Button>
                )}
                {oauthProviders.includes('microsoft') && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthLogin('microsoft')}
                    className="w-full"
                  >
                    <Building className="w-5 h-5 mr-2" />
                    Microsoft
                  </Button>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
