'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HealthCheckedVncIframe } from '../HealthCheckedVncIframe';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface BrowserTakeoverProps {
  isOpen: boolean;
  onClose: () => void;
  sandbox: {
    id: string;
    vnc_preview: string;
    pass: string;
  };
  agentName?: string;
}

export function BrowserTakeover({
  isOpen,
  onClose,
  sandbox,
  agentName
}: BrowserTakeoverProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Lock body scroll when open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted) return null;

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col bg-zinc-950"
        >
          {/* Main Content Area - Full Viewport VNC */}
          <div className="flex-1 relative w-full h-full overflow-hidden bg-black">
            <HealthCheckedVncIframe
              sandbox={sandbox}
              className="w-full h-full m-0 rounded-none border-none"
            />
          </div>

          {/* Floating Controls Bar */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-800 shadow-2xl">
            <div className="flex items-center gap-1 pr-2 border-r border-zinc-800">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {}} // Placeholder for future back functionality
                className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {}} // Placeholder for future forward functionality
                className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                title="Forward"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="px-2 text-sm font-medium text-zinc-300">
              {agentName ? `${agentName}'s Browser` : "Browser"}
            </div>

            <Button
              variant="destructive"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 rounded-lg bg-red-600/90 hover:bg-red-600 text-white font-medium ml-2"
            >
              <Minimize2 className="h-4 w-4 mr-2" />
              Exit Takeover
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
