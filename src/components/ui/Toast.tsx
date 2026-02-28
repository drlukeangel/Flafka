import React from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import {
  FiCheckCircle,
  FiAlertCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
} from 'react-icons/fi';

const Toast: React.FC = () => {
  const { toasts, removeToast } = useWorkspaceStore();

  if (toasts.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <FiCheckCircle size={18} />;
      case 'error':
        return <FiAlertCircle size={18} />;
      case 'warning':
        return <FiAlertTriangle size={18} />;
      case 'info':
      default:
        return <FiInfo size={18} />;
    }
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">{getIcon(toast.type)}</span>
          <span className="toast-message">{toast.message}</span>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
          >
            <FiX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
