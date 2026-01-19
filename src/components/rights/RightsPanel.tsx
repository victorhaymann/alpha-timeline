import { useState } from 'react';
import { RightsAgreementsList } from './RightsAgreementsList';
import { RightsAgreementForm } from './RightsAgreementForm';
import type { Project } from '@/types/database';

interface RightsPanelProps {
  projectId: string;
  project: Project;
  readOnly?: boolean;
}

export function RightsPanel({ projectId, project, readOnly = false }: RightsPanelProps) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingAgreementId, setEditingAgreementId] = useState<string | undefined>();

  const handleCreateNew = () => {
    setEditingAgreementId(undefined);
    setView('form');
  };

  const handleEdit = (agreementId: string) => {
    setEditingAgreementId(agreementId);
    setView('form');
  };

  const handleBack = () => {
    setEditingAgreementId(undefined);
    setView('list');
  };

  const handleSaved = () => {
    setEditingAgreementId(undefined);
    setView('list');
  };

  if (view === 'form' && !readOnly) {
    return (
      <RightsAgreementForm
        projectId={projectId}
        project={project}
        agreementId={editingAgreementId}
        onBack={handleBack}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <RightsAgreementsList
      projectId={projectId}
      onCreateNew={handleCreateNew}
      onEdit={handleEdit}
      readOnly={readOnly}
    />
  );
}
