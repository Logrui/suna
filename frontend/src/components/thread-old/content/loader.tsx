import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedShinyText } from '@/components/ui/animated-shiny-text';


const TYPE_DELAY = 100;
const ERASE_DELAY = 50;
const PAUSE_DELAY = 1000;

const items = [
  { id: 1, content: "Initializing neural pathways..." },
  { id: 2, content: "Analyzing query complexity..." },
  { id: 3, content: "Assembling cognitive framework..." },
  { id: 4, content: "Orchestrating thought processes..." },
  { id: 5, content: "Synthesizing contextual understanding..." },
  { id: 6, content: "Calibrating response parameters..." },
  { id: 7, content: "Engaging reasoning algorithms..." },
  { id: 8, content: "Processing semantic structures..." },
  { id: 9, content: "Formulating strategic approach..." },
  { id: 10, content: "Optimizing solution pathways..." },
  { id: 11, content: "Harmonizing data streams..." },
  { id: 12, content: "Architecting intelligent response..." },
  { id: 13, content: "Fine-tuning cognitive models..." },
  { id: 14, content: "Weaving narrative threads..." },
  { id: 15, content: "Crystallizing insights..." },
  { id: 16, content: "Preparing comprehensive analysis..." }
];

export const AgentLoader = () => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let currentTextIndex = 0;
    let currentCharIndex = 0;

    const type = () => {
      const currentText = items[currentTextIndex];
      if (currentCharIndex < currentText.content.length) {
        setDisplayText(currentText.content.slice(0, currentCharIndex + 1));
        currentCharIndex++;
        timeoutId = setTimeout(type, TYPE_DELAY);
      } else {
        timeoutId = setTimeout(() => {
          currentCharIndex = currentText.content.length;
          erase();
        }, PAUSE_DELAY);
      }
    };

    const erase = () => {
      const currentText = items[currentTextIndex];
      if (currentCharIndex > 0) {
        currentCharIndex--;
        setDisplayText(currentText.content.slice(0, currentCharIndex));
        timeoutId = setTimeout(erase, ERASE_DELAY);
      } else {
        currentTextIndex = (currentTextIndex + 1) % items.length;
        currentCharIndex = 0;
        timeoutId = setTimeout(type, TYPE_DELAY);
      }
    };

    type();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="flex py-2 items-center w-full">
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {displayText}
        <span className="animate-pulse">|</span>
      </span>
    </div>
  );
};

