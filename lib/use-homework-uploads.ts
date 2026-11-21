'use client';

import { useSyncExternalStore } from 'react';
import { getHomeworkUploads, getServerHomeworkUploads, subscribeHomeworkUploads } from './homework-uploads';

export function useHomeworkUploads() {
  return useSyncExternalStore(subscribeHomeworkUploads, getHomeworkUploads, getServerHomeworkUploads);
}
