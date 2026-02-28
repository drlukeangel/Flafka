import React, { useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { TreeNode as TreeNodeType } from '../../types';
import {
  FiChevronRight,
  FiChevronDown,
  FiDatabase,
  FiFolder,
  FiGrid,
  FiEye,
  FiBox,
  FiCode,
  FiExternalLink,
  FiLoader,
} from 'react-icons/fi';

const TreeNavigator: React.FC = () => {
  const {
    treeNodes,
    treeLoading,
    selectedNodeId,
    loadTreeData,
    toggleTreeNode,
    selectTreeNode,
    addStatement,
    catalog,
    database,
    selectedTableSchema,
    selectedTableName,
    schemaLoading,
  } = useWorkspaceStore();

  useEffect(() => {
    loadTreeData();
  }, [loadTreeData]);

  const handleDoubleClick = (node: TreeNodeType) => {
    if (node.type === 'table' || node.type === 'view') {
      const tableName = node.name;
      const query = `SELECT * FROM \`${catalog}\`.\`${database}\`.\`${tableName}\` LIMIT 10;`;
      addStatement(query);
    }
  };

  return (
    <div className="tree-navigator">
      <div className="tree-header">
        <h3>Workspace Explorer</h3>
      </div>
      <div className="tree-content">
        {treeLoading ? (
          <div className="tree-loading">
            <FiLoader className="animate-spin" />
            <span>Loading...</span>
          </div>
        ) : treeNodes.length > 0 ? (
          treeNodes.map((node) => (
            <TreeNodeComponent
              key={node.id}
              node={node}
              level={0}
              selectedNodeId={selectedNodeId}
              onToggle={toggleTreeNode}
              onSelect={selectTreeNode}
              onDoubleClick={handleDoubleClick}
            />
          ))
        ) : (
          <div className="tree-empty">
            <span>No database objects found</span>
          </div>
        )}
      </div>
      {selectedTableName && (
        <div className="schema-panel">
          <div className="schema-header">
            <h4>{selectedTableName}</h4>
          </div>
          {schemaLoading ? (
            <div className="schema-loading"><FiLoader className="animate-spin" /> Loading...</div>
          ) : selectedTableSchema.length > 0 ? (
            <div className="schema-content">
              <div className="schema-section">
                <span className="schema-section-title">Schema ({selectedTableSchema.length})</span>
              </div>
              {selectedTableSchema.map((col) => (
                <div key={col.name} className="schema-column">
                  <span className="column-name">{col.name}</span>
                  <span className="column-type">{col.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="schema-empty">No columns found</div>
          )}
        </div>
      )}
    </div>
  );
};

interface TreeNodeProps {
  node: TreeNodeType;
  level: number;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onDoubleClick: (node: TreeNodeType) => void;
}

const TreeNodeComponent: React.FC<TreeNodeProps> = ({
  node,
  level,
  selectedNodeId,
  onToggle,
  onSelect,
  onDoubleClick,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpandable = hasChildren || ['catalog', 'database', 'tables', 'views', 'models', 'functions', 'externalTables'].includes(node.type);
  const isSelected = selectedNodeId === node.id;
  const isEmpty = node.children?.length === 0 && ['tables', 'views', 'models', 'functions', 'externalTables'].includes(node.type);

  const getIcon = () => {
    switch (node.type) {
      case 'catalog':
        return <FiFolder className="node-icon catalog" />;
      case 'database':
        return <FiDatabase className="node-icon database" />;
      case 'tables':
      case 'table':
        return <FiGrid className="node-icon table" />;
      case 'views':
      case 'view':
        return <FiEye className="node-icon view" />;
      case 'models':
      case 'model':
        return <FiBox className="node-icon model" />;
      case 'functions':
      case 'function':
        return <FiCode className="node-icon function" />;
      case 'externalTables':
      case 'externalTable':
        return <FiExternalLink className="node-icon external" />;
      default:
        return <FiFolder className="node-icon" />;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
    if (isExpandable) {
      onToggle(node.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick(node);
  };

  return (
    <div className="tree-node-wrapper">
      <div
        className={`tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <span className="node-chevron">
          {isExpandable ? (
            node.isExpanded ? (
              <FiChevronDown size={14} />
            ) : (
              <FiChevronRight size={14} />
            )
          ) : (
            <span style={{ width: 14 }} />
          )}
        </span>
        {getIcon()}
        <span className="node-label">{node.name}</span>
        {node.isLoading && <FiLoader className="animate-spin node-loading" size={12} />}
      </div>

      {node.isExpanded && hasChildren && (
        <div className="tree-children">
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              level={level + 1}
              selectedNodeId={selectedNodeId}
              onToggle={onToggle}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
            />
          ))}
        </div>
      )}

      {node.isExpanded && isEmpty && (
        <div
          className="tree-empty-category"
          style={{ paddingLeft: `${(level + 1) * 16 + 4}px` }}
        >
          <span className="empty-text">No {node.name.toLowerCase()} yet</span>
        </div>
      )}
    </div>
  );
};

export default TreeNavigator;
