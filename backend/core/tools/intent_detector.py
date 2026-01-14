"""
Intent Detector for Lazy Tool Injection

Analyzes user messages to determine which tool categories are needed.
Uses keyword matching and simple NLP patterns.
"""

from typing import List, Set, Tuple
import re
from core.tools.tool_categories import ALL_CATEGORIES, get_core_tools

class IntentDetector:
    """Detects user intent to determine which tool categories to load"""
    
    def __init__(self):
        # Build keyword index for fast lookup
        self._keyword_to_categories: dict[str, Set[str]] = {}
        for cat in ALL_CATEGORIES:
            for keyword in cat.keywords:
                kw_lower = keyword.lower()
                if kw_lower not in self._keyword_to_categories:
                    self._keyword_to_categories[kw_lower] = set()
                self._keyword_to_categories[kw_lower].add(cat.name)
    
    def detect_categories(self, message: str) -> Tuple[List[str], float]:
        """
        Analyze message and return (categories, confidence).
        
        Returns:
            Tuple of (list of category names, confidence 0-1)
        """
        if not message:
            return [], 0.0
        
        message_lower = message.lower()
        detected_categories: Set[str] = set()
        matches = 0
        
        # Check each keyword
        for keyword, categories in self._keyword_to_categories.items():
            if keyword in message_lower:
                detected_categories.update(categories)
                matches += 1
        
        # Calculate confidence based on number of matches
        confidence = min(1.0, matches / 3) if matches > 0 else 0.0
        
        # If very short message with no matches, it's likely conversational
        if len(message.split()) <= 5 and matches == 0:
            confidence = 0.0
        
        return list(detected_categories), confidence
    
    def get_tools_for_message(self, message: str, include_conversational: bool = True) -> List[str]:
        """
        Main entry point: returns list of tool names to inject based on message.
        
        Args:
            message: User's message
            include_conversational: If True and no intent detected, return minimal conversational set
            
        Returns:
            List of tool names to inject
        """
        categories, confidence = self.detect_categories(message)
        
        # Always include core tools
        tools = set(get_core_tools())
        
        if categories:
            # Add tools from detected categories
            for cat in ALL_CATEGORIES:
                if cat.name in categories:
                    tools.update(cat.tools)
        elif include_conversational:
            # No specific intent - just conversational
            # Only core tools needed
            pass
        
        return list(tools)

# Singleton instance
_detector = None

def get_intent_detector() -> IntentDetector:
    global _detector
    if _detector is None:
        _detector = IntentDetector()
    return _detector

def detect_required_tools(message: str) -> List[str]:
    """Convenience function to detect tools for a message"""
    return get_intent_detector().get_tools_for_message(message)

def detect_categories(message: str) -> Tuple[List[str], float]:
    """Convenience function to detect categories for a message"""
    return get_intent_detector().detect_categories(message)


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    detector = IntentDetector()
    
    test_messages = [
        "Oi, tudo bem?",
        "Estamos online?",
        "Crie um arquivo Python com hello world",
        "Pesquise sobre inteligência artificial",
        "Faça uma apresentação sobre vendas",
        "Navegue até google.com e faça uma busca",
        "Gere uma imagem de um gato",
        "Crie um agente para monitorar emails",
        "Instale o pandas e rode um script",
        "Me ajude a criar um documento PDF",
    ]
    
    print("=" * 80)
    print("INTENT DETECTOR TEST")
    print("=" * 80)
    
    for msg in test_messages:
        categories, confidence = detector.detect_categories(msg)
        tools = detector.get_tools_for_message(msg)
        print(f"\nMessage: {msg}")
        print(f"  Categories: {categories} (confidence: {confidence:.2f})")
        print(f"  Tools ({len(tools)}): {tools[:5]}{'...' if len(tools) > 5 else ''}")
