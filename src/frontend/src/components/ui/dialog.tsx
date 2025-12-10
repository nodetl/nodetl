import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// Dialog Context
interface DialogContextType {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | undefined>(undefined);

// Dialog Root
interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange: onOpenChange || (() => {}) }}>
      {children}
    </DialogContext.Provider>
  );
}

// Dialog Trigger
interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('DialogTrigger must be used within Dialog');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: () => context.onOpenChange(true),
    });
  }

  return (
    <button onClick={() => context.onOpenChange(true)}>
      {children}
    </button>
  );
}

// Dialog Content
interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function DialogContent({ children, className, onClose }: DialogContentProps) {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('DialogContent must be used within Dialog');

  const handleClose = () => {
    onClose?.();
    context.onOpenChange(false);
  };

  if (!context.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={handleClose}
      />
      {/* Content */}
      <div 
        className={cn(
          "relative z-50 w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          "border border-gray-200 dark:border-gray-700",
          className
        )}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

// Dialog Header
interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn("px-6 pt-6 pb-2", className)}>
      {children}
    </div>
  );
}

// Dialog Title
interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold text-gray-900 dark:text-white", className)}>
      {children}
    </h2>
  );
}

// Dialog Description
interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn("text-sm text-gray-500 dark:text-gray-400 mt-1", className)}>
      {children}
    </p>
  );
}

// Dialog Body
interface DialogBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return (
    <div className={cn("px-6 py-4", className)}>
      {children}
    </div>
  );
}

// Dialog Footer
interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn("px-6 pb-6 pt-2 flex justify-end gap-2", className)}>
      {children}
    </div>
  );
}

// ============================================
// Alert Dialog - For confirmations and alerts
// ============================================

type AlertVariant = 'info' | 'warning' | 'error' | 'success';

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: AlertVariant;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  isLoading?: boolean;
}

const variantConfig: Record<AlertVariant, { icon: typeof AlertTriangle; iconColor: string; buttonVariant: 'default' | 'destructive' }> = {
  info: { icon: Info, iconColor: 'text-blue-500', buttonVariant: 'default' },
  warning: { icon: AlertTriangle, iconColor: 'text-yellow-500', buttonVariant: 'default' },
  error: { icon: AlertCircle, iconColor: 'text-red-500', buttonVariant: 'destructive' },
  success: { icon: CheckCircle, iconColor: 'text-green-500', buttonVariant: 'default' },
};

export function AlertDialog({
  open,
  onOpenChange,
  variant = 'warning',
  title,
  description,
  children,
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  showCancel = true,
  isLoading = false,
}: AlertDialogProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={showCancel ? handleCancel : undefined}
      />
      {/* Content */}
      <div 
        className={cn(
          "relative z-50 w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
          "border border-gray-200 dark:border-gray-700"
        )}
      >
        <div className="p-6">
          <div className="flex gap-4 items-start">
            <div className={cn("flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full", 
              variant === 'error' && "bg-red-100 dark:bg-red-900/30",
              variant === 'warning' && "bg-yellow-100 dark:bg-yellow-900/30",
              variant === 'info' && "bg-blue-100 dark:bg-blue-900/30",
              variant === 'success' && "bg-green-100 dark:bg-green-900/30"
            )}>
              <Icon size={20} className={config.iconColor} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                {title}
              </h3>
              {description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {description}
                </p>
              )}
              {children && (
                <div className="mt-3">
                  {children}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            {showCancel && (
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                {cancelText}
              </Button>
            )}
            <Button 
              variant={config.buttonVariant} 
              onClick={handleConfirm} 
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================
// useConfirm hook - For easy confirm dialogs
// ============================================

interface ConfirmOptions {
  title: string;
  description?: string;
  variant?: AlertVariant;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  resolve: ((value: boolean) => void) | null;
}

export function useConfirm() {
  const [state, setState] = React.useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    variant: 'warning',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    resolve: null,
  });

  const confirm = React.useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        open: true,
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState((s) => ({ ...s, open: false, resolve: null }));
  }, [state.resolve]);

  const ConfirmDialog = React.useCallback(() => (
    <AlertDialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
      variant={state.variant}
      title={state.title}
      description={state.description}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  ), [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog };
}

// ============================================
// useAlert hook - For simple alert messages
// ============================================

interface AlertOptions {
  title: string;
  description?: string;
  variant?: AlertVariant;
  confirmText?: string;
}

interface AlertState extends AlertOptions {
  open: boolean;
}

export function useAlert() {
  const [state, setState] = React.useState<AlertState>({
    open: false,
    title: '',
    description: '',
    variant: 'info',
    confirmText: 'OK',
  });

  const alert = React.useCallback((options: AlertOptions) => {
    setState({
      open: true,
      ...options,
    });
  }, []);

  const handleClose = React.useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  const AlertDialogComponent = React.useCallback(() => (
    <AlertDialog
      open={state.open}
      onOpenChange={handleClose}
      variant={state.variant}
      title={state.title}
      description={state.description}
      confirmText={state.confirmText}
      showCancel={false}
      onConfirm={handleClose}
    />
  ), [state, handleClose]);

  return { alert, AlertDialog: AlertDialogComponent };
}
