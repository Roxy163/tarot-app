import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OnboardingProvider } from './context/OnboardingContext';
import { registerServiceWorker } from './lib/registerServiceWorker';
import './index.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <OnboardingProvider>
      <App />
    </OnboardingProvider>
  </ErrorBoundary>
);
