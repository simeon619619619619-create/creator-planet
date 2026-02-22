import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/contexts/AuthContext';
import { UserRole } from '../../core/types';
import { getDefaultRedirectPath } from '../../App';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallback
}) => {
  const { user, role, isLoading } = useAuth();
  const navigate = useNavigate();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, show fallback or nothing (parent will handle showing login)
  if (!user) {
    return fallback ? <>{fallback}</> : null;
  }

  // If allowedRoles is specified, check if user's role is allowed
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">
            You don't have permission to access this section.
          </p>
          <p className="text-slate-500 text-sm mt-2">
            Required role: {allowedRoles.join(' or ')}
          </p>
          <p className="text-slate-500 text-sm">
            Your role: {role}
          </p>
          <button
            onClick={() => navigate(getDefaultRedirectPath(role))}
            className="mt-6 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
          >
            Go to my homepage
          </button>
        </div>
      </div>
    );
  }

  // User is authenticated and has the right role
  return <>{children}</>;
};

export default ProtectedRoute;
