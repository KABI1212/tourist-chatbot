"""
Response parsing utilities.

Handles formatting and parsing of AI responses and user data.
"""

import re
from typing import List, Dict, Any


def parse_ai_response(response_text: str) -> List[Dict[str, str]]:
    """
    Parse an AI response into structured topic/detail pairs.
    
    Args:
        response_text: Raw text response from the AI model.
    
    Returns:
        List of dicts with 'topic' and 'details' keys.
    """
    if not response_text:
        return []
    
    lines = response_text.split("\n")
    formatted = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        
        # Check if line has a colon separator (topic: details)
        if ":" in stripped:
            parts = stripped.split(":", 1)
            topic = parts[0].strip()
            details = parts[1].strip()
            formatted.append({"topic": topic, "details": details})
        else:
            formatted.append({"topic": stripped, "details": ""})
    
    return formatted


def detect_and_convert_links(text: str) -> str:
    """
    Detect URLs in text and convert them to clickable HTML links.
    
    Args:
        text: Raw text that may contain URLs.
    
    Returns:
        Text with URLs converted to HTML anchor tags.
    """
    if not text:
        return ""
    
    # Remove markdown bold/italic markers
    text = re.sub(r"\*{1,2}", "", text)
    
    # Convert bracket-enclosed URLs: [https://example.com] -> <a href="...">...</a>
    text = re.sub(
        r"\[(https?://[^\]]+)\]",
        lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
        text,
    )
    
    # Convert bare URLs: https://example.com -> <a href="...">...</a>
    text = re.sub(
        r"(?<!["">])(https?://[^\s<]+)",
        lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
        text,
    )
    
    return text


def format_chat_response(response_text: str) -> str:
    """
    Format an AI response for display in the chat UI.
    Handles markdown-like formatting and link conversion.
    
    Args:
        response_text: Raw response from the AI.
    
    Returns:
        HTML-formatted response string.
    """
    if not response_text:
        return ""
    
    # Convert links
    text = detect_and_convert_links(response_text)
    
    # Convert newlines to <br> tags
    text = text.replace("\n", "<br>")
    
    return text


def format_timestamp(dt) -> str:
    """
    Format a datetime object for display.
    
    Args:
        dt: A datetime object.
    
    Returns:
        Formatted time string like "2:30 PM".
    """
    if not dt:
        return ""
    return dt.strftime("%I:%M %p").lstrip("0")


def truncate_text(text: str, max_length: int = 100) -> str:
    """
    Truncate text to a maximum length with ellipsis.
    
    Args:
        text: Text to truncate.
        max_length: Maximum character length.
    
    Returns:
        Truncated text.
    """
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."