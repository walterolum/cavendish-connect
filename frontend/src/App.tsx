import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import AppRoutes from './routes/AppRoutes';
import { queryClient } from './lib/queryClient';
import { RealtimeBridge } from './components/realtime/RealtimeBridge';
import { CallManager } from './components/calls/CallManager';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        {/* Live messages, presence and calls on every page */}
        <RealtimeBridge />
        <CallManager />
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans', style: { borderRadius: '14px' } }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
