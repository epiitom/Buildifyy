import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import type { FileViewerProps } from '../types';

export function FileViewer({ file, onClose }: FileViewerProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle click outside to close modal
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Get syntax highlighting class based on file extension
  const getSyntaxClass = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return 'language-javascript';
      case 'css':
        return 'language-css';
      case 'html':
        return 'language-html';
      case 'json':
        return 'language-json';
      case 'md':
        return 'language-markdown';
      default:
        return '';
    }
  };

  if (!file) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 rounded-lg w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex flex-col">
            <h3 className="text-lg font-medium text-gray-100 truncate">
              {file.name || 'Untitled'}
            </h3>
            {file.path && (
              <p className="text-sm text-gray-400 truncate" title={file.path}>
                {file.path}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-700"
            aria-label="Close file viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="overflow-auto max-h-[calc(85vh-5rem)] bg-gray-900">
          {file.content ? (
            <pre className={`text-sm text-gray-300 font-mono whitespace-pre-wrap p-4 leading-relaxed ${getSyntaxClass(file.name || '')}`}>
              {file.content}
            </pre>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-400 text-lg">No content available</p>
              <p className="text-gray-500 text-sm mt-2">This file appears to be empty</p>
            </div>
          )}
        </div>
        
        {/* File info footer */}
        <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          <div className="flex justify-between items-center">
            <span>
              {file.type === 'file' ? 'File' : 'Folder'} • {file.content?.length || 0} characters
            </span>
            <span>
              Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">ESC</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}