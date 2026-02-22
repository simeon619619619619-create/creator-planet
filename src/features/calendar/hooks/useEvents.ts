import { useQuery } from '@tanstack/react-query';
import {
  getEvents,
  getCreatorEvents,
  getUpcomingEvents,
  EventWithDetails,
} from '../eventService';

export function useEvents(communityId?: string) {
  return useQuery<EventWithDetails[]>({
    queryKey: ['events', communityId],
    queryFn: () => getEvents(communityId),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

export function useCreatorEvents(
  creatorId: string | undefined,
  filter: 'upcoming' | 'past' | 'all' = 'upcoming'
) {
  return useQuery<EventWithDetails[]>({
    queryKey: ['events', 'creator', creatorId, filter],
    queryFn: () => getCreatorEvents(creatorId!, filter),
    enabled: !!creatorId,
    staleTime: 3 * 60 * 1000,
  });
}

export function useUpcomingEvents(userId: string | undefined) {
  return useQuery<EventWithDetails[]>({
    queryKey: ['events', 'upcoming', userId],
    queryFn: () => getUpcomingEvents(userId!),
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
  });
}
