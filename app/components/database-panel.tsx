"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FileText, 
  Upload, 
  Download, 
  Share, 
  Mail, 
  Archive, 
  MoreVertical, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Check, 
  X,
  Trash2,
  Edit3,
  Link,
  Eye,
  EyeOff,
  FileImage,
  FileSpreadsheet,
  File,
  UserPlus,
  UserMinus,
  Edit
} from 'lucide-react';

interface DatabaseFile {
  id: string;
  name: string;
  type: 'word' | 'pdf' | 'excel' | 'dwg';
  size: string;
  modified: string;
  folderId?: string;
}

interface DatabaseFolder {
  id: string;
  name: string;
  parentId?: string;
  children: (DatabaseFolder | DatabaseFile)[];
  isExpanded?: boolean;
}

interface DatabasePanelProps {
  projectId: string;
  onFileOpen?: (file: DatabaseFile) => void;
  openFileId?: string | null;
}

export function DatabasePanel({ projectId, onFileOpen, openFileId }: DatabasePanelProps) {
  const [activeCommand, setActiveCommand] = useState<'manage' | 'new'>('manage');
  const [folders, setFolders] = useState<DatabaseFolder[]>([]);
  const [selectedItem, setSelectedItem] = useState<DatabaseFolder | DatabaseFile | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: DatabaseFolder | DatabaseFile;
    type: 'folder' | 'file';
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showRenameModal, setShowRenameModal] = useState<{item: DatabaseFolder | DatabaseFile, newName: string} | null>(null);
  const [showEmailModal, setShowEmailModal] = useState<{item: DatabaseFolder | DatabaseFile, email: string} | null>(null);
  const [showUserAssignModal, setShowUserAssignModal] = useState<{item: DatabaseFolder | DatabaseFile, email: string, mode?: 'assign' | 'remove'} | null>(null);
  const [assignees, setAssignees] = useState<{ assignedTo: string; permissions?: string[]; createdAt?: string }[] | null>(null);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignResult, setAssignResult] = useState<{ email: string; status: 'assigned' | 'error'; message?: string } | null>(null);
  const [moveState, setMoveState] = useState<{ item: DatabaseFolder | DatabaseFile, targetFolderId?: string | null } | null>(null);
  const [showFileUpload, setShowFileUpload] = useState<string | null>(null);
  const [showShareLinkModal, setShowShareLinkModal] = useState<{item: DatabaseFolder | DatabaseFile, shareUrl: string} | null>(null);
  const [showSendZipModal, setShowSendZipModal] = useState<{ 
    item: DatabaseFolder | DatabaseFile;
    recipients: string[];
    subject: string;
    message: string;
  } | null>(null);
  const [zipRecipients, setZipRecipients] = useState<string[] | null>(null);
  const [zipRecipientsLoading, setZipRecipientsLoading] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [inlineRename, setInlineRename] = useState<{itemId: string, newName: string} | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [creatingSubfolder, setCreatingSubfolder] = useState<{parentId: string, name: string} | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Sending overlay state (for ZIP/email send)
  const [isSending, setIsSending] = useState(false);
  const [sendingMessage, setSendingMessage] = useState<string>('');
  // Delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ item: DatabaseFolder | DatabaseFile } | null>(null);
  // Panel ref for outside-click detection
  const panelRef = useRef<HTMLDivElement>(null);

  // Load folders and files from API
  useEffect(() => {
    if (projectId) {
      loadFoldersAndFiles();
    }
  }, [projectId]);

  // Load assignees when the modal opens or the selected item changes (not on each keystroke)
  useEffect(() => {
    const fetchAssignees = async () => {
      if (!showUserAssignModal || !projectId) return;
      const itemId = (showUserAssignModal.item as any)?.id;
      if (!itemId) return;
      setAssigneesLoading(true);
      try {
        const isFile = 'type' in showUserAssignModal.item;
        const res = await fetch(`/api/projects/${projectId}/files/assign?type=${isFile ? 'file' : 'folder'}&itemId=${itemId}`);
        if (res.ok) {
          const data = await res.json();
          setAssignees(data.assignees || []);
        } else {
          setAssignees([]);
        }
      } catch (e) {
        console.error('Error fetching assignees:', e);
        setAssignees([]);
      } finally {
        setAssigneesLoading(false);
      }
    };
    fetchAssignees();
  }, [projectId, showUserAssignModal?.mode, (showUserAssignModal?.item as any)?.id]);

  // Fetch prior ZIP recipients for the item shown in the ZIP modal
  const fetchZipRecipients = async () => {
    if (!showSendZipModal || !projectId) return;
    const { item } = showSendZipModal;
    const isFile = 'type' in item;
    setZipRecipientsLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/share?shareType=zip&itemType=${isFile ? 'file' : 'folder'}&itemId=${item.id}`);
      if (res.ok) {
        const data = await res.json();
        setZipRecipients(Array.isArray(data.recipients) ? data.recipients : []);
      } else {
        setZipRecipients([]);
      }
    } catch (e) {
      console.error('Error fetching ZIP recipients:', e);
      setZipRecipients([]);
    } finally {
      setZipRecipientsLoading(false);
    }
  };

  useEffect(() => {
    if (showSendZipModal) {
      fetchZipRecipients();
    } else {
      setZipRecipients(null);
      setZipRecipientsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSendZipModal?.item?.id, !!showSendZipModal]);

  // Reset assign result/loading when modal changes
  useEffect(() => {
    if (showUserAssignModal) {
      setAssignResult(null);
      setAssignLoading(false);
    }
  }, [showUserAssignModal]);

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

  const organizeFoldersAndFiles = (folders: any[], files: any[]): DatabaseFolder[] => {
    const folderMap = new Map<string, DatabaseFolder>();
    const rootFolders: DatabaseFolder[] = [];

    // Create folder objects
    folders.forEach(folder => {
      const dbFolder: DatabaseFolder = {
        id: folder._id,
        name: folder.name,
        parentId: folder.parentId,
        children: [],
        isExpanded: false
      };
      folderMap.set(folder._id, dbFolder);
    });

    // Add files to folders
    files.forEach(file => {
      const dbFile: DatabaseFile = {
        id: file._id,
        name: file.name,
        type: file.type,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        modified: new Date(file.updatedAt).toLocaleDateString(),
        folderId: file.folderId
      };

      if (file.folderId && folderMap.has(file.folderId)) {
        folderMap.get(file.folderId)!.children.push(dbFile);
      }
    });

    // Build folder hierarchy
    folderMap.forEach(folder => {
      if (folder.parentId && folderMap.has(folder.parentId)) {
        folderMap.get(folder.parentId)!.children.push(folder);
      } else {
        rootFolders.push(folder);
      }
    });

    return rootFolders;
  };

  const handleNewFolder = async () => {
    if (!newFolderName.trim() || !projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: null
        })
      });

      if (response.ok) {
        await loadFoldersAndFiles();
        setNewFolderName('');
        setActiveCommand('manage');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: DatabaseFolder | DatabaseFile) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 220;
    // Use dynamic max height so menu never exceeds viewport and becomes scrollable
    const maxMenuHeight = Math.min(380, window.innerHeight - 20);

    // Ensure the right-clicked item becomes selected/highlighted
    if ('type' in item) {
      setSelectedItem(item);
      // keep selectedFolderId as-is for files
    } else {
      setSelectedFolderId(item.id);
      setSelectedItem(item);
    }

    let x = Math.max(10, e.clientX);
    let y = Math.max(10, e.clientY);

    if (x + menuWidth > window.innerWidth) {
      x = Math.max(10, window.innerWidth - menuWidth - 10);
    }
    // Prefer opening below cursor; if it would overflow, position upwards within viewport
    if (y + maxMenuHeight > window.innerHeight - 10) {
      y = Math.max(10, window.innerHeight - maxMenuHeight - 10);
    }

    setContextMenu({
      x,
      y,
      item,
      type: 'type' in item ? 'file' : 'folder'
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleFileUpload = (folderId: string) => {
    console.log(`[Upload] Triggering file upload for folderId: ${folderId}`);
    setShowFileUpload(folderId);
    if (fileInputRef.current) {
      console.log('[Upload] File input ref found, clicking.');
      fileInputRef.current.click();
    } else {
      console.error('[Upload] File input ref not found!');
    }
  };

  const handleFileClick = (file: DatabaseFile) => {
    if (onFileOpen) {
      onFileOpen(file);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('[Upload] handleFileSelected triggered.');

    if (!files || files.length === 0 || !projectId || !showFileUpload) {
      console.log('[Upload] Pre-condition failed:', { hasFiles: !!files, projectId, showFileUpload });
      return;
    }

    const file = files[0];
    console.log(`[Upload] File selected: ${file.name}, Size: ${file.size}`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folderId', showFileUpload);

    try {
      console.log('[Upload] Sending file to server...');
      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        body: formData
      });

      console.log(`[Upload] Server response status: ${response.status}`);
      if (response.ok) {
        await loadFoldersAndFiles();
        showNotification('File uploaded successfully!', 'success');
      } else {
        const errorData = await response.json();
        console.error('[Upload] Server error:', errorData);
        showNotification(errorData.error || 'Failed to upload file', 'error');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      showNotification('Error uploading file', 'error');
    } finally {
      setShowFileUpload(null);
      // Reset file input value to allow re-uploading the same file
      if (e.target) {
        e.target.value = '';
      }
      console.log('[Upload] File input value reset.');
    }
  };

  const startInlineRename = (item: DatabaseFolder | DatabaseFile) => {
    setInlineRename({ itemId: item.id, newName: item.name });
    setContextMenu(null);
  };

  const saveInlineRename = async () => {
    if (!inlineRename || !projectId) return;
    
    const item = findItemById(inlineRename.itemId);
    if (!item) return;
    
    const isFile = 'type' in item;
    
    try {
      const endpoint = isFile ? 'files' : 'folders';
      const body = isFile 
        ? { fileId: item.id, name: inlineRename.newName }
        : { folderId: item.id, name: inlineRename.newName };

      const response = await fetch(`/api/projects/${projectId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadFoldersAndFiles();
        setInlineRename(null);
      }
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };

  const cancelInlineRename = () => {
    setInlineRename(null);
  };

  const handleFolderClick = (folderId: string) => {
    setSelectedFolderId(folderId);
    setSelectedItem(findItemById(folderId));
  };

  // Global outside-click detector to clear selection/context menu
  useEffect(() => {
    const onDocMouseDown = (ev: MouseEvent) => {
      const root = panelRef.current;
      if (!root) return;
      const target = ev.target as Node | null;
      if (target && !root.contains(target)) {
        setSelectedFolderId(null);
        setSelectedItem(null);
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const startCreateSubfolder = (parentId: string) => {
    setCreatingSubfolder({ parentId, name: '' });
    setContextMenu(null);
  };

  const saveSubfolder = async () => {
    if (!creatingSubfolder || !projectId || !creatingSubfolder.name.trim()) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: creatingSubfolder.name.trim(), 
          parentId: creatingSubfolder.parentId 
        })
      });

      if (response.ok) {
        await loadFoldersAndFiles();
        setCreatingSubfolder(null);
      }
    } catch (error) {
      console.error('Error creating subfolder:', error);
    }
  };

  const cancelCreateSubfolder = () => {
    setCreatingSubfolder(null);
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getFileIcon = (file: DatabaseFile) => {
    switch (file.type) {
      case 'word':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'pdf':
        return <File className="w-4 h-4 text-red-400" />;
      case 'excel':
        return <FileSpreadsheet className="w-4 h-4 text-green-400" />;
      case 'dwg':
        return <FileImage className="w-4 h-4 text-purple-400" />;
      default:
        return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleSendZip = async () => {
    if (!showSendZipModal || !projectId) return;
    
    const { item, recipients, subject, message } = showSendZipModal;
    const isFile = 'type' in item;
    
    const cleanedRecipients = Array.isArray(recipients)
      ? recipients.map(r => (r || '').trim()).filter(r => r.length > 0)
      : [];

    if (cleanedRecipients.length === 0) {
      showNotification('Please add at least one valid recipient email', 'error');
      return;
    }
    
    try {
      // Show sending overlay
      setIsSending(true);
      setSendingMessage('Creating ZIP and sending email...');

      const response = await fetch(`/api/projects/${projectId}/files/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          itemType: isFile ? 'file' : 'folder',
          recipients: cleanedRecipients,
          subject: subject || `Shared ${isFile ? 'file' : 'folder'}: ${item.name}`,
          message: message || `Please find the attached ${isFile ? 'file' : 'folder'}.`,
          shareType: 'zip'
        })
      });

      if (response.ok) {
        setSendingMessage('ZIP sent successfully!');
        setShowSendZipModal(null);
        showNotification(`ZIP sent successfully to ${cleanedRecipients.length} recipient(s)!`, 'success');
      } else {
        const errorData = await response.json();
        showNotification(errorData.error || 'Failed to send ZIP', 'error');
      }
    } catch (error) {
      console.error('Error sending ZIP:', error);
      showNotification('Error sending ZIP', 'error');
    } finally {
      // Hide overlay after a short delay for UX feedback
      setTimeout(() => {
        setIsSending(false);
        setSendingMessage('');
      }, 600);
    }
  };

  const findItemById = (id: string): DatabaseFolder | DatabaseFile | null => {
    const findInFolder = (folder: DatabaseFolder): DatabaseFolder | DatabaseFile | null => {
      if (folder.id === id) return folder;
      for (const child of folder.children) {
        if (child.id === id) return child;
        if ('children' in child) {
          const found = findInFolder(child);
          if (found) return found;
        }
      }
      return null;
    };
    
    for (const folder of folders) {
      const found = findInFolder(folder);
      if (found) return found;
    }
    return null;
  };

  const handleRename = async () => {
    if (!showRenameModal || !projectId) return;
    
    const { item, newName } = showRenameModal;
    const isFile = 'type' in item;
    
    try {
      const endpoint = isFile ? 'files' : 'folders';
      const body = isFile 
        ? { fileId: item.id, name: newName }
        : { folderId: item.id, name: newName };

      const response = await fetch(`/api/projects/${projectId}/${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadFoldersAndFiles();
        setShowRenameModal(null);
      }
    } catch (error) {
      console.error('Error renaming:', error);
    }
  };

  const handleDelete = async (item: DatabaseFolder | DatabaseFile) => {
    if (!projectId) return;
    
    const isFile = 'type' in item;
    const endpoint = isFile ? 'files' : 'folders';
    const param = isFile ? `fileId=${item.id}` : `folderId=${item.id}`;

    try {
      const response = await fetch(`/api/projects/${projectId}/${endpoint}?${param}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadFoldersAndFiles();
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleSendEmail = async () => {
    if (!showEmailModal || !projectId) return;
    
    const { item, email } = showEmailModal;
    const isFile = 'type' in item;

    try {
      const trimmed = (email || '').trim();
      if (!trimmed) {
        showNotification('Please enter a valid recipient email', 'error');
        return;
      }
      setIsSending(true);
      setSendingMessage('Sending email...');

      const response = await fetch(`/api/projects/${projectId}/files/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          action: 'email',
          email: trimmed
        })
      });

      if (response.ok) {
        setSendingMessage('Email sent!');
        setShowEmailModal(null);
        showNotification('Email sent successfully!', 'success');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    } finally {
      setTimeout(() => {
        setIsSending(false);
        setSendingMessage('');
      }, 600);
    }
  };

  const handleCreateShareLink = async (item: DatabaseFolder | DatabaseFile) => {
    if (!projectId) return;
    
    const isFile = 'type' in item;

    try {
      const response = await fetch(`/api/projects/${projectId}/files/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          action: 'link'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setShowShareLinkModal({ item, shareUrl: data.shareUrl });
      }
    } catch (error) {
      console.error('Error creating share link:', error);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleAssignUser = async () => {
    if (!showUserAssignModal || !projectId) return;
    
    const { item, email, mode } = showUserAssignModal;
    const isFile = 'type' in item;

    try {
      if (mode !== 'remove') {
        setAssignLoading(true);
        setAssignResult(null);
      }
      const response = await fetch(`/api/projects/${projectId}/files/assign`, {
        method: mode === 'remove' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          email: email
        })
      });

      if (response.ok) {
        if (mode === 'remove') {
          setShowUserAssignModal(null);
        } else {
          // Append to assignees list (avoid duplicates) and clear input
          setAssignees(prev => {
            const list = prev || [];
            if (!list.find(a => a.assignedTo === email)) {
              return [{ assignedTo: email }, ...list];
            }
            return list;
          });
          setShowUserAssignModal(prev => (prev ? { ...prev, email: '' } : prev));
        }
        showNotification(`User ${mode === 'remove' ? 'removed' : 'assigned'} successfully!`, 'success');
      }
    } catch (error) {
      console.error('Error with user assignment:', error);
      if (mode !== 'remove') {
        setAssignResult({ email: showUserAssignModal.email, status: 'error', message: 'Failed to assign' });
      }
    }
    finally {
      if (mode !== 'remove') setAssignLoading(false);
    }
  };

  const handleRemoveAssignee = async (email: string) => {
    if (!showUserAssignModal || !projectId) return;
    const { item } = showUserAssignModal;
    const isFile = 'type' in item;
    try {
      const response = await fetch(`/api/projects/${projectId}/files/assign`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isFile ? 'file' : 'folder',
          itemId: item.id,
          email
        })
      });
      if (response.ok) {
        setAssignees(prev => (prev || []).filter(a => a.assignedTo !== email));
        showNotification('Access removed successfully!', 'success');
      } else {
        const err = await response.json().catch(() => ({}));
        showNotification(err.error || 'Failed to remove access', 'error');
      }
    } catch (e) {
      console.error('Error removing assignee:', e);
      showNotification('Error removing access', 'error');
    }
  };

  const handleDownloadFile = (file: DatabaseFile) => {
    if (!projectId) return;
    window.location.href = `/api/projects/${projectId}/files/download?fileId=${file.id}`;
  };

  const toggleFolderExpansion = (folderId: string) => {
    const updateFolderRecursive = (folders: DatabaseFolder[]): DatabaseFolder[] => {
      return folders.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, isExpanded: !folder.isExpanded };
        }
        if (folder.children) {
          const updatedChildren = updateFolderRecursive(folder.children.filter(child => !('type' in child)) as DatabaseFolder[]);
          const files = folder.children.filter(child => 'type' in child);
          return { ...folder, children: [...updatedChildren, ...files] };
        }
        return folder;
      });
    };
    
    setFolders(prev => updateFolderRecursive(prev));
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

  const renderMoveFolderPicker = (folders: DatabaseFolder[], level = 0): React.ReactNode[] => {
    return folders.map(folder => {
      return (
        <div key={folder.id} style={{ marginLeft: `${level * 1.25}rem` }}>
          <button 
            className={`w-full text-left px-2 py-1 rounded ${moveState?.targetFolderId === folder.id ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}`}
            onClick={() => setMoveState(prev => prev ? { ...prev, targetFolderId: folder.id } : null)}
          >
            <span className="inline-flex items-center gap-2 flex-1">
              <Folder className="w-4 h-4 text-yellow-400" />
              {inlineRename && inlineRename.itemId === folder.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={inlineRename.newName}
                    onChange={(e) => setInlineRename(prev => prev ? { ...prev, newName: e.target.value } : null)}
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveInlineRename();
                      if (e.key === 'Escape') cancelInlineRename();
                    }}
                  />
                  <button
                    onClick={saveInlineRename}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelInlineRename}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                folder.name
              )}
            </span>
          </button>
          {'children' in folder && folder.children && folder.children.length > 0 && (
            <div>
              {renderMoveFolderPicker(folder.children.filter(child => !('type' in child)) as DatabaseFolder[], level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderFolderTree = (items: (DatabaseFolder | DatabaseFile)[], level = 0): React.ReactNode => {
    return items.map((item) => {
      const isFile = 'type' in item;
      const isFolder = !isFile;
      
      return (
        <div key={item.id} style={{ marginLeft: `${Math.min(level * 0.75, 3)}rem` }}>
          <div 
            key={item.id}
            className={`group flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer ${
              selectedFolderId === item.id ? 'bg-blue-700' : 
              (isFile && openFileId === item.id) ? 'bg-green-700' :
              selectedItem?.id === item.id ? 'bg-gray-700' : ''
            }`}
            onClick={() => {
              if (isFolder) {
                handleFolderClick(item.id);
                const folder = item as DatabaseFolder;
                toggleFolderExpansion(folder.id);
              } else {
                setSelectedItem(item);
                handleFileClick(item as DatabaseFile);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            {isFolder && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const folder = item as DatabaseFolder;
                  toggleFolderExpansion(folder.id);
                }}
                className="p-0.5 hover:bg-gray-600 rounded"
              >
                {(item as DatabaseFolder).isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                )}
              </button>
            )}
            
            {isFile ? (
              getFileIcon(item as DatabaseFile)
            ) : (
              <Folder className="w-4 h-4 text-yellow-400" />
            )}
            
            {inlineRename && inlineRename.itemId === item.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={inlineRename.newName}
                  onChange={(e) => setInlineRename(prev => prev ? { ...prev, newName: e.target.value } : null)}
                  className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveInlineRename();
                    if (e.key === 'Escape') cancelInlineRename();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveInlineRename();
                  }}
                  className="p-1 text-green-400 hover:text-green-300"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelInlineRename();
                  }}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="text-gray-200 text-sm flex-1 truncate" title={item.name}>{item.name}</span>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, item);
              }}
              className="p-1 hover:bg-gray-600 rounded opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="w-3 h-3 text-gray-400" />
            </button>
          </div>
          
          {isFolder && (item as DatabaseFolder).isExpanded && (
            <div className="mt-1">
              {/* Show subfolder creation input if creating subfolder for this folder */}
              {creatingSubfolder && creatingSubfolder.parentId === item.id && (
                <div 
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-600 rounded mx-3 mb-2"
                  style={{ marginLeft: `${Math.min((level + 1) * 0.75, 3)}rem` }}
                >
                  <Folder className="w-4 h-4 text-yellow-400" />
                  <input
                    type="text"
                    value={creatingSubfolder.name}
                    onChange={(e) => setCreatingSubfolder(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Enter subfolder name"
                    className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveSubfolder();
                      if (e.key === 'Escape') cancelCreateSubfolder();
                    }}
                  />
                  <button
                    onClick={saveSubfolder}
                    className="p-1 text-green-400 hover:text-green-300"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelCreateSubfolder}
                    className="p-1 text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {(item as DatabaseFolder).children.length > 0 && (
                renderFolderTree((item as DatabaseFolder).children, level + 1)
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div 
      className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col h-full relative"
      ref={panelRef}
    >
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
            onClick={() => setActiveCommand('new')}
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
          <h3 className="text-sm font-medium text-gray-400 mb-3 tracking-wide">
            Folders & Files
          </h3>
          {moveState ? (
            <div className="space-y-4">
              <div className="bg-gray-800 p-3 rounded border border-gray-700">
                <h4 className="text-sm font-medium text-white mb-2">Move '{moveState.item.name}' to:</h4>
                <div className="max-h-48 overflow-auto border border-gray-600 rounded p-2 bg-gray-900">
                  <button 
                    className={`w-full text-left px-2 py-1 rounded mb-1 ${!moveState.targetFolderId ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-200'}`}
                    onClick={() => setMoveState(prev => prev ? { ...prev, targetFolderId: null } : null)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Folder className="w-4 h-4 text-yellow-400" />
                      Root Folder
                    </span>
                  </button>
                  {renderMoveFolderPicker(folders)}
                </div>
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setMoveState(null)} className="px-3 py-1 text-gray-300 hover:text-white text-sm">Cancel</button>
                  <button onClick={handleMoveConfirm} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Move</button>
                </div>
              </div>
            </div>
          ) : (
            renderFolderTree(folders)
          )}
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


      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-48"
            style={{ 
              left: contextMenu.x, 
              top: contextMenu.y,
              maxHeight: 'min(380px, calc(100vh - 20px))',
              overflowY: 'auto'
            }}
          >
            {contextMenu.type === 'folder' ? (
              // Folder context menu
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
                    setShowSendZipModal({ 
                      item: contextMenu.item,
                      recipients: [],
                      subject: '',
                      message: ''
                    });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Folder
                </button>
                <button
                  onClick={() => {
                    startInlineRename(contextMenu.item);
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
                    startCreateSubfolder(contextMenu.item.id);
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Subfolder
                </button>
                <button
                  onClick={() => {
                    handleCreateShareLink(contextMenu.item);
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Create Share Link
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to User
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'remove' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Remove User Access
                </button>
                <button
                  onClick={() => {
                    setShowSendZipModal({ 
                      item: contextMenu.item,
                      recipients: [],
                      subject: '',
                      message: ''
                    });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Archive className="w-4 h-4 mr-2" />
                  Send as ZIP
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm({ item: contextMenu.item });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-red-400 flex items-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Folder
                </button>
              </>
            ) : (
              // File context menu
              <>
                <button
                  onClick={() => { handleDownloadFile(contextMenu.item as DatabaseFile); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download File
                </button>
                <button
                  onClick={() => {
                    startInlineRename(contextMenu.item);
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
                  <FileText className="w-4 h-4 mr-2" />
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
                  Send via Email
                </button>
                <button
                  onClick={() => { handleCreateShareLink(contextMenu.item); closeContextMenu(); }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Create Share Link
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Assign to User
                </button>
                <button
                  onClick={() => {
                    setShowUserAssignModal({ item: contextMenu.item, email: '', mode: 'remove' });
                    closeContextMenu();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-700 text-gray-300 flex items-center"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  Remove User Access
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm({ item: contextMenu.item });
                    closeContextMenu();
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-[28rem] shadow-2xl border border-gray-700">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-600/20 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">Confirm Deletion</h3>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Are you sure you want to delete '{'type' in showDeleteConfirm.item ? (showDeleteConfirm.item as any).name : showDeleteConfirm.item.name}'?
            </p>
            <div className="bg-gray-900/60 border border-gray-700 rounded p-3 text-xs text-gray-400 mb-4">
              This action cannot be undone.
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const item = showDeleteConfirm.item;
                  setShowDeleteConfirm(null);
                  await handleDelete(item);
                  showNotification('Deleted successfully', 'success');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Rename {'type' in showRenameModal.item ? 'File' : 'Folder'}</h3>
            <input
              type="text"
              value={showRenameModal.newName}
              onChange={(e) => setShowRenameModal(prev => prev ? { ...prev, newName: e.target.value } : null)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowRenameModal(null)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
              <button onClick={handleRename} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded">Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-96 shadow-2xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">Send via Email</h3>
            </div>
            
            <p className="text-gray-300 text-sm mb-4">
              Send "{showEmailModal.item.name}" via email
            </p>
            
            <input
              type="email"
              value={showEmailModal.email}
              onChange={(e) => setShowEmailModal(prev => prev ? { ...prev, email: e.target.value } : null)}
              placeholder="Enter recipient email"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowEmailModal(null)} 
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendEmail} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Assignment Modal */}
      {showUserAssignModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-semibold text-white mb-4">
              {showUserAssignModal.mode === 'remove' ? 'Remove User Access' : 'Assign to User'}
            </h3>
            {showUserAssignModal.mode !== 'remove' && (
              <input
                type="email"
                value={showUserAssignModal.email}
                onChange={(e) => setShowUserAssignModal(prev => prev ? { ...prev, email: e.target.value } : null)}
                placeholder="Enter user email"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
                autoFocus
              />
            )}
            {/* In Assign mode, show list of currently shared users (no status text) */}
            {showUserAssignModal.mode !== 'remove' && (
              assigneesLoading ? (
                <div className="mt-3 text-sm text-gray-400">Loading shared users...</div>
              ) : (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">Assigned users</div>
                  {assignees && assignees.length > 0 ? (
                    <div className="max-h-40 overflow-auto border border-gray-700 rounded divide-y divide-gray-700">
                      {assignees.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2">
                          <div className="text-sm text-gray-200">{a.assignedTo}</div>
                          <span className="text-xs text-green-400">Assigned</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No users have access yet.</div>
                  )}
                </div>
              )
            )}
            {/* Shared with list — only in Remove mode */}
            {showUserAssignModal.mode === 'remove' && (
              assigneesLoading ? (
                <div className="mt-3 text-sm text-gray-400">Loading shared users...</div>
              ) : (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-300 mb-2">Shared with</div>
                  {assignees && assignees.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-auto">
                      {assignees.map((a, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-gray-700/60 border border-gray-600 rounded px-3 py-2">
                          <div>
                            <div className="text-sm text-gray-200">{a.assignedTo}</div>
                            {a.permissions && <div className="text-xs text-gray-400">Perm: {a.permissions.join(', ')}</div>}
                          </div>
                          <button
                            onClick={() => handleRemoveAssignee(a.assignedTo)}
                            className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No users have access yet.</div>
                  )}
                </div>
              )
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowUserAssignModal(null); }} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
              {showUserAssignModal.mode !== 'remove' && (
                <button
                  onClick={handleAssignUser}
                  disabled={assignLoading}
                  className={`px-4 py-2 rounded text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2`}
                >
                  {assignLoading && (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                  )}
                  {assignLoading ? 'Assigning...' : 'Assign'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Link Modal */}
      {showShareLinkModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-96 shadow-2xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Share className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">Share Link Created</h3>
            </div>
            
            <p className="text-gray-300 text-sm mb-4">
              Share this link to give others access to "{showShareLinkModal.item.name}"
            </p>
            
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-600 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={showShareLinkModal.shareUrl}
                  readOnly
                  className="flex-1 bg-transparent text-gray-300 text-sm outline-none"
                />
                <button
                  onClick={() => handleCopyLink(showShareLinkModal.shareUrl)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    copySuccess 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button 
                onClick={() => setShowShareLinkModal(null)} 
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send as ZIP Modal */}
      {showSendZipModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-96 shadow-2xl border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-600 rounded-lg">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">Send as ZIP</h3>
            </div>
            
            <p className="text-gray-300 text-sm mb-4">
              Send "{showSendZipModal.item.name}" as a ZIP file via email
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Recipients</label>
                <div className="space-y-2">
                  {showSendZipModal.recipients.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const newRecipients = [...showSendZipModal.recipients];
                          newRecipients[index] = e.target.value;
                          setShowSendZipModal(prev => prev ? { ...prev, recipients: newRecipients } : null);
                        }}
                        className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
                        placeholder="Enter email address"
                      />
                      <button
                        onClick={() => {
                          const newRecipients = showSendZipModal.recipients.filter((_, i) => i !== index);
                          setShowSendZipModal(prev => prev ? { ...prev, recipients: newRecipients } : null);
                        }}
                        className="p-2 text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setShowSendZipModal(prev => prev ? { 
                        ...prev, 
                        recipients: [...prev.recipients, ''] 
                      } : null);
                    }}
                    className="w-full p-2 border-2 border-dashed border-gray-600 rounded text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  >
                    + Add Recipient
                  </button>
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Previous recipients</span>
                      <button
                        onClick={fetchZipRecipients}
                        className="text-xs text-blue-400 hover:text-blue-300"
                        title="Refresh"
                      >
                        Refresh
                      </button>
                    </div>
                    {zipRecipientsLoading ? (
                      <div className="text-xs text-gray-400">Loading…</div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(zipRecipients || []).length === 0 ? (
                          <span className="text-xs text-gray-500">No history</span>
                        ) : (
                          (zipRecipients || []).map((r) => {
                            const already = showSendZipModal.recipients.some(e => (e || '').trim().toLowerCase() === r.toLowerCase());
                            return (
                              <button
                                key={r}
                                onClick={() => {
                                  if (already) return;
                                  setShowSendZipModal(prev => prev ? { ...prev, recipients: [...prev.recipients, r] } : null);
                                }}
                                className={`text-xs px-2 py-1 rounded border ${already ? 'bg-gray-700 border-gray-600 text-gray-400 cursor-default' : 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'}`}
                                disabled={already}
                                title={already ? 'Already added' : 'Add'}
                              >
                                {r}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                <input
                  type="text"
                  value={showSendZipModal.subject}
                  onChange={(e) => setShowSendZipModal(prev => prev ? { ...prev, subject: e.target.value } : null)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
                  placeholder="Email subject"
                />
              </div>
              
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                <textarea
                  value={showSendZipModal.message}
                  onChange={(e) => setShowSendZipModal(prev => prev ? { ...prev, message: e.target.value } : null)}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 h-20 resize-none"
                  placeholder="Optional message"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowSendZipModal(null)} 
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSendZip} 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Send ZIP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          notification.type === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <X className="w-5 h-5" />
            )}
            <span>{notification.message}</span>
          </div>
        </div>
      )}

      {/* Sending Overlay */}
      {isSending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 bg-gray-900/90 border border-gray-700 rounded-xl px-6 py-5 shadow-2xl">
            <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" aria-label="Loading" />
            <div className="text-sm text-gray-200">{sendingMessage || 'Processing...'}</div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".doc,.docx,.pdf,.xls,.xlsx,.dwg"
        onChange={handleFileSelected}
      />
    </div>
  );
}
