import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { invitationsApi, settingsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

type PageState = 'loading' | 'valid' | 'invalid' | 'accepted' | 'error';

export function InviteAcceptPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { appSettings, setAppSettings } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load app settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsApi.getPublic();
        setAppSettings(settings);
      } catch {
        // Ignore
      }
    };
    loadSettings();
  }, [setAppSettings]);

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setPageState('invalid');
        setError('No invitation token provided.');
        return;
      }

      try {
        await invitationsApi.validate(token);
        setPageState('valid');
      } catch {
        setPageState('invalid');
        setError('This invitation is invalid or has expired.');
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      await invitationsApi.accept(token!, password, name || undefined);
      setPageState('accepted');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to accept invitation. Please try again.');
      setPageState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Validating invitation...</p>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto text-red-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Invalid Invitation
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
            <Button
              onClick={() => navigate('/login')}
              className="mt-6"
            >
              Go to Login
            </Button>
          </div>
        );

      case 'accepted':
        return (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              Account Created!
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Your account has been created successfully. You can now sign in.
            </p>
            <Button
              onClick={() => navigate('/login')}
              className="mt-6"
            >
              Sign In
            </Button>
          </div>
        );

      case 'error':
      case 'valid':
        return (
          <form onSubmit={handleSubmit} className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white text-center">
              Complete Your Account
            </h3>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name (optional)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        );
    }
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
              <div className="h-16 w-16 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">N</span>
              </div>
            )}
          </div>
          
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
            {appSettings?.projectName || 'NodeTL'}
          </h2>
        </div>

        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
