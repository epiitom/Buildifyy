import { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';

// Global singleton instance
let globalWebContainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export function useWebContainer() {
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple initializations
    if (mountedRef.current) return;
    mountedRef.current = true;

    async function initWebContainer() {
      try {
        // If we already have a global instance, use it
        if (globalWebContainerInstance) {
          setWebContainer(globalWebContainerInstance);
          setIsLoading(false);
          return;
        }

        // If boot is already in progress, wait for it
        if (bootPromise) {
          const instance = await bootPromise;
          setWebContainer(instance);
          setIsLoading(false);
          return;
        }

        // Start booting a new instance
        setIsLoading(true);
        bootPromise = WebContainer.boot();
        
        const instance = await bootPromise;
        globalWebContainerInstance = instance;
        setWebContainer(instance);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to boot WebContainer:', err);
        setError(err instanceof Error ? err.message : 'Failed to boot WebContainer');
        setIsLoading(false);
        // Reset the boot promise so we can try again
        bootPromise = null;
      }
    }

    initWebContainer();

    // Cleanup function
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { webContainer, isLoading, error };
}