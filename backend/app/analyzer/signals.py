from dataclasses import dataclass
from typing import Optional

@dataclass
class Signal:
    code: str
    label: str
    description: str
    score: int
    severity: str  # info / warning / danger / critical

SIGNALS = {
    # Header signals
    "REPLY_TO_MISMATCH": Signal("REPLY_TO_MISMATCH", "Reply-To Mismatch", "Reply-To address differs from sender domain", 20, "warning"),
    "DISPLAY_NAME_SPOOF": Signal("DISPLAY_NAME_SPOOF", "Display Name Spoofing", "Display name appears to impersonate a known brand or person", 25, "danger"),
    "LOOKALIKE_DOMAIN": Signal("LOOKALIKE_DOMAIN", "Lookalike Domain", "Sender domain is visually similar to a known legitimate domain", 35, "danger"),
    "FREE_EMAIL_IMPERSONATION": Signal("FREE_EMAIL_IMPERSONATION", "Free Email Service Impersonation", "Sender uses a free email service but claims to be a company", 20, "warning"),
    "MISSING_DMARC_ALIGNMENT": Signal("MISSING_DMARC_ALIGNMENT", "No Domain Authentication", "Email lacks proper SPF/DKIM/DMARC authentication signals", 15, "warning"),
    # URL signals
    "URL_DISPLAY_MISMATCH": Signal("URL_DISPLAY_MISMATCH", "Link Text/URL Mismatch", "Hyperlink display text does not match the actual URL destination", 30, "danger"),
    "SHORTENED_URL": Signal("SHORTENED_URL", "URL Shortener Used", "Email contains shortened URLs that hide the real destination", 20, "warning"),
    "SUSPICIOUS_TLD": Signal("SUSPICIOUS_TLD", "Suspicious Domain Extension", "Link uses a domain extension commonly associated with phishing", 15, "warning"),
    "IP_ADDRESS_URL": Signal("IP_ADDRESS_URL", "IP Address in URL", "Link uses an IP address instead of a domain name", 25, "danger"),
    "MULTIPLE_REDIRECTS": Signal("MULTIPLE_REDIRECTS", "Multiple URL Redirects", "Link chains through multiple redirects before reaching destination", 15, "warning"),
    "CREDENTIAL_FORM_LINK": Signal("CREDENTIAL_FORM_LINK", "Login Page Link", "Link leads to a page that may request credentials", 20, "warning"),
    # Content signals
    "URGENCY_LANGUAGE": Signal("URGENCY_LANGUAGE", "Urgency Language", "Email uses urgent language to pressure the reader into acting quickly", 20, "warning"),
    "THREAT_LANGUAGE": Signal("THREAT_LANGUAGE", "Threat Language", "Email contains threatening language about account suspension or legal action", 30, "danger"),
    "CREDENTIAL_REQUEST": Signal("CREDENTIAL_REQUEST", "Credential Request", "Email asks for password, PIN, or sensitive credentials", 35, "critical"),
    "FINANCIAL_REQUEST": Signal("FINANCIAL_REQUEST", "Financial Request", "Email requests wire transfer, gift cards, or financial information", 35, "critical"),
    "PERSONAL_INFO_REQUEST": Signal("PERSONAL_INFO_REQUEST", "Personal Info Request", "Email requests personal or sensitive information", 25, "danger"),
    "IMPERSONATION_BRAND": Signal("IMPERSONATION_BRAND", "Brand Impersonation", "Email appears to impersonate a known brand (bank, tech company, etc.)", 30, "danger"),
    "IMPERSONATION_EXECUTIVE": Signal("IMPERSONATION_EXECUTIVE", "Executive Impersonation", "Email appears to impersonate a company executive (CEO, CFO, etc.)", 30, "danger"),
    "POOR_GRAMMAR": Signal("POOR_GRAMMAR", "Poor Grammar/Spelling", "Email contains unusual grammar or spelling errors", 10, "info"),
    # Attachment signals
    "DANGEROUS_ATTACHMENT_TYPE": Signal("DANGEROUS_ATTACHMENT_TYPE", "Dangerous Attachment", "Email contains an attachment type commonly used to deliver malware", 40, "critical"),
    "EXTENSION_MISMATCH": Signal("EXTENSION_MISMATCH", "File Extension Mismatch", "Attachment filename extension does not match the actual file type", 35, "critical"),
    "OFFICE_WITH_MACROS": Signal("OFFICE_WITH_MACROS", "Office Document (Possible Macros)", "Email contains an Office document that may contain macros", 25, "danger"),
    "ARCHIVE_WITH_EXECUTABLE": Signal("ARCHIVE_WITH_EXECUTABLE", "Archive Containing Executable", "Attachment is an archive (zip/rar) that may contain executable files", 30, "danger"),
}
