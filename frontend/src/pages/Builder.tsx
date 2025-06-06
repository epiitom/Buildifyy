import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { StepsList } from '../components/StepsList';
import { FileExplorer } from '../components/FileExplorer';
import { TabView } from '../components/TabView';
import { CodeEditor } from '../components/CodeEditor';
import { PreviewFrame } from '../components/PreviewFrame';
import { Loader } from '../components/Loader';
import type { Step, FileItem } from '../types';
import { StepType } from '../types';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import { parseXml } from '../steps';
import { useWebContainer } from '../hooks/useWebContainer';
import type { FileSystemTree } from '@webcontainer/api';

interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export function Builder() {
  const location = useLocation();
  const { prompt } = location.state as { prompt: string };
  
  // State management
  const [userPrompt, setUserPrompt] = useState("");
  const [llmMessages, setLlmMessages] = useState<LLMMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [templateSet, setTemplateSet] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  
  const webcontainer = useWebContainer();

  // Debug logger
  const addDebugInfo = useCallback((message: string) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // Process pending steps and update file structure
  const processSteps = useCallback(() => {
    const pendingSteps = steps.filter(step => step.status === "pending");
    if (pendingSteps.length === 0) return;

    addDebugInfo(`Processing ${pendingSteps.length} pending steps`);

    setFiles(currentFiles => {
      let updatedFiles = [...currentFiles];
      
      pendingSteps.forEach(step => {
        if (step.type === StepType.CreateFile && step.path) {
          addDebugInfo(`Creating/updating file: ${step.path}`);
          updatedFiles = createOrUpdateFile(updatedFiles, step.path, step.code || '');
        }
      });
      
      return updatedFiles;
    });

    // Mark steps as completed
    setSteps(currentSteps => 
      currentSteps.map(step => ({
        ...step,
        status: step.status === "pending" ? "completed" : step.status
      }))
    );
  }, [steps, addDebugInfo]);

  // Helper function to create or update files in the file structure
  const createOrUpdateFile = (fileStructure: FileItem[], filePath: string, content: string): FileItem[] => {
    const pathParts = filePath.split('/').filter(Boolean);
    const updatedStructure = [...fileStructure];
    
    let currentLevel = updatedStructure;
    let currentPath = '';
    
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += `/${part}`;
      const isLastPart = i === pathParts.length - 1;
      
      let existingItem = currentLevel.find(item => item.name === part);
      
      if (isLastPart) {
        // This is a file
        if (existingItem) {
          existingItem.content = content;
        } else {
          currentLevel.push({
            name: part,
            type: 'file',
            path: currentPath,
            content
          });
        }
      } else {
        // This is a folder
        if (!existingItem) {
          existingItem = {
            name: part,
            type: 'folder',
            path: currentPath,
            children: []
          };
          currentLevel.push(existingItem);
        }
        currentLevel = existingItem.children!;
      }
    }
    
    return updatedStructure;
  };

  // Create WebContainer mount structure
  const mountStructure = useMemo(() => {
    const createMountStructure = (files: FileItem[]): FileSystemTree => {
      const structure: FileSystemTree = {};
      
      files.forEach(file => {
        if (file.type === 'folder' && file.children) {
          structure[file.name] = {
            directory: createMountStructure(file.children)
          };
        } else if (file.type === 'file') {
          structure[file.name] = {
            file: {
              contents: file.content || ''
            }
          };
        }
      });
      
      return structure;
    };
    
    return createMountStructure(files);
  }, [files]);

  // Mount files to WebContainer
  useEffect(() => {
    if (webcontainer && Object.keys(mountStructure).length > 0) {
      addDebugInfo(`Mounting ${Object.keys(mountStructure).length} items to WebContainer`);
      webcontainer.mount(mountStructure).catch(err => {
        addDebugInfo(`WebContainer mount error: ${err.message}`);
      });
    }
  }, [webcontainer, mountStructure, addDebugInfo]);

  // Process pending steps
  useEffect(() => {
    processSteps();
  }, [processSteps]);

  // Send chat message
  const sendMessage = useCallback(async () => {
    if (!userPrompt.trim() || loading) {
      addDebugInfo('Send message blocked: empty prompt or already loading');
      return;
    }

    const newMessage: LLMMessage = {
      role: "user",
      content: userPrompt.trim()
    };

    addDebugInfo(`Sending message: "${userPrompt.trim().substring(0, 50)}..."`);
    addDebugInfo(`Backend URL: ${BACKEND_URL}`);
    
    setLoading(true);
    setUserPrompt("");
    setError(null);

    try {
      const requestData = {
        messages: [...llmMessages, newMessage]
      };
      
      addDebugInfo(`Request payload: ${JSON.stringify(requestData).substring(0, 100)}...`);
      
      const response = await axios.post(`${BACKEND_URL}/chat`, requestData, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      addDebugInfo(`Response status: ${response.status}`);
      addDebugInfo(`Response data keys: ${Object.keys(response.data)}`);

      if (!response.data.response) {
        throw new Error('No response field in backend response');
      }

      const assistantMessage: LLMMessage = {
        role: "assistant",
        content: response.data.response
      };

      setLlmMessages(prev => [...prev, newMessage, assistantMessage]);
      
      try {
        const newSteps = parseXml(response.data.response).map((step: Step) => ({
          ...step,
          status: "pending" as const
        }));
        
        addDebugInfo(`Parsed ${newSteps.length} steps from response`);
        setSteps(prev => [...prev, ...newSteps]);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        addDebugInfo(`XML parsing error: ${errorMessage}`);
        // Continue without adding steps if parsing fails
      }
    } catch (error) {
      console.error('Error sending message:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timeout - backend not responding';
        } else if (error.response) {
          errorMessage = `Backend error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
        } else if (error.request) {
          errorMessage = 'No response from backend - check if backend is running and accessible';
        } else {
          errorMessage = `Request setup error: ${error.message}`;
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      
      addDebugInfo(`Error: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userPrompt, loading, llmMessages, addDebugInfo]);

  // Initialize the builder
  const initializeBuilder = useCallback(async () => {
    if (!prompt?.trim()) {
      addDebugInfo('Initialize blocked: no prompt provided');
      return;
    }

    addDebugInfo(`Initializing builder with prompt: "${prompt.trim().substring(0, 50)}..."`);
    addDebugInfo(`Backend URL: ${BACKEND_URL}`);
    
    setLoading(true);
    setError(null);
    
    try {
      // Get template
      addDebugInfo('Requesting template from backend...');
      const templateResponse = await axios.post(`${BACKEND_URL}/template`, {
        prompt: prompt.trim()
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      addDebugInfo(`Template response status: ${templateResponse.status}`);
      addDebugInfo(`Template response keys: ${Object.keys(templateResponse.data)}`);
      
      setTemplateSet(true);
      const { prompts, uiPrompts } = templateResponse.data;

      if (!prompts || !uiPrompts) {
        throw new Error('Invalid template response: missing prompts or uiPrompts');
      }

      // Set initial steps from UI prompts
      try {
        const initialSteps = parseXml(uiPrompts[0]).map((step: Step) => ({
          ...step,
          status: "pending" as const
        }));
        addDebugInfo(`Parsed ${initialSteps.length} initial steps from UI prompts`);
        setSteps(initialSteps);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        addDebugInfo(`UI prompts parsing error: ${errorMessage}`);
      }

      // Get chat response
      const messages = [...prompts, prompt].map(content => ({
        role: "user" as const,
        content
      }));

      addDebugInfo(`Sending ${messages.length} messages to chat endpoint...`);
      const chatResponse = await axios.post(`${BACKEND_URL}/chat`, {
        messages
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      addDebugInfo(`Chat response status: ${chatResponse.status}`);

      if (!chatResponse.data.response) {
        throw new Error('No response field in chat response');
      }

      const assistantResponse = {
        role: "assistant" as const,
        content: chatResponse.data.response
      };

      setLlmMessages([...messages, assistantResponse]);

      // Add chat response steps
      try {
        const chatSteps = parseXml(chatResponse.data.response).map((step: Step) => ({
          ...step,
          status: "pending" as const
        }));
        
        addDebugInfo(`Parsed ${chatSteps.length} steps from chat response`);
        setSteps(prev => [...prev, ...chatSteps]);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        addDebugInfo(`Chat response parsing error: ${errorMessage}`);
      }

      addDebugInfo('Builder initialization completed successfully');
    } catch (error) {
      console.error('Error initializing builder:', error);
      let errorMessage = 'Unknown initialization error';
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Initialization timeout - backend not responding';
        } else if (error.response) {
          errorMessage = `Backend initialization error: ${error.response.status} - ${error.response.data?.message || error.response.statusText}`;
        } else if (error.request) {
          errorMessage = 'No response from backend during initialization - check if backend is running';
        } else {
          errorMessage = `Initialization setup error: ${error.message}`;
        }
      } else {
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      
      addDebugInfo(`Initialization error: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [prompt, addDebugInfo]);

  // Initialize on mount
  useEffect(() => {
    addDebugInfo('Component mounted, starting initialization...');
    initializeBuilder();
  }, [initializeBuilder]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendMessage]);

  if (loading && !templateSet) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-8">
        <Loader />
        <div className="mt-8 w-full max-w-2xl">
          <h3 className="text-lg font-semibold mb-4">Debug Information:</h3>
          <div className="bg-gray-800 p-4 rounded-lg max-h-64 overflow-y-auto">
            {debugInfo.map((info, index) => (
              <div key={index} className="text-sm text-gray-300 mb-1">{info}</div>
            ))}
          </div>
          {error && (
            <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-lg">
              <h4 className="font-semibold text-red-300">Error:</h4>
              <p className="text-red-200">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      {/* Debug panel */}
      {debugInfo.length > 0 && (
        <div className="bg-gray-800 border-b border-gray-700 p-2">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-white">
              Debug Info ({debugInfo.length})
            </summary>
            <div className="mt-2 max-h-32 overflow-y-auto">
              {debugInfo.slice(-5).map((info, index) => (
                <div key={index} className="text-xs text-gray-300">{info}</div>
              ))}
            </div>
          </details>
        </div>
      )}

      {error && (
        <div className="bg-red-900 border-b border-red-700 p-3">
          <div className="flex justify-between items-center">
            <span className="text-red-200">{error}</span>
            <button 
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-64 bg-gray-800 border-r border-gray-700">
          <FileExplorer
            files={files}
            onFileSelect={setSelectedFile}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <TabView
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'code' ? (
              <CodeEditor
                file={selectedFile}
              />
            ) : (
              webcontainer && (
                <PreviewFrame
                  files={files}
                  webContainer={webcontainer}
                />
              )
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 bg-gray-800 border-l border-gray-700">
          <StepsList
            steps={steps}
            currentStep={currentStep}
            onStepClick={setCurrentStep}
          />
        </div>
      </div>

      {/* Chat input */}
      <div className="h-16 bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-gray-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}