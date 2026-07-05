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


def _convert_markdown_images(text: str) -> str:
    """
    Convert markdown image syntax ![alt](url) to HTML <img> tags.
    Must be called BEFORE detect_and_convert_links.
    
    Args:
        text: Text that may contain markdown image references.
    
    Returns:
        Text with markdown images converted to HTML.
    """
    if not text:
        return ""
    
    # Convert ![alt](url) to <img> tags with styling
    # Use a unique placeholder marker that won't be matched as a URL
    # and won't be affected by text transformations
    def replace_img(match):
        alt_text = match.group(1)
        img_url = match.group(2)
        return (
            f'<div class="dest-image-wrapper">'
            f'<img src="ZZIMGPROTECT{img_url}ZZIMGEND" alt="{alt_text}" '
            f'class="dest-image" loading="lazy" '
            f'onclick="window.open(\'ZZIMGPROTECT{img_url}ZZIMGEND\',\'_blank\')" />'
            f'</div>'
        )
    
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", replace_img, text)
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
    
    # Step 1: Convert markdown images to HTML with protected URLs
    text = _convert_markdown_images(response_text)
    
    # Step 2: Remove bold/italic markers (but NOT our image markers)
    text = text.replace("**", "")
    
    # Step 3: Convert markdown links [text](url) to HTML <a> tags
    # This must be done BEFORE bare URL conversion to avoid double-wrapping
    text = re.sub(
        r'\[([^\]]+)\]\(((https?://[^)]+))\)',
        lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
        text,
    )
    
    # Step 4: Convert bare URLs to clickable links (skip protected URLs)
    # The ZZIMGPROTECT prefix prevents matching URLs inside img tags
    text = re.sub(
        r'(?<!ZZIMGPROTECT)(?<!["\'])(https?://[^\s<]+)',
        lambda m: f'<a href="{m.group(1)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
        text,
    )
    
    # Step 5: Restore image URL markers (remove the protection markers)
    text = text.replace("ZZIMGPROTECT", "").replace("ZZIMGEND", "")
    
    # Step 6: Convert newlines to <br> tags
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