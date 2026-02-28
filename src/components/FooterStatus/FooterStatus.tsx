import { useWorkspaceStore } from '../../store/workspaceStore';
import type { WorkspaceState } from '../../store/workspaceStore';

export default function FooterStatus() {
  const statements = useWorkspaceStore((s: WorkspaceState) => s.statements);
  const focusedStatementId = useWorkspaceStore((s: WorkspaceState) => s.focusedStatementId);
  const lastSavedAt = useWorkspaceStore((s: WorkspaceState) => s.lastSavedAt);

  const focusedIndex = focusedStatementId
    ? statements.findIndex((s) => s.id === focusedStatementId)
    : -1;

  const cellPositionText = focusedIndex >= 0
    ? `Cell ${focusedIndex + 1} of ${statements.length}`
    : `${statements.length} statement(s)`;

  return (
    <div className="editor-footer">
      <span className={`cell-count${focusedIndex >= 0 ? ' cell-count--focused' : ''}`}>
        {cellPositionText}
      </span>
      {lastSavedAt && (
        <span className="last-saved">
          Last saved at {new Date(lastSavedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
