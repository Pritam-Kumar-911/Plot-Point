// Advanced config.js
const CURRENT_VM_IP = window.location.hostname;

// If running locally on localhost without Docker, fall back to 3000. Otherwise, use 5000.
const PORT = (CURRENT_VM_IP === 'localhost' || CURRENT_VM_IP === '127.0.0.1') ? '3000' : '5000';

const API_BASE_URL = `http://${CURRENT_VM_IP}:${PORT}`;
