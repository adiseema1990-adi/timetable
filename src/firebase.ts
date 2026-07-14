import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY || "AIzaSyCjIeKi8BBgSRbfyK3Jz-N4z9su6mAIjcw",
  authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN || "time-table-smvce.firebaseapp.com",
  projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID || "time-table-smvce",
  storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET || "time-table-smvce.firebasestorage.app",
  messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1069634729183",
  appId: (import.meta as any).env.VITE_FIREBASE_APP_ID || "1:1069634729183:web:fe094e9aa9c4460c1de56a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

