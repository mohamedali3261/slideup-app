import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/animations.css";

// Track visitor on page load (exclude admin)
const trackVisitor = async () => {
  try {
    // Check if user is admin
    const token = localStorage.getItem('token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Don't track admin visits
      if (payload.role === 'admin') {
        return;
      }
    }
    
    await fetch('/api/track-visitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageUrl: window.location.pathname,
        referrer: document.referrer
      })
    });
  } catch (error) {
    // Silently fail - don't block app
    console.log('Visitor tracking failed');
  }
};

// Track visitor
trackVisitor();

createRoot(document.getElementById("root")!).render(<App />);
