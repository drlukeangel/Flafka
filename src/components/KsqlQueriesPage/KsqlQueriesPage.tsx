/**
 * @ksql-queries-page
 * ksqlDB Queries page — container that routes between list and detail views.
 */
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { KsqlQueriesList } from './KsqlQueriesList';
import { KsqlQueryDetail } from './KsqlQueryDetail';
import '../JobsPage/JobsPage.css';

export function KsqlQueriesPage() {
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const ksqlQueries = useWorkspaceStore((s) => s.ksqlQueries);
  const ksqlQueriesLoading = useWorkspaceStore((s) => s.ksqlQueriesLoading);
  const ksqlQueriesError = useWorkspaceStore((s) => s.ksqlQueriesError);
  const loadKsqlQueries = useWorkspaceStore((s) => s.loadKsqlQueries);
  const terminateKsqlQuery = useWorkspaceStore((s) => s.terminateKsqlQuery);
  const selectedKsqlQueryId = useWorkspaceStore((s) => s.selectedKsqlQueryId);

  useEffect(() => {
    loadKsqlQueries();
  }, [loadKsqlQueries]);

  // Allow external navigation to a specific query detail (e.g. from dashboard).
  // Wait until queries are loaded so the detail view can find the query.
  useEffect(() => {
    if (selectedKsqlQueryId && ksqlQueries.length > 0) {
      setSelectedQueryId(selectedKsqlQueryId);
      useWorkspaceStore.setState({ selectedKsqlQueryId: null });
    }
  }, [selectedKsqlQueryId, ksqlQueries.length]);

  if (selectedQueryId) {
    const query = ksqlQueries.find((q) => q.id === selectedQueryId);
    return (
      <KsqlQueryDetail
        query={query}
        onBack={() => setSelectedQueryId(null)}
        onTerminateQuery={terminateKsqlQuery}
      />
    );
  }

  return (
    <KsqlQueriesList
      queries={ksqlQueries}
      loading={ksqlQueriesLoading}
      error={ksqlQueriesError}
      onSelectQuery={setSelectedQueryId}
      onTerminateQuery={terminateKsqlQuery}
      onRefresh={loadKsqlQueries}
    />
  );
}
