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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600">Application not found</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-indigo-600 hover:text-indigo-700"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-6 text-sm"
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
