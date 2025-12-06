import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api';
import { Loader2 } from 'lucide-react';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const accessToken = searchParams.get('accessToken');
      const refreshToken = searchParams.get('refreshToken');
      const error = searchParams.get('error');

      if (error) {
        navigate('/login', { state: { error } });
        return;
      }

      if (accessToken && refreshToken) {
        try {
          // Get user info with the new tokens
          const user = await authApi.getMe();
          
          login({
            user,
            tokens: {
              accessToken,
              refreshToken,
              expiresIn: 900, // 15 minutes default
            },
          });
          
          navigate('/');
        } catch {
          navigate('/login', { state: { error: 'Authentication failed' } });
        }
      } else {
        navigate('/login', { state: { error: 'Invalid callback parameters' } });
      }
    };

    handleCallback();
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
