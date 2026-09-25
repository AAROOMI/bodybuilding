import React, { useEffect, useState } from 'react';

export default function App() {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Intercept network/unhandled promise errors from external scripts gracefully
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('Suppressed external network promise rejection:', event.reason);
      event.preventDefault();
      event.stopPropagation();
    };

    const handleGlobalError = (event: ErrorEvent) => {
      console.warn('Suppressed external network error:', event.message || event.error);
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    window.addEventListener('error', handleGlobalError, true);

    // Remove any previously appended script tag to ensure a fresh clean mount
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-name="did-agent"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Create and attach new script tag
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://agent.d-id.com/v2/index.js';
    script.setAttribute('data-mode', 'full');
    script.setAttribute('data-client-key', 'ck_ieSspm5EwqvoYgTVG0ENU');
    script.setAttribute('data-agent-id', 'v2_agt_l6tELcmR');
    script.setAttribute('data-name', 'did-agent');
    script.setAttribute('data-monitor', 'true');
    script.setAttribute('data-light-mode', 'false');
    script.setAttribute('data-target-id', 'did-container');
    script.setAttribute('data-api-url', window.location.origin + '/api/did');

    script.onerror = (err) => {
      console.warn('D-ID Agent script failed to load:', err);
      setHasError(true);
    };

    script.onload = () => {
      setHasError(false);
    };

    document.head.appendChild(script);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.removeEventListener('error', handleGlobalError, true);
    };
  }, [retryCount]);

  const handleRetry = () => {
    setHasError(false);
    setRetryCount((prev) => prev + 1);
  };

  return (
    <div id="kiosk">
      <div id="did-container"></div>
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-50 p-6 text-center">
          <p className="text-lg font-medium mb-4">Unable to connect to D-ID Agent service.</p>
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}



