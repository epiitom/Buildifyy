import { WebContainer } from '@webcontainer/api';
import React, { useEffect, useState } from 'react';

interface PreviewFrameProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  files: any[];
  webContainer: WebContainer;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function PreviewFrame({ files, webContainer }: PreviewFrameProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    async function main() {
      try {
        // Set up the event listener BEFORE starting the dev server
        webContainer.on('server-ready', (port, url) => {
          console.log('Server ready:', { port, url });
          setUrl(url);
        });

        // Install dependencies
        const installProcess = await webContainer.spawn('npm', ['install']);
        
        installProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log(data);
          }
        }));

        // Wait for installation to complete
        await installProcess.exit;

        // Start the dev server (and await it)
        const devProcess = await webContainer.spawn('npm', ['run', 'dev']);
        
        // Optionally pipe dev server output
        devProcess.output.pipeTo(new WritableStream({
          write(data) {
            console.log(data);
          }
        }));

      } catch (error) {
        console.error('Error starting preview:', error);
      }
    }

    main();
  }, [webContainer]); // Add webContainer to dependencies

  return (
    <div className="h-full flex items-center justify-center text-gray-400">
      {!url && (
        <div className="text-center">
          <p className="mb-2">Loading...</p>
        </div>
      )}
      {url && <iframe width="100%" height="100%" src={url} />}
    </div>
  );
}