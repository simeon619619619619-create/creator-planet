// =============================================================================
// CourseEnrollButton Component
// Smart enroll button that handles both free and paid courses
// =============================================================================

import { Loader2, Plus, CreditCard } from 'lucide-react';
import { DbCourse } from '../../../core/supabase/database.types';

interface CourseEnrollButtonProps {
  course: DbCourse & { price_cents?: number };
  isEnrolling: boolean;
  onEnroll: () => void;
  onPurchase: () => void;
}

/**
 * Formats a price in cents to a display string
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function CourseEnrollButton({
  course,
  isEnrolling,
  onEnroll,
  onPurchase,
}: CourseEnrollButtonProps) {
  const priceCents = course.price_cents ?? 0;
  const isPaid = priceCents > 0;

  const handleClick = () => {
    if (isPaid) {
      onPurchase();
    } else {
      onEnroll();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isEnrolling}
      className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
    >
      {isEnrolling ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {isPaid ? 'Processing...' : 'Enrolling...'}
        </>
      ) : isPaid ? (
        <>
          <CreditCard size={18} />
          Buy for {formatPrice(priceCents)}
        </>
      ) : (
        <>
          <Plus size={18} />
          Enroll Free
        </>
      )}
    </button>
  );
}

export default CourseEnrollButton;
