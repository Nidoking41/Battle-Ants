import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// TODO: Replace with your Firebase project configuration
// Get this from Firebase Console -> Project Settings -> General -> Your apps -> Firebase SDK snippet
const firebaseConfig = {
  apiKey: "AIzaSyAm_eP1oO4JRCw_g2LbA3M2JzbEw8Yyt2E",
  authDomain: "ants-a151c.firebaseapp.com",
  databaseURL: "https://ants-a151c-default-rtdb.firebaseio.com",
  projectId: "ants-a151c",
  storageBucket: "ants-a151c.firebasestorage.app",
  messagingSenderId: "153169207809",
  appId: "1:153169207809:web:55925d1a6d46fb41471600",
  measurementId: "G-H0G894F8BZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
