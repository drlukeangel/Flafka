import { useEffect } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { TreeNavigator } from './components/TreeNavigator';
import { EditorCell } from './components/EditorCell';
import { Dropdown } from './components/Dropdown';
import Toast from './components/ui/Toast';
import { env } from './config/environment';
import { FiDatabase, FiPlus, FiSettings, FiCpu } from 'react-icons/fi';
import './App.css';

function App() {
  const {
    catalog,
    database,
    catalogs,
    databases,
    statements,
    lastSavedAt,
    setCatalog,
    setDatabase,
    loadCatalogs,
    loadDatabases,
    addStatement,
  } = useWorkspaceStore();

  useEffect(() => {
    // Load initial data
    loadCatalogs();
    loadDatabases(catalog);
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <FiDatabase size={24} />
            <span>SQL Workspace</span>
          </div>
        </div>
        <div className="header-center">
          <div className="environment-info">
            <FiCpu size={14} />
            <span>Compute Pool: {env.computePoolId}</span>
          </div>
        </div>
        <div className="header-right">
          <button className="header-btn">
            <FiSettings size={18} />
          </button>
        </div>
      </header>

      <div className="app-content">
        {/* Sidebar - Tree Navigator */}
        <aside className="sidebar">
          <TreeNavigator />
        </aside>

        {/* Main Content - Editor Area */}
        <main className="main-content">
          {/* Toolbar with Catalog/Database selectors */}
          <div className="editor-toolbar">
            <div className="toolbar-selectors">
              <Dropdown
                label="Catalog"
                value={catalog}
                options={catalogs}
                onChange={setCatalog}
              />
              <Dropdown
                label="Database"
                value={database}
                options={databases}
                onChange={setDatabase}
              />
            </div>
            <div className="toolbar-actions">
              <button className="add-cell-btn" onClick={() => addStatement()}>
                <FiPlus size={16} />
                <span>Add Statement</span>
              </button>
            </div>
          </div>

          {/* Editor Cells */}
          <div className="editor-cells">
            {statements.map((statement, index) => (
              <EditorCell key={statement.id} statement={statement} index={index} />
            ))}
          </div>

          {/* Footer Status */}
          <div className="editor-footer">
            <span className="cell-count">{statements.length} statement(s)</span>
            {lastSavedAt && (
              <span className="last-saved">
                Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            )}
            <span className="env-info">
              {env.cloudProvider.toUpperCase()} | {env.cloudRegion}
            </span>
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}

export default App;
