import { Toaster, toast as sonnerToast } from 'sonner';
import { ToastContext, type Tom } from '../../contexts/ToastContext';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const empurrar = (msg: string, tom: Tom = 'info') => {
    switch (tom) {
      case 'sucesso':
        sonnerToast.success(msg);
        break;
      case 'erro':
        sonnerToast.error(msg);
        break;
      case 'alerta':
        sonnerToast.warning(msg);
        break;
      case 'info':
      default:
        sonnerToast.info(msg);
        break;
    }
  };

  return (
    <ToastContext.Provider value={empurrar}>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton 
        theme="system"
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
      {children}
    </ToastContext.Provider>
  );
}

export default ToastProvider;
