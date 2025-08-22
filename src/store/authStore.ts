import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<boolean>;
}

// Mock users for demo
const mockUsers: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
  { id: '2', name: 'John Doe', email: 'john@example.com', role: 'user' },
];

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  
  login: async (email: string, password: string) => {
    // Mock authentication
    const user = mockUsers.find(u => u.email === email);
    if (user && password === 'password') {
      set({ user, isAuthenticated: true });
      localStorage.setItem('auth_user', JSON.stringify(user));
      return true;
    }
    return false;
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false });
    localStorage.removeItem('auth_user');
  },
  
  register: async (name: string, email: string, password: string) => {
    // Mock registration
    const newUser: User = {
      id: Date.now().toString(),
      name,
      email,
      role: 'user'
    };
    mockUsers.push(newUser);
    set({ user: newUser, isAuthenticated: true });
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    return true;
  }
}));

// Initialize auth state from localStorage
const savedUser = localStorage.getItem('auth_user');
if (savedUser) {
  const user = JSON.parse(savedUser);
  useAuthStore.setState({ user, isAuthenticated: true });
}