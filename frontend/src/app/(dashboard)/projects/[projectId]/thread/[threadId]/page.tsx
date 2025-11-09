'use client';

import React from 'react';
import { ThreadComponent } from '@/components/thread/ThreadComponent';

export default function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{
    projectId: string;
    threadId: string;
  }>;
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const unwrappedParams = React.use(params);
  const unwrappedSearchParams = React.use(searchParams);
  const { projectId, threadId } = unwrappedParams;

  return <ThreadComponent projectId={projectId} threadId={threadId} searchParams={unwrappedSearchParams} />;
}
