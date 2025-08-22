import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Layout/Header';
import { EnhancedPlotMap } from './components/Map/EnhancedPlotMap';
import { SupabaseAuthForm } from './components/Auth/SupabaseAuthForm';
import { UserDashboard } from './components/Dashboard/UserDashboard';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { useSupabaseAuth } from './hooks/useSupabaseAuth';
import { LoadingSpinner } from './components/UI/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ 
  children, 
  adminOnly = false 
}) => {
  const { isAuthenticated, isAdmin, loading } = useSupabaseAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  
  if (!isAuthenticated()) {
    return <Navigate to="/login" />;
  }
  
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

const MapPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="h-[calc(100vh-4rem)]">
        <EnhancedPlotMap />
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<SupabaseAuthForm mode="signin" />} />
        <Route path="/signup" element={<SupabaseAuthForm mode="signup" />} />
        <Route path="/" element={<MapPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-50">
                <Header />
                <UserDashboard />
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute adminOnly>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;