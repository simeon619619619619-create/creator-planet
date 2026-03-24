import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TBIStatusTracker } from '../components/TBIStatusTracker';
import { ArrowLeft } from 'lucide-react';

const TBIStatusPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!applicationId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--fc-section,#0A0A0A)]">
        <div className="text-center">
          <p className="text-[var(--fc-section-muted,#A0A0A0)]">Application not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-[var(--fc-section-text,#FAFAFA)] hover:text-white"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] mb-6 text-sm transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <TBIStatusTracker
          applicationId={applicationId}
          onComplete={() => {
            // Redirect to community after 3 seconds on success
            setTimeout(() => {
              navigate('/');
            }, 3000);
          }}
        />
      </div>
    </div>
  );
};

export default TBIStatusPage;
