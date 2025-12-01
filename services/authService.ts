import { auth, googleProvider } from './firebaseConfig';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { User } from '../types';

export const authService = {
  // Transform Firebase user to App User
  transformUser(firebaseUser: FirebaseUser): User {
    return {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName || 'User',
      email: firebaseUser.email || '',
      photoURL: firebaseUser.photoURL || 'https://via.placeholder.com/100',
    };
  },

  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return this.transformUser(result.user);
    } catch (error) {
      console.error("Login Failed", error);
      throw error;
    }
  },

  async signOut(): Promise<void> {
    return firebaseSignOut(auth);
  },

  async loginAsGuest(): Promise<User> {
    return {
      uid: `guest_${Date.now()}`,
      displayName: 'Guest Explorer',
      email: '',
      photoURL: 'https://ui-avatars.com/api/?name=Guest+User&background=6366f1&color=fff',
    };
  },

  // Listener for auth state changes
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        callback(this.transformUser(firebaseUser));
      } else {
        callback(null);
      }
    });
  }
};