/**
 * @jobs-page
 * Jobs page — container that routes between list and detail views.
 */
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { JobsList } from './JobsList';
import { JobsDetail } from './JobsDetail';
import './JobsPage.css';

export function JobsPage() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const jobStatements = useWorkspaceStore((s) => s.jobStatements);
  const jobsLoading = useWorkspaceStore((s) => s.jobsLoading);
  const jobsError = useWorkspaceStore((s) => s.jobsError);
  const loadJobs = useWorkspaceStore((s) => s.loadJobs);
  const cancelJob = useWorkspaceStore((s) => s.cancelJob);
  const deleteJob = useWorkspaceStore((s) => s.deleteJob);
  const storeSelectedJobName = useWorkspaceStore((s) => s.selectedJobName);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Allow external navigation to a specific job detail (e.g. from dashboard).
  // Wait until jobs are loaded so the detail view can find the statement.
  useEffect(() => {
    if (storeSelectedJobName && jobStatements.length > 0) {
      setSelectedName(storeSelectedJobName);
      useWorkspaceStore.setState({ selectedJobName: null });
    }
  }, [storeSelectedJobName, jobStatements.length]);

  if (selectedName) {
    const statement = jobStatements.find((s) => s.name === selectedName);
    return (
      <JobsDetail
        statement={statement}
        onBack={() => setSelectedName(null)}
        onCancelJob={cancelJob}
        onDeleteJob={deleteJob}
      />
    );
  }

  return (
    <JobsList
      statements={jobStatements}
      loading={jobsLoading}
      error={jobsError}
      onSelectJob={setSelectedName}
      onCancelJob={cancelJob}
      onDeleteJob={deleteJob}
      onRefresh={loadJobs}
    />
  );
}
