import { useQuery } from '@tanstack/react-query';
import { getPosts } from '../communityService';
import { DbPostWithAuthor } from '../../../core/supabase/database.types';

export function usePosts(channelId: string | undefined) {
  return useQuery<DbPostWithAuthor[]>({
    queryKey: ['posts', channelId],
    queryFn: () => getPosts(channelId!),
    enabled: !!channelId,
    staleTime: 1 * 60 * 1000, // 1 minute for posts (more dynamic)
  });
}
