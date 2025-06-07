import React, { useState } from 'react';
import { FolderTree, File, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import type { FileItem } from '../types';

interface FileExplorerProps {
  files: FileItem[];
  onFileSelect: (file: FileItem) => void;
}

interface FileNodeProps {
  item: FileItem;
  depth: number;
  onFileClick: (file: FileItem) => void;
}

function FileNode({ item, depth, onFileClick }: FileNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    if (item.type === 'folder') {
      setIsExpanded(!isExpanded);
    } else {
      onFileClick(item);
    }
  };

  // Get file extension for better file type detection
  const getFileIcon = (fileName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const extension = fileName.split('.').pop()?.toLowerCase();
    // You can expand this to show different icons for different file types
    return <File className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-2 p-2 hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 1.5}rem` }}
        onClick={handleClick}
      >
        {item.type === 'folder' && (
          <span className="text-gray-400 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </span>
        )}
        
        <span className="flex-shrink-0">
          {item.type === 'folder' ? (
            <Folder className="w-4 h-4 text-blue-400" />
          ) : (
            getFileIcon(item.name)
          )}
        </span>
        
        <span className="text-gray-200 truncate" title={item.name}>
          {item.name}
        </span>
      </div>
      
      {item.type === 'folder' && isExpanded && item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child, index) => (
            <FileNode
              key={child.path || `${child.name}-${index}`}
              item={child}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileExplorer({ files, onFileSelect }: FileExplorerProps) {
  return (
    <div className="bg-gray-900 rounded-lg shadow-lg p-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-100">
        <FolderTree className="w-5 h-5" />
        File Explorer
      </h2>
      
      {files.length === 0 ? (
        <div className="text-gray-400 text-sm italic">No files available</div>
      ) : (
        <div className="space-y-1">
          {files.map((file, index) => (
            <FileNode
              key={file.path || `${file.name}-${index}`}
              item={file}
              depth={0}
              onFileClick={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}