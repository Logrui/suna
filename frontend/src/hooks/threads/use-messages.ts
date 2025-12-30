import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { threadKeys } from "./keys";
import { addUserMessage, getMessages, type Message } from "@/lib/api/threads";

export const useMessagesQuery = (threadId: string, options?) => {
  const queryClient = useQueryClient();
  
  // Invalidate cache when threadId changes to force fresh fetch
  useEffect(() => {
    if (threadId) {
      // Remove old cache for this thread to ensure fresh data
      queryClient.removeQueries({ queryKey: threadKeys.messages(threadId) });
    }
  }, [threadId, queryClient]);

  return useQuery<Message[]>({
    queryKey: threadKeys.messages(threadId),
    queryFn: () => getMessages(threadId),
    enabled: !!threadId,
    retry: 1,
    // Force fresh data on every mount/thread change
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // No caching - always fetch fresh data
    staleTime: 0,
    gcTime: 0, // Don't keep old data in cache (formerly cacheTime)
    ...options,
  });
};

export const useAddUserMessageMutation = () => {
  return useMutation<void, Error, { threadId: string; message: string }>({
    mutationFn: ({
      threadId,
      message,
    }: {
      threadId: string;
      message: string;
    }) => addUserMessage(threadId, message)
  });
};
