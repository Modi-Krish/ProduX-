import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './app/store';
import App from './App';
import { VoiceProvider } from './features/voice/VoiceProvider';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <VoiceProvider>
        <App />
      </VoiceProvider>
    </Provider>
  </StrictMode>
);
