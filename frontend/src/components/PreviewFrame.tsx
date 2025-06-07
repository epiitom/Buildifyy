import React, { useEffect, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { FileItem } from '../types';

interface PreviewFrameProps {
  webContainer: WebContainer | null;
  files: FileItem[];
  isLoading?: boolean;
}

export function PreviewFrame({ webContainer, files, isLoading }: PreviewFrameProps) {
  const [url, setUrl] = useState<string>('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!webContainer || files.length === 0) return;

    async function startDevServer() {
      if (!webContainer) return;
      
      try {
        setIsStarting(true);
        setError(null);
        setUrl('');

        // First, mount the files to WebContainer
        console.log('Mounting files...');
        console.log('Files to mount:', files.map(f => ({ name: f.name, hasContent: !!f.content })));
        
        // Check if package.json exists
        const packageJsonFile = files.find(f => f.name === 'package.json' || f.name.endsWith('/package.json'));
        if (!packageJsonFile) {
          throw new Error('package.json file not found in the project files');
        }
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fileSystemTree: any = {};
        
        for (const file of files) {
          if (!file.content) {
            console.warn(`Skipping file ${file.name} - no content`);
            continue;
          }
          
          const pathParts = file.name.split('/').filter(Boolean); // Remove empty parts
          let current = fileSystemTree;
          
          // Create directory structure
          for (let i = 0; i < pathParts.length - 1; i++) {
            const dirName = pathParts[i];
            if (!current[dirName]) {
              current[dirName] = { directory: {} };
            }
            current = current[dirName].directory;
          }
          
          // Add the file
          const fileName = pathParts[pathParts.length - 1];
          current[fileName] = {
            file: {
              contents: file.content
            }
          };
        }
        
        console.log('File system tree structure:', Object.keys(fileSystemTree));
        
        await webContainer.mount(fileSystemTree);
        console.log('Files mounted successfully');

        // Verify package.json exists after mounting
        try {
          const packageJsonExists = await webContainer.fs.readFile('package.json', 'utf8');
          console.log('package.json verified:', !!packageJsonExists);
        } catch (err) {
          console.error('package.json verification failed:', err);
          throw new Error('package.json not found after mounting files');
        }

        // Install dependencies
        console.log('Installing dependencies...');
        const installProcess = await webContainer.spawn('npm', ['install']);
        
        // Create a promise to handle the install process
        const installPromise = new Promise<void>((resolve, reject) => {
          let output = '';
          
          installProcess.output.pipeTo(new WritableStream({
            write(data) {
              console.log('npm install:', data);
              output += data;
              
              // Check for specific error patterns
              if (data.includes('ENOENT') && data.includes('package.json')) {
                reject(new Error('package.json not found during npm install'));
              }
            }
          }));
          
          installProcess.exit.then(exitCode => {
            if (exitCode === 0) {
              resolve();
            } else {
              reject(new Error(`npm install failed with exit code ${exitCode}\nOutput: ${output}`));
            }
          }).catch(reject);
        });
        
        await installPromise;
        console.log('Dependencies installed successfully');

        // Start dev server
        console.log('Starting dev server...');
        const devProcess = await webContainer.spawn('npm', ['run', 'dev']);
        
        // Listen for server-ready event
        webContainer.on('server-ready', (port, serverUrl) => {
          console.log(`Server ready on port ${port}: ${serverUrl}`);
          setUrl(serverUrl);
          setIsStarting(false);
        });

        // Also listen to dev server output for fallback URL detection
        devProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log('dev server:', data);
            
            // Look for Vite dev server URL in output as fallback
            if (data.includes('Local:') && data.includes('http://')) {
              const lines = data.split('\n');
              for (const line of lines) {
                if (line.includes('Local:') && line.includes('http://')) {
                  const urlMatch = line.match(/http:\/\/[^\s]+/);
                  if (urlMatch && !url) {
                    console.log('Found dev server URL in output:', urlMatch[0]);
                    setUrl(urlMatch[0]);
                    setIsStarting(false);
                  }
                }
              }
            }
          }
        }));

        // Timeout fallback
        setTimeout(() => {
          if (!url && isStarting) {
            console.log('Server start timeout, checking for default URL...');
            // Try the default Vite dev server URL
            setUrl('http://localhost:5173');
            setIsStarting(false);
          }
        }, 30000); // 30 second timeout

      } catch (err) {
        console.error('Error starting dev server:', err);
        setError(err instanceof Error ? err.message : 'Failed to start development server');
        setIsStarting(false);
      }
    }

    startDevServer();
  }, [webContainer, files, url, isStarting]); // Added url and isStarting to dependencies

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="mb-2">Loading WebContainer...</p>
        </div>
      </div>
    );
  }

  if (!webContainer) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="mb-2">WebContainer not available</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-red-400">
        <div className="text-center">
          <p className="mb-2">Error: {error}</p>
          <button 
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => {
              setError(null);
              setUrl('');
              setIsStarting(false);
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isStarting) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="mb-2">Starting development server...</p>
          <div className="text-sm">This may take a moment</div>
          <div className="mt-2 text-xs">
            Installing dependencies and starting dev server...
          </div>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="mb-2">Waiting for server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center">
      <iframe 
        width="100%" 
        height="100%" 
        src={url}
        title="Preview"
        className="border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  );
}