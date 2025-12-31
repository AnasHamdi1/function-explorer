// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// const firebaseConfig = {
//   apiKey: "AIzaSyA0jsLGWWHeZ7h_HUqtZNHQlWICKwe1lAI",
//   authDomain: "function-explorer-36c20.firebaseapp.com",
//   projectId: "function-explorer-36c20",
//   storageBucket: "function-explorer-36c20.firebasestorage.app",
//   messagingSenderId: "790014930384",
//   appId: "1:790014930384:web:048e53100c55bc6ddfddd5",
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 2️⃣ Your Firebase configuration (from the console)
const firebaseConfig = {
  apiKey: "AIzaSyA0jsLGWWHeZ7h_HUqtZNHQlWICKwe1lAI",
  authDomain: "function-explorer-36c20.firebaseapp.com",
  projectId: "function-explorer-36c20",
  storageBucket: "function-explorer-36c20.firebasestorage.app",
  messagingSenderId: "790014930384",
  appId: "1:790014930384:web:048e53100c55bc6ddfddd5",
};

// 3️⃣ Initialize Firebase (connect your app to Firebase)
const app = initializeApp(firebaseConfig);

// 4️⃣ Export Auth and Database so other files can use them
export const auth = getAuth(app);
export const db = getFirestore(app);
