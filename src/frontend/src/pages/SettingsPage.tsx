import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Upload, X, Palette, Type, Globe, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { settingsApi } from '@/api';
import { useAuthStore } from '@/stores/authStore';

interface AppSettings {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultTheme: 'light' | 'dark' | 'system';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'NodeTL',
    logoUrl: '',
    primaryColor: '#3b82f6',
    secondaryColor: '#6366f1',
    defaultTheme: 'system',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasPermission('settings', 'view')) {
      navigate('/403');
      return;
    }
    fetchSettings();
  }, [hasPermission, navigate]);

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.getFull() as any;
      setSettings({
        appName: response.appName || response.projectName || 'NodeTL',
        logoUrl: response.logoUrl || '',
        primaryColor: response.primaryColor || '#3b82f6',
        secondaryColor: response.secondaryColor || '#6366f1',
        defaultTheme: response.defaultTheme || 'system',
      });
      setPreviewLogo(response.logoUrl || null);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!hasPermission('settings', 'edit')) {
      setError('You do not have permission to edit settings');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await settingsApi.update(settings);
      setSuccess('Settings saved successfully');
      
      // Apply CSS variables for colors
      document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      document.documentElement.style.setProperty('--secondary-color', settings.secondaryColor);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size must be less than 2MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreviewLogo(dataUrl);
        setSettings((prev) => ({ ...prev, logoUrl: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setPreviewLogo(null);
    setSettings((prev) => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="mr-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Settings className="w-8 h-8 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
            {success}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Branding Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Branding
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  value={settings.appName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettings((prev) => ({ ...prev, appName: e.target.value }))
                  }
                  placeholder="Enter application name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex items-start gap-4">
                  {previewLogo ? (
                    <div className="relative">
                      <img
                        src={previewLogo}
                        alt="Logo preview"
                        className="w-20 h-20 object-contain rounded border border-gray-200 dark:border-gray-600"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex items-center justify-center">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload Logo
                    </Button>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Recommended: 200x200px, max 2MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Colors Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Colors
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    id="primaryColor"
                    value={settings.primaryColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    className="w-10 h-10 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSettings((prev) => ({ ...prev, primaryColor: e.target.value }))
                    }
                    placeholder="#3b82f6"
                    className="font-mono"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    id="secondaryColor"
                    value={settings.secondaryColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSettings((prev) => ({ ...prev, secondaryColor: e.target.value }))
                    }
                    className="w-10 h-10 rounded border border-gray-200 dark:border-gray-600 cursor-pointer"
                  />
                  <Input
                    value={settings.secondaryColor}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setSettings((prev) => ({ ...prev, secondaryColor: e.target.value }))
                    }
                    placeholder="#6366f1"
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Color Preview */}
            <div className="mt-4">
              <Label>Preview</Label>
              <div className="mt-2 flex gap-2">
                <Button
                  style={{ backgroundColor: settings.primaryColor }}
                  className="text-white"
                >
                  Primary Button
                </Button>
                <Button
                  style={{ backgroundColor: settings.secondaryColor }}
                  className="text-white"
                >
                  Secondary Button
                </Button>
              </div>
            </div>
          </div>

          {/* Theme Section */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Default Theme
              </h2>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Set the default theme for new users
              </p>
              <ThemeSwitcher />
            </div>
          </div>

          {/* Save Button */}
          <div className="p-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
