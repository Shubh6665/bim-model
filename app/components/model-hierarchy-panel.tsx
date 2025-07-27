"use client";

import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

// Component Props
interface ModelHierarchyPanelProps {
  viewer: any; // The Forge Viewer instance
  onClose: () => void;
}

// Data structure for a tree node
interface TreeNode {
  dbId: number;
  name: string;
  children: TreeNode[];
}

// Props for the recursive TreeNodeComponent
interface TreeNodeProps {
  node: TreeNode;
  viewer: any;
  onNodeSelect: (dbId: number) => void;
}

// Recursive component to render each node in the tree
const TreeNodeComponent: React.FC<TreeNodeProps> = ({ node, viewer, onNodeSelect }) => {
  // Expand all non-leaf nodes by default
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(hasChildren);
  const [isHovered, setIsHovered] = useState(false);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeSelect(node.dbId);
  };

  return (
    <div className="ml-3 border-l border-gray-700 pl-2">
      <div
        className={`flex items-center group rounded px-1 py-0.5 transition-colors ${isHovered ? 'bg-indigo-600/20' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleSelect}
        style={{ minHeight: 28, cursor: 'pointer' }}
      >
        {hasChildren ? (
          <span onClick={handleToggle} className="flex items-center select-none">
            {isExpanded ? <ChevronDown size={16} className="text-indigo-400" /> : <ChevronRight size={16} className="text-gray-400" />}
          </span>
        ) : (
          <span className="w-4"></span>
        )}
        <span className="ml-1 text-sm group-hover:text-indigo-300 transition-colors font-medium">
          {node.name}
        </span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNodeComponent key={child.dbId} node={child} viewer={viewer} onNodeSelect={onNodeSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

// Main panel component
const ModelHierarchyPanel: React.FC<ModelHierarchyPanelProps> = ({ viewer, onClose }) => {
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (viewer && viewer.model) {
      setIsLoading(true);
      setError(null);
      viewer.model.getObjectTree(
        (instanceTree: any) => {
          if (!instanceTree) {
            setError("Could not get instance tree.");
            setIsLoading(false);
            return;
          }
          const rootId = instanceTree.getRootId();
          
          const buildTree = (rootId: number) => {
            const tree: TreeNode = { dbId: rootId, name: 'Root', children: [] };
            instanceTree.enumNodeChildren(rootId, (childId: number) => {
              tree.children.push(buildNode(childId));
            });
            return tree;
          };

          const buildNode = (dbId: number): TreeNode => {
            const children: TreeNode[] = [];
            instanceTree.enumNodeChildren(dbId, (childId: number) => {
              children.push(buildNode(childId));
            });
            return {
              dbId,
              name: instanceTree.getNodeName(dbId),
              children,
            };
          };

          setTreeData(buildTree(rootId));
          setIsLoading(false);
        },
        (err: any) => {
          setError("Error loading model hierarchy.");
          console.error(err);
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
      setError("Viewer or model not available.");
    }
  }, [viewer]);

  const handleNodeSelect = (dbId: number) => {
    if (viewer) {
      viewer.select(dbId);
      viewer.fitToView([dbId], viewer.model);
    }
  };

  return (
    <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col p-0 text-white shadow-2xl rounded-l-xl">
      <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-indigo-900/80 to-gray-900/80">
        <h3 className="text-xl font-bold tracking-wide text-indigo-300">Model Hierarchy</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none px-2 py-1 rounded transition-colors hover:bg-gray-700">&times;</button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar py-2 px-4">
        {isLoading && <p className="text-indigo-300">Loading hierarchy...</p>}
        {error && <p className="text-red-400">{error}</p>}
        {treeData && (
          <TreeNodeComponent node={treeData} viewer={viewer} onNodeSelect={handleNodeSelect} />
        )}
      </div>
    </div>
  );
};

export default ModelHierarchyPanel;
