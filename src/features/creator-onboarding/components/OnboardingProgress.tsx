// =============================================================================
// OnboardingProgress Component
// Visual progress indicator for creator onboarding flow
// =============================================================================

import React from 'react';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  totalSteps,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {/* Dot indicators */}
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isFuture = stepNumber > currentStep;

          return (
            <div
              key={stepNumber}
              className={`
                w-2.5 h-2.5 rounded-full transition-all duration-300 ease-out
                ${isActive ? 'bg-white scale-125' : ''}
                ${isCompleted ? 'bg-[#A0A0A0]' : ''}
                ${isFuture ? 'bg-transparent border-2 border-[#1F1F1F]' : ''}
              `}
              aria-label={
                isActive
                  ? `Step ${stepNumber} of ${totalSteps} (current)`
                  : isCompleted
                  ? `Step ${stepNumber} of ${totalSteps} (completed)`
                  : `Step ${stepNumber} of ${totalSteps}`
              }
            />
          );
        })}
      </div>

      {/* Step text */}
      <span className="text-xs text-[#666666] font-medium">
        Step {currentStep} of {totalSteps}
      </span>
    </div>
  );
};

export default OnboardingProgress;
