'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SharedItem {
  token: string;
  type: 'file' | 'folder';
  itemId: string;
  projectId: string;
  expiresAt: string;
  item: {
    name: string;
    size?: number;
    type?: string;
  };
}

export default function SharedPage() {
  const params = useParams();
  const token = params.token as string;
  const [sharedItem, setSharedItem] = useState<SharedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedItem();
    }
  }, [token]);

  const fetchSharedItem = async () => {
    try {
      const response = await fetch(`/api/shared/${token}`);
      if (!response.ok) {
        throw new Error('Shared link not found or expired');
      }
      const data = await response.json();
      setSharedItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared item');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (sharedItem && sharedItem.type === 'file') {
      window.location.href = `/api/projects/${sharedItem.projectId}/files/download?fileId=${sharedItem.itemId}`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">404</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!sharedItem) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">404</h1>
          <p className="text-muted-foreground">This page could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-card flex items-center justify-center">
      <div className="bg-card p-8 rounded-lg max-w-md w-full mx-4">
        <h1 className="text-2xl font-bold text-foreground mb-4">Shared {sharedItem.type}</h1>
        <div className="bg-muted p-4 rounded mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-2">{sharedItem.item.name}</h2>
          {sharedItem.type === 'file' && sharedItem.item.size && (
            <p className="text-muted-foreground">Size: {(sharedItem.item.size / 1024 / 1024).toFixed(1)} MB</p>
          )}
          <p className="text-muted-foreground text-sm mt-2">
            Expires: {new Date(sharedItem.expiresAt).toLocaleDateString()}
          </p>
        </div>
        
        {sharedItem.type === 'file' ? (
          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-foreground py-2 px-4 rounded"
          >
            Download File
          </button>
        ) : (
          <a
            href={`/projects/${sharedItem.projectId}/database?folderId=${sharedItem.itemId}`}
            className="block w-full bg-blue-600 hover:bg-blue-700 text-foreground py-2 px-4 rounded text-center"
          >
            View Folder
          </a>
        )}
      </div>
    </div>
  );
}
