// firebase-config.js
// SDK compat (sirve en HTML puro, GitHub Pages, sin bundlers)

const firebaseConfig = {
  apiKey: "AIzaSyDlOJqBgd-8KqUT-Y94lsma5W8T79PsPjM",
  authDomain: "trifusion-cotizador.firebaseapp.com",
  projectId: "trifusion-cotizador",
  storageBucket: "trifusion-cotizador.firebasestorage.app",
  messagingSenderId: "407374211882",
  appId: "1:407374211882:web:b692792ccc39c8d48f4c53"
};

// Inicializar Firebase (compat)
firebase.initializeApp(firebaseConfig);

// Accesos globales
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();
