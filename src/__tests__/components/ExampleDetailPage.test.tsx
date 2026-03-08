import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockNavigateToExampleDetail = vi.fn();
const mockAddToast = vi.fn();

let mockSelectedExampleId: string | null = 'hello-flink';
let mockArtifactList: any[] = [];

vi.mock('../../store/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    const state = {
      selectedExampleId: mockSelectedExampleId,
      navigateToExampleDetail: mockNavigateToExampleDetail,
      artifactList: mockArtifactList,
      addToast: mockAddToast,
    };
    return selector(state);
  },
}));

// Mock CSS imports
vi.mock('../../components/ExampleDetailView/ExampleDetailPage.css', () => ({}));
vi.mock('../../components/ExampleDetailView/DataFlowDiagram.css', () => ({}));

// Mock getExampleCards to return controlled data
vi.mock('../../data/exampleCards', () => ({
  getExampleCards: () => [
    {
      id: 'hello-flink',
      title: 'Hello Flink',
      description: 'First example',
      sql: 'SELECT 1',
      tags: ['Quick Start'],
      category: 'kickstart',
      documentation: {
        subtitle: 'Your very first Flink SQL job',
        businessContext: 'Validates connectivity.',
        concepts: [{ term: 'Stream', explanation: 'Continuous data' }],
        useCases: ['Learning'],
      },
    },
    {
      id: 'no-doc',
      title: 'No Doc Card',
      description: 'Missing docs',
      sql: 'SELECT 2',
      tags: [],
      category: 'snippet',
    },
  ],
}));

import { ExampleDetailPage } from '../../components/ExampleDetailView/ExampleDetailPage';

describe('[@example-detail-page] ExampleDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedExampleId = 'hello-flink';
    mockArtifactList = [];
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });
  });

  it('returns null when no card is found', () => {
    mockSelectedExampleId = 'nonexistent';
    const { container } = render(<ExampleDetailPage />);
    expect(container.firstChild).toBeNull();
  });

  it('renders fallback UI when card has no documentation', () => {
    mockSelectedExampleId = 'no-doc';
    render(<ExampleDetailPage />);
    expect(screen.getByText('No Doc Card')).toBeInTheDocument();
  });

  it('renders hero section with title and subtitle', () => {
    render(<ExampleDetailPage />);
    expect(screen.getByText('Hello Flink')).toBeInTheDocument();
    expect(screen.getByText('Your very first Flink SQL job')).toBeInTheDocument();
  });

  it('renders tags including Quick Start with primary class', () => {
    const { container } = render(<ExampleDetailPage />);
    expect(screen.getByText('Quick Start')).toBeInTheDocument();
    expect(container.querySelector('.edp__tag--primary')).toBeInTheDocument();
  });

  it('renders business context', () => {
    render(<ExampleDetailPage />);
    expect(screen.getByText('Validates connectivity.')).toBeInTheDocument();
  });

  it('copies SQL to clipboard and shows toast', async () => {
    const user = userEvent.setup();
    render(<ExampleDetailPage />);
    await user.click(screen.getByText('Copy SQL'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', message: 'SQL copied to clipboard' })
    );
  });

  it('shows Copied! text after copy', async () => {
    const user = userEvent.setup();
    render(<ExampleDetailPage />);
    await user.click(screen.getByText('Copy SQL'));
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('navigates to null on Escape key', () => {
    render(<ExampleDetailPage />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockNavigateToExampleDetail).toHaveBeenCalledWith(null);
  });

  it('renders use cases', () => {
    render(<ExampleDetailPage />);
    expect(screen.getByText('Learning')).toBeInTheDocument();
  });
});
