import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { StepsList } from '../components/StepsList';
import { FileExplorer } from '../components/FileExplorer';
import { TabView } from '../components/TabView';
import { CodeEditor } from '../components/CodeEditor';
import { PreviewFrame } from '../components/PreviewFrame';
import type { Step, FileItem } from '../types';
import { StepType } from '../types';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { parseXml } from '../steps';
import { useWebContainer } from '../hooks/useWebContainer';
import { Loader } from '../components/Loader';

export function Builder() {
  const location = useLocation();
  const { prompt } = location.state as { prompt: string };
  const [userPrompt, setPrompt] = useState("");
  const [llmMessages, setLlmMessages] = useState<{role: "user" | "assistant", content: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateSet, setTemplateSet] = useState(false);
  
  // Use the updated hook
  const { webContainer, isLoading: webContainerLoading, error: webContainerError } = useWebContainer();

  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    const originalFiles = [...files];
    let updateHappened = false;
    
    steps.filter(({status}) => status === "pending").forEach(step => {
      updateHappened = true;
      if (step?.type === StepType.CreateFile) {
        const parsedPath = step.path?.split("/") ?? [];
        let currentFileStructure = [...originalFiles];
        const finalAnswerRef = currentFileStructure;

        let currentFolder = "";
        const pathCopy = [...parsedPath];
        
        while(pathCopy.length) {
          currentFolder = `${currentFolder}/${pathCopy[0]}`;
          const currentFolderName = pathCopy[0];
          pathCopy.splice(0, 1);

          if (!pathCopy.length) {
            // final file
            const existingFile = currentFileStructure.find(x => x.path === currentFolder);
            if (!existingFile) {
              currentFileStructure.push({
                name: currentFolderName,
                type: 'file',
                path: currentFolder,
                content: step.code
              });
            } else {
              existingFile.content = step.code;
            }
          } else {
            // in a folder
            const existingFolder = currentFileStructure.find(x => x.path === currentFolder);
            if (!existingFolder) {
              // create the folder
              currentFileStructure.push({
                name: currentFolderName,
                type: 'folder',
                path: currentFolder,
                children: []
              });
            }

            const foundFolder = currentFileStructure.find(x => x.path === currentFolder);
            if (foundFolder?.children) {
              currentFileStructure = foundFolder.children;
            }
          }
        }
        
        if (updateHappened) {
          setFiles(finalAnswerRef);
        }
      }
    });

    if (updateHappened) {
      setSteps(prevSteps => prevSteps.map((s: Step) => ({
        ...s,
        status: "completed" as const
      })));
    }
  }, [steps]);

  useEffect(() => {
    // Only mount files when webContainer is ready and we have files
    if (!webContainer || files.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createMountStructure = (files: FileItem[]): Record<string, any> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mountStructure: Record<string, any> = {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processFile = (file: FileItem, isRootFolder: boolean): any => {  
        if (file.type === 'folder') {
          const directoryContent = file.children ? 
            Object.fromEntries(
              file.children.map(child => [child.name, processFile(child, false)])
            ) 
            : {};
          
          if (isRootFolder) {
            mountStructure[file.name] = {
              directory: directoryContent
            };
          } else {
            return {
              directory: directoryContent
            };
          }
        } else if (file.type === 'file') {
          const fileContent = {
            file: {
              contents: file.content || ''
            }
          };
          
          if (isRootFolder) {
            mountStructure[file.name] = fileContent;
          } else {
            return fileContent;
          }
        }

        return mountStructure[file.name];
      };

      files.forEach(file => processFile(file, true));
      return mountStructure;
    };

    try {
      const mountStructure = createMountStructure(files);
      console.log('Mounting structure:', mountStructure);
      webContainer.mount(mountStructure);
    } catch (error) {
      console.error('Failed to mount files:', error);
    }
  }, [files, webContainer]);

  const init = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/template`, {
        prompt: prompt.trim()
      });
      setTemplateSet(true);
      
      const {prompts, uiPrompts} = response.data;

      setSteps(parseXml(uiPrompts[0]).map((x: Step) => ({
        ...x,
        status: "pending" as const
      })));

      setLoading(true);
      const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
        messages: [...prompts, prompt].map((content: string) => ({
          role: "user" as const,
          content
        }))
      });

      setLoading(false);

      setSteps(s => [...s, ...parseXml(stepsResponse.data.response).map((x: Step) => ({
        ...x,
        status: "pending" as const
      }))]);

      const initialMessages = [...prompts, prompt].map((content: string) => ({
        role: "user" as const,
        content
      }));
      
      setLlmMessages(initialMessages);
      setLlmMessages(x => [...x, {role: "assistant", content: stepsResponse.data.response}]);
    } catch (error) {
      console.error('Initialization failed:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    init();
  }, []);

  const handleSendMessage = async () => {
    if (!userPrompt.trim()) return;
    
    const newMessage = {
      role: "user" as const,
      content: userPrompt
    };

    try {
      setLoading(true);
      const stepsResponse = await axios.post(`${BACKEND_URL}/chat`, {
        messages: [...llmMessages, newMessage]
      });
      
      setLlmMessages(x => [...x, newMessage, {
        role: "assistant",
        content: stepsResponse.data.response
      }]);
      
      setSteps(s => [...s, ...parseXml(stepsResponse.data.response).map((x: Step) => ({
        ...x,
        status: "pending" as const
      }))]);
      
      setPrompt("");
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  // Show error if WebContainer failed to load
  if (webContainerError) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400 text-center">
          <h2 className="text-xl font-semibold mb-2">WebContainer Error</h2>
          <p>{webContainerError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-100">Website Builder</h1>
        <p className="text-sm text-gray-400 mt-1">Prompt: {prompt}</p>
        {webContainerLoading && (
          <p className="text-xs text-yellow-400 mt-1">Loading WebContainer...</p>
        )}
      </header>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-4 gap-6 p-6">
          <div className="col-span-1 space-y-6 overflow-auto">
            <div>
              <div className="max-h-[75vh] overflow-scroll">
                <StepsList
                  steps={steps}
                  currentStep={currentStep}
                  onStepClick={setCurrentStep}
                />
              </div>
              <div>
                <div className='flex'>
                  <br />
                  {(loading || !templateSet) && <Loader />}
                  {!(loading || !templateSet) && (
                    <div className='flex'>
                      <textarea 
                        value={userPrompt} 
                        onChange={(e) => setPrompt(e.target.value)} 
                        className='p-2 w-full'
                        placeholder="Enter your message..."
                      />
                      <button 
                        onClick={handleSendMessage} 
                        className='bg-purple-400 px-4'
                        disabled={loading || !userPrompt.trim()}
                      >
                        Send
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="col-span-1">
            <FileExplorer 
              files={files} 
              onFileSelect={setSelectedFile}
            />
          </div>
          <div className="col-span-2 bg-gray-900 rounded-lg shadow-lg p-4 h-[calc(100vh-8rem)]">
            <TabView activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="h-[calc(100%-4rem)]">
              {activeTab === 'code' ? (
                <CodeEditor file={selectedFile} />
              ) : (
                <PreviewFrame 
                  webContainer={webContainer} 
                  files={files} 
                  isLoading={webContainerLoading}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}