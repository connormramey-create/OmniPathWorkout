/**
 * Firebase setup.
 *
 * These config values are meant to be public. They identify the project but do not grant access;
 * access is controlled by the Realtime Database rules in database.rules.json. Make sure those
 * rules are published (Firebase console → Realtime Database → Rules, or `firebase deploy --only database`).
 *
 * Uses the "compat" API (firebase.auth(), firebase.database()). It is bundled from npm, so
 * index.html does not need any <script> tags from gstatic.
 */
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/database";

const firebaseConfig = {
  apiKey: "AIzaSyA1fJ7pOsNQvmFQVXhFKji62c3TUbYfymg",
  authDomain: "omnipathworkout.firebaseapp.com",
  // Default URL for a US-hosted Realtime Database. If your database is in another region, copy the
  // URL shown at the top of the Realtime Database page in the Firebase console.
  databaseURL: "https://omnipathworkout-default-rtdb.firebaseio.com",
  projectId: "omnipathworkout",
  storageBucket: "omnipathworkout.firebasestorage.app",
  messagingSenderId: "868629854877",
  appId: "1:868629854877:web:2d7d74b54fc4e913e47274",
  measurementId: "G-9YDR5HP3DQ"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export const db = firebase.database();
