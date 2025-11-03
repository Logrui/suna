'use client';

import { BookOpen } from 'lucide-react';

export function LibraryPageHeader() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Library</h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Browse and manage your conversation threads
      </p>
    </div>
  );
}
