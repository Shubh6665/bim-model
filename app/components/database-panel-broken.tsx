"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  Plus, 
  MoreVertical,
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  Edit,
  Trash2,
  Share,
  UserPlus,
  UserMinus,
  Mail,
  Link
} from 'lucide-react';

interface DatabaseFile {
  id: string;
  name: string;
  type: 'word' | 'pdf' | 'excel' | 'dwg' | 'folder';
  size?: string;
  modified: string;
  parentId?: string;
  content?: string; // For file content viewing/editing
}

interface DatabaseFolder {
  id: string;
  name: string;
  parentId?: string;
  children: (DatabaseFolder | DatabaseFile)[];
  isExpanded?: boolean;
}

interface DatabasePanelProps {
  projectId?: string;
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const [activeCommand, setActiveCommand] = useState<'manage' | 'new'>('manage');
  const [folders, setFolders] = useState<DatabaseFolder[]>([]);
  const [selectedItem, setSelectedItem] = useState<DatabaseFolder | DatabaseFile | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: DatabaseFolder | DatabaseFile;
    type: 'folder' | 'file';
  } | null>(null);
  // Inline new folder input (instead of modal)
  const [inlineNewFolderParentId, setInlineNewFolderParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showFileUpload, setShowFileUpload] = useState<string | null>(null); // folder ID
  // File open is handled by dashboard via custom event overlay
  const [showRenameModal, setShowRenameModal] = useState<{item: DatabaseFolder | DatabaseFile, newName: string} | null>(null);
  const [showEmailModal, setShowEmailModal] = useState<{item: DatabaseFolder | DatabaseFile, email: string} | null>(null);
  const [showUserAssignModal, setShowUserAssignModal] = useState<{item: DatabaseFolder | DatabaseFile, email: string, mode?: 'assign' | 'remove'} | null>(null);
  // Move dialog
  const [moveState, setMoveState] = useState<{ item: DatabaseFolder | DatabaseFile, targetFolderId?: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load folders and files from API
  useEffect(() => {
    if (projectId) {
      loadFoldersAndFiles();
    }
  }, [projectId]);

  const loadFoldersAndFiles = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/folders`);
      if (response.ok) {
        const data = await response.json();
        const organizedFolders = organizeFoldersAndFiles(data.folders, data.files);
        setFolders(organizedFolders);
      }
    } catch (error) {
      console.error('Error loading folders and files:', error);
    }
  };

  const handleDownloadFile = (fileId: string) => {
    if (!projectId) return;
    const url = `/api/projects/${projectId}/files/download?fileId=${fileId}`;
    // trigger browser download
    window.open(url, '_blank');
  };

  const handleMoveConfirm = async () => {
    if (!projectId || !moveState) return;
    const { item, targetFolderId } = moveState;
    const isFile = 'type' in item;
    try {
      if (isFile) {
        const r = await fetch(`/api/projects/${projectId}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: item.id, moveToFolderId: targetFolderId })
        });
        if (!r.ok) throw new Error('Move file failed');
      } else {
        const r = await fetch(`/api/projects/${projectId}/folders`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId: item.id, parentId: targetFolderId || null })
        });
        if (!r.ok) throw new Error('Move folder failed');
      }
      await loadFoldersAndFiles();
      setMoveState(null);
    } catch (e) {
      console.error(e);
    }
  };

  const organizeFoldersAndFiles = (folders: any[], files: any[]): DatabaseFolder[] => {
    const folderMap = new Map<string, DatabaseFolder>();
    const rootFolders: DatabaseFolder[] = [];

    // Create folder objects
    folders.forEach(folder => {
      folderMap.set(folder._id, {
        id: folder._id,
        name: folder.name,
        parentId: folder.parentId,
        children: [],
        isExpanded: false
      });
    });

    // Add files to their respective folders
    files.forEach(file => {
      const fileObj: DatabaseFile = {
        id: file._id,
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        modified: new Date(file.createdAt).toLocaleDateString(),
        parentId: file.folderId
      };

      if (file.folderId && folderMap.has(file.folderId)) {
        folderMap.get(file.folderId)!.children.push(fileObj);
      } else {
        // Root level file - create a temporary folder structure
        rootFolders.push({
          id: `file-${file._id}`,
          name: file.name,
          children: [fileObj]
        });
      }
    });

    // Organize folders into hierarchy
    folderMap.forEach(folder => {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children.push(folder);
      } else {
        rootFolders.push(folder);
      }
    });

    return rootFolders;
  };

  const handleContextMenu = (e: React.MouseEvent, item: DatabaseFolder | DatabaseFile) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 200; // approx width of context menu
    const menuHeight = 300; // approx height

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    setContextMenu({
      x: x,
      y: y,
      item,
      type: 'type' in item ? 'file' : 'folder'
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleItemClick = (item: DatabaseFolder | DatabaseFile) => {
    if ('type' in item) {
      // File clicked - dispatch event so dashboard can render overlay on top of viewer
      try {
        window.dispatchEvent(new CustomEvent('database:fileOpen', { detail: item }));
      } catch (e) {
        console.warn('Could not dispatch file open event', e);
      }
      setSelectedItem(item);
    } else {
      // Folder clicked - expand/collapse
      setSelectedItem(item);
      toggleFolder(item.id);
    }
  };

  const toggleFolder = (folderId: string) => {
    const updateFolder = (folders: DatabaseFolder[]): DatabaseFolder[] => {
      return folders.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, isExpanded: !folder.isExpanded };
        }
        if (folder.children) {
          return { ...folder, children: updateFolder(folder.children.filter(child => !('type' in child)) as DatabaseFolder[]) };
        }
        return folder;
      });
    };
    setFolders(updateFolder(folders));
  };

  const handleNewFolder = async () => {
    if (newFolderName.trim() && projectId) {
      try {
        const response = await fetch(`/api/projects/${projectId}/folders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: newFolderName.trim(),
            parentId: (inlineNewFolderParentId === 'root')
              ? null
              : (inlineNewFolderParentId || (selectedItem && !('type' in selectedItem) ? selectedItem.id : null))
          }),
        });

        if (response.ok) {
          await loadFoldersAndFiles(); // Reload data
          setNewFolderName('');
          setInlineNewFolderParentId(null);
        } else {
          const txt = await response.text().catch(() => '');
          console.error('Failed to create folder', response.status, txt);
        }
      } catch (error) {
        console.error('Error creating folder:', error);
      }
    }
  };

  const handleFileUpload = (folderId: string) => {
    setShowFileUpload(folderId);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && showFileUpload && projectId) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', showFileUpload);

        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          await loadFoldersAndFiles(); // Reload data
          setShowFileUpload(null);
        } else {
          console.error('Failed to upload file');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }
  };

  const handleRename = async () => {
    if (showRenameModal && showRenameModal.newName.trim() && projectId) {
      const { item, newName } = showRenameModal;
      
      try {
        const isFile = 'type' in item;
        const endpoint = isFile ? 'files' : 'folders';
        const idField = isFile ? 'fileId' : 'folderId';
        
        const response = await fetch(`/api/projects/${projectId}/${endpoint}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [idField]: item.id,
            name: newName.trim()
          }),
        });

        if (response.ok) {
          await loadFoldersAndFiles(); // Reload data
          setShowRenameModal(null);
        } else {
          console.error('Failed to rename item');
        }
      } catch (error) {
        console.error('Error renaming item:', error);
      }
    }
  };

  const handleDelete = async (item: DatabaseFolder | DatabaseFile) => {
    if (!projectId) return;
    
    try {
      const isFile = 'type' in item;
      const endpoint = isFile ? 'files' : 'folders';
      const idParam = isFile ? 'fileId' : 'folderId';
      
      const response = await fetch(`/api/projects/${projectId}/${endpoint}?${idParam}=${item.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadFoldersAndFiles(); // Reload data
        setContextMenu(null);
      } else {
        console.error('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleCreateShareLink = async (item: DatabaseFolder | DatabaseFile) => {
    if (!projectId) return;
    
    try {
      const isFile = 'type' in item;
      const response = await fetch(`/api/projects/${projectId}/files/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          action: 'link'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Copy link to clipboard
        navigator.clipboard.writeText(data.shareUrl);
        alert(`Share link created and copied to clipboard!\nExpires: ${new Date(data.expiresAt).toLocaleDateString()}`);
      } else {
        console.error('Failed to create share link');
      }
    } catch (error) {
      console.error('Error creating share link:', error);
    }
  };

  const handleSendEmail = async () => {
    if (!showEmailModal || !projectId) return;
    
    try {
      const { item, email } = showEmailModal;
      const isFile = 'type' in item;
      
      const response = await fetch(`/api/projects/${projectId}/files/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          action: 'email',
          email: email.trim()
        }),
      });

      if (response.ok) {
        alert('Email sent successfully!');
        setShowEmailModal(null);
      } else {
        console.error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const handleAssignUser = async () => {
    if (!showUserAssignModal || !projectId) return;
    
    try {
      const { item, email } = showUserAssignModal;
      const isFile = 'type' in item;
      
      const response = await fetch(`/api/projects/${projectId}/files/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          email: email.trim(),
          permissions: ['read', 'write']
        }),
      });

      if (response.ok) {
        alert('User assigned successfully!');
        setShowUserAssignModal(null);
      } else {
        console.error('Failed to assign user');
      }
    } catch (error) {
      console.error('Error assigning user:', error);
    }
  };

  const renderFolderTree = (items: (DatabaseFolder | DatabaseFile)[], level = 0) => {
    return items.map(item => (
      <div key={item.id} style={{ marginLeft: `${level * 20}px` }}>
        <div
          className={`flex items-center p-2 hover:bg-gray-700 cursor-pointer rounded ${
            selectedItem?.id === item.id ? 'bg-gray-600' : ''
          }`}
          onClick={() => handleItemClick(item)}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          {'type' in item ? (
            <>
              <FileText className="w-4 h-4 text-blue-400 mr-2" />
              <span className="text-sm text-gray-300">{item.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{item.size}</span>
            </>
          ) : (
            <>
              {item.isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-400 mr-1" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400 mr-1" />
              )}
              <Folder className="w-4 h-4 text-yellow-400 mr-2" />
              <span className="text-sm text-gray-300">{item.name}</span>
            </>
          )}
        </div>
        {'children' in item && item.isExpanded && renderFolderTree(item.children, level + 1)}
      </div>
    ));
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'word': return '📄';
      case 'pdf': return '📕';
      case 'excel': return '📊';
      case 'dwg': return '📐';
      default: return '📄';
    }
  };

  const renderMoveFolderPicker = (folders: DatabaseFolder[], level = 0): JSX.Element[] => {
    return folders.map(folder => {
      return (
        <div key={folder.id} style={{ marginLeft: `${level * 1.25}rem` }}>
          <button 
            className={`w-full text-left px-2 py-1 rounded ${moveState?.targetFolderId === folder.id ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}`}
            onClick={() => setMoveState(prev => prev ? { ...prev, targetFolderId: folder.id } : null)}
          >
            <span className="inline-flex items-center gap-2">
              <Folder className="w-4 h-4 text-yellow-400" />
              {folder.name}
            </span>
          </button>
          {'children' in folder && folder.children && folder.children.length > 0 && (
            <div>
              {renderMoveFolderPicker(folder.children as DatabaseFolder[], level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Removed internal file content renderer: dashboard handles overlay

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full">
        {/* Header Commands */}
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-2 text-center">Database</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveCommand('manage')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm transition-colors ${
                activeCommand === 'manage'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <Folder className="w-4 h-4 mr-2" />
              Manage
            </button>
            <button
              onClick={() => {
                setActiveCommand('new');
                setInlineNewFolderParentId((selectedItem && !('type' in selectedItem)) ? selectedItem.id : 'root');
              }}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm transition-colors ${
                activeCommand === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Folder
            </button>
          </div>
        </div>

        {/* Folder Tree */}
        {activeCommand === 'manage' && (
          <div className="flex-1 p-4 overflow-auto relative">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
              Folders & Files
            </h3>
            {renderFolderTree(folders)}
          </div>
        )}

        {/* New Folder Creation */}
        {activeCommand === 'new' && (
          <div className="flex-1 p-4 overflow-auto relative">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
              Create New Folder
            </h3>
            <div className="mb-3">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name"
                className="w-full h-8 px-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewFolder();
                  if (e.key === 'Escape') { setNewFolderName(''); setActiveCommand('manage'); }
                }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button onClick={handleNewFolder} className="px-3 h-8 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm">Add</button>
                <button onClick={() => { setNewFolderName(''); setActiveCommand('manage'); }} className="px-3 h-8 bg-gray-800 hover:bg-gray-700 rounded text-gray-200 text-sm">Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Move UI Overlay */}
        {moveState && (
              <div className="absolute inset-0 bg-gray-900 p-4 flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4">Move '{moveState.item.name}' to...</h3>
                <div className="flex-1 overflow-auto border border-gray-700 rounded p-2">
                  {renderMoveFolderPicker(folders)}
                </div>
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setMoveState(null)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
                  <button onClick={handleMoveConfirm} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Move</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {renderFolderTree(folders)}
              </div>
            )}
          </div>
        )}
      {/* End sidebar */}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-48"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'folder' ? (
              // Folder context menu (10 options)
              <>
                <button
                  onClick={() => {
                    handleFileUpload(contextMenu.item.id);
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => {
                    // TODO: Implement folder download zip endpoint
                    alert('Folder download as zip coming soon');
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Folder
                </button>
                <button
                  onClick={() => {
                    setShowRenameModal({ item: contextMenu.item, newName: contextMenu.item.name });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename Folder
                </button>
                  <button
                    onClick={() => { setMoveState({ item: contextMenu.item }); closeContextMenu(); }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                    <Folder className="w-4 h-4 mr-2" />
                    Move Folder
                  </button>
                <button
                  onClick={() => {
                    setShowEmailModal({ item: contextMenu.item, email: '' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send as ZIP
                </button>
                <button 
                  onClick={() => {
                    handleCreateShareLink(contextMenu.item);
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Link className="w-4 h-4 mr-2" />
                  Create Share Link
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'assign' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to User
                </button>
                <button
                  onClick={() => { setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'remove' }); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                  <UserMinus className="w-4 h-4 mr-2" />
                  Remove Access
                </button>
                <button
                  onClick={() => {
                    handleDelete(contextMenu.item);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-red-400 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Folder
                </button>
                <button
                  onClick={() => {
                    setSelectedItem(contextMenu.item);
                    setInlineNewFolderParentId((contextMenu.item as DatabaseFolder).id);
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Create Subfolder
                </button>
              </>
            ) : (
              // File context menu (8 options)
              <>
                <button
                  onClick={() => { handleDownloadFile((contextMenu.item as DatabaseFile).id); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                  <Download className="w-4 h-4 mr-2" />
                  Download Document
                </button>
                <button
                  onClick={() => {
                    setShowRenameModal({ item: contextMenu.item, newName: contextMenu.item.name });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename File
                </button>
                <button
                  onClick={() => { setMoveState({ item: contextMenu.item }); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                  <Folder className="w-4 h-4 mr-2" />
                  Move File
                </button>
                <button
                  onClick={() => {
                    setShowEmailModal({ item: contextMenu.item, email: '' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send to Email
                </button>
                <button
                  onClick={() => { handleCreateShareLink(contextMenu.item); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                  <Link className="w-4 h-4 mr-2" />
                  Create Share Link
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'assign' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to User
                </button>
                <button
                  onClick={() => { setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'remove' }); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center">
                  <UserMinus className="w-4 h-4 mr-2" />
                  Remove Access
                </button>
                <button
                  onClick={() => {
                    handleDelete(contextMenu.item);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-red-400 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete File
                </button>
              </>
            )}
          </div>
        </>
      )}


      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              Rename {'type' in showRenameModal.item ? 'File' : 'Folder'}
            </h3>
            <input
              type="text"
              value={showRenameModal.newName}
              onChange={(e) => setShowRenameModal({ ...showRenameModal, newName: e.target.value })}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRenameModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              Send {'type' in showEmailModal.item ? 'File' : 'Folder'} via Email
            </h3>
            <input
              type="email"
              value={showEmailModal.email}
              onChange={(e) => setShowEmailModal({ ...showEmailModal, email: e.target.value })}
              placeholder="Enter email address"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEmailModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Assignment Modal (assign/remove) */}
      {showUserAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              {showUserAssignModal.mode === 'remove' ? 'Remove Access for' : 'Assign'} {'type' in showUserAssignModal.item ? 'File' : 'Folder'}
            </h3>
            <input
              type="email"
              value={showUserAssignModal.email}
              onChange={(e) => setShowUserAssignModal({ ...showUserAssignModal, email: e.target.value })}
              placeholder="Enter user email"
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white mb-4"
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUserAssignModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!showUserAssignModal || !projectId) return;
                  const { item, email, mode } = showUserAssignModal;
                  const isFile = 'type' in item;
                  if (mode === 'remove') {
                    // call DELETE
                    const r = await fetch(`/api/projects/${projectId}/files/assign`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ type: isFile ? 'file' : 'folder', itemId: item.id, email: email.trim() })
                    });
                    if (r.ok) { alert('Access removed'); setShowUserAssignModal(null); } else { console.error('Failed to remove access'); }
                  } else {
                    await handleAssignUser();
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {showUserAssignModal.mode === 'remove' ? 'Remove' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx,.pdf,.xls,.xlsx,.dwg"
        onChange={handleFileSelected}
        className="hidden"
      />
    </div>
  );
}
