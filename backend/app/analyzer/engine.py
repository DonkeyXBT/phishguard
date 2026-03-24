import re
import urllib.parse
from typing import List, Dict, Any, Optional
from .signals import SIGNALS, Signal


KNOWN_BRANDS = [
    "paypal", "microsoft", "apple", "amazon", "google", "facebook", "instagram",
    "netflix", "spotify", "bank", "chase", "wellsfargo", "citibank", "hsbc",
    "dropbox", "docusign", "linkedin", "twitter", "dhl", "fedex", "ups",
    "irs", "gov", "support", "security", "account", "service", "helpdesk"
]

URGENT_PHRASES = [
    "urgent", "immediately", "action required", "your account will be", "within 24 hours",
    "account suspended", "verify now", "click now", "limited time", "expires today",
    "final notice", "act now", "respond immediately", "time sensitive", "last warning",
    "account locked", "security alert", "unusual activity", "verify your account",
    "confirm your identity", "we detected", "suspicious login", "unauthorized access"
]

THREAT_PHRASES = [
    "will be terminated", "legal action", "permanently deleted", "suspended immediately",
    "face consequences", "law enforcement", "criminal charges", "account will be closed",
    "service will be discontinued", "lose access", "account banned"
]

CREDENTIAL_PHRASES = [
    "enter your password", "confirm your password", "verify your password",
    "update your password", "your pin", "social security", "credit card number",
    "bank account", "routing number", "cvv", "security code", "mother's maiden name",
    "date of birth", "confirm your details", "verify your identity"
]

FINANCIAL_PHRASES = [
    "wire transfer", "gift card", "western union", "bitcoin", "cryptocurrency",
    "send money", "transfer funds", "purchase gift cards", "itunes card", "google play card",
    "amazon gift card", "payment required", "outstanding invoice", "unpaid balance"
]

EXECUTIVE_TITLES = ["ceo", "cfo", "coo", "president", "director", "vp ", "vice president", "manager"]

DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".vbs", ".js", ".jar", ".ps1", ".scr", ".pif", ".com", ".hta"]
OFFICE_MACRO_EXTENSIONS = [".xlsm", ".xlsb", ".docm", ".pptm", ".xlam", ".dotm"]
ARCHIVE_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz", ".iso", ".img"]
SUSPICIOUS_TLDS = [".xyz", ".top", ".club", ".online", ".site", ".info", ".biz", ".ru", ".cn", ".tk", ".ml", ".ga", ".cf"]
URL_SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "buff.ly", "short.link", "rb.gy", "cutt.ly"]

FREE_EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com",
    "icloud.com", "aol.com", "yandex.com", "mail.com", "zoho.com"
]


def levenshtein(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = range(len(s2) + 1)
    for c1 in s1:
        curr_row = [prev_row[0] + 1]
        for i, c2 in enumerate(s2):
            curr_row.append(min(prev_row[i + 1] + 1, curr_row[i] + 1, prev_row[i] + (c1 != c2)))
        prev_row = curr_row
    return prev_row[-1]


def extract_domain(email_or_url: str) -> Optional[str]:
    if not email_or_url:
        return None
    if "@" in email_or_url:
        return email_or_url.split("@")[-1].lower().strip(">").strip()
    try:
        parsed = urllib.parse.urlparse(email_or_url)
        return parsed.netloc.lower() or None
    except Exception:
        return None


def extract_urls_from_html(html: str) -> List[Dict[str, str]]:
    if not html:
        return []
    links = []
    href_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.IGNORECASE | re.DOTALL)
    for match in href_pattern.finditer(html):
        url = match.group(1).strip()
        display = re.sub(r'<[^>]+>', '', match.group(2)).strip()
        links.append({"url": url, "display": display})
    return links


def extract_urls_from_text(text: str) -> List[str]:
    if not text:
        return []
    url_pattern = re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+', re.IGNORECASE)
    return url_pattern.findall(text)


def is_ip_address(host: str) -> bool:
    ip_pattern = re.compile(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$')
    return bool(ip_pattern.match(host))


def analyze_email(
    sender: Optional[str] = None,
    reply_to: Optional[str] = None,
    subject: Optional[str] = None,
    body_text: Optional[str] = None,
    body_html: Optional[str] = None,
    headers: Optional[dict] = None,
    attachments: Optional[List[dict]] = None,
) -> Dict[str, Any]:
    triggered_signals = []
    score = 0
    headers = headers or {}
    attachments = attachments or []

    def add_signal(code: str, detail: Optional[str] = None):
        nonlocal score
        if code in SIGNALS:
            s = SIGNALS[code]
            entry = {
                "code": s.code,
                "label": s.label,
                "description": s.description,
                "detail": detail or s.description,
                "score": s.score,
                "severity": s.severity,
            }
            triggered_signals.append(entry)
            score += s.score

    body_combined = ""
    if body_text:
        body_combined += body_text.lower()
    if body_html:
        body_combined += re.sub(r'<[^>]+>', ' ', body_html).lower()

    subject_lower = (subject or "").lower()

    # --- HEADER ANALYSIS ---
    sender_domain = extract_domain(sender) if sender else None

    if reply_to and sender:
        reply_to_domain = extract_domain(reply_to)
        if reply_to_domain and sender_domain and reply_to_domain != sender_domain:
            add_signal("REPLY_TO_MISMATCH", f"From: {sender_domain}, Reply-To: {reply_to_domain}")

    if sender_domain and sender:
        display_name = ""
        if "<" in sender:
            display_name = sender.split("<")[0].strip().strip('"').lower()
        for brand in KNOWN_BRANDS:
            if brand in display_name and brand not in sender_domain:
                add_signal("DISPLAY_NAME_SPOOF", f"Display name contains '{brand}' but domain is '{sender_domain}'")
                break

    if sender_domain:
        core_domain = sender_domain.split(".")[0] if "." in sender_domain else sender_domain
        for brand in KNOWN_BRANDS:
            if brand != core_domain and len(brand) > 3:
                dist = levenshtein(core_domain, brand)
                if 1 <= dist <= 2:
                    add_signal("LOOKALIKE_DOMAIN", f"'{sender_domain}' is similar to '{brand}.com'")
                    break

    if sender_domain and sender_domain in FREE_EMAIL_DOMAINS:
        for brand in KNOWN_BRANDS:
            if brand in subject_lower or brand in body_combined[:500]:
                add_signal("FREE_EMAIL_IMPERSONATION", f"Free email ({sender_domain}) impersonating a company")
                break

    # --- CONTENT ANALYSIS ---
    urgency_hits = [p for p in URGENT_PHRASES if p in body_combined or p in subject_lower]
    if len(urgency_hits) >= 2:
        add_signal("URGENCY_LANGUAGE", f"Phrases found: {', '.join(urgency_hits[:3])}")
    elif len(urgency_hits) == 1:
        add_signal("URGENCY_LANGUAGE", f"Phrase found: {urgency_hits[0]}")

    threat_hits = [p for p in THREAT_PHRASES if p in body_combined or p in subject_lower]
    if threat_hits:
        add_signal("THREAT_LANGUAGE", f"Phrases found: {', '.join(threat_hits[:3])}")

    credential_hits = [p for p in CREDENTIAL_PHRASES if p in body_combined]
    if credential_hits:
        add_signal("CREDENTIAL_REQUEST", f"Phrases found: {', '.join(credential_hits[:3])}")

    financial_hits = [p for p in FINANCIAL_PHRASES if p in body_combined or p in subject_lower]
    if financial_hits:
        add_signal("FINANCIAL_REQUEST", f"Phrases found: {', '.join(financial_hits[:3])}")

    for brand in ["paypal", "microsoft", "apple", "amazon", "google", "netflix", "facebook", "linkedin", "bank", "chase"]:
        if brand in body_combined and sender_domain and brand not in sender_domain:
            add_signal("IMPERSONATION_BRAND", f"Claims to be '{brand}' but sent from '{sender_domain}'")
            break

    for title in EXECUTIVE_TITLES:
        if title in body_combined[:300] or title in subject_lower:
            if sender_domain and sender_domain in FREE_EMAIL_DOMAINS:
                add_signal("IMPERSONATION_EXECUTIVE", f"Executive title '{title.strip()}' in email from free provider")
                break

    # --- URL ANALYSIS ---
    all_links = []
    suspicious_links = []

    if body_html:
        html_links = extract_urls_from_html(body_html)
        for link in html_links:
            url = link["url"]
            display = link["display"]
            link_domain = extract_domain(url)
            entry = {"display": display, "url": url, "domain": link_domain, "is_suspicious": False, "risk_reason": None}

            if display and display.startswith("http") and link_domain:
                display_domain = extract_domain(display)
                if display_domain and display_domain != link_domain:
                    add_signal("URL_DISPLAY_MISMATCH", f"Shows '{display_domain}' but links to '{link_domain}'")
                    entry["is_suspicious"] = True
                    entry["risk_reason"] = "display/url domain mismatch"

            if link_domain:
                for shortener in URL_SHORTENERS:
                    if shortener in link_domain:
                        add_signal("SHORTENED_URL", f"Shortened URL via {link_domain}")
                        entry["is_suspicious"] = True
                        entry["risk_reason"] = "URL shortener"
                        break

                if is_ip_address(link_domain):
                    add_signal("IP_ADDRESS_URL", f"Link uses IP address: {link_domain}")
                    entry["is_suspicious"] = True
                    entry["risk_reason"] = "IP address URL"

                for tld in SUSPICIOUS_TLDS:
                    if link_domain.endswith(tld):
                        add_signal("SUSPICIOUS_TLD", f"Link domain ends with '{tld}'")
                        entry["is_suspicious"] = True
                        entry["risk_reason"] = f"suspicious TLD {tld}"
                        break

            all_links.append(entry)
            if entry["is_suspicious"]:
                suspicious_links.append(entry)

    # --- ATTACHMENT ANALYSIS ---
    analyzed_attachments = []
    for att in attachments:
        filename = att.get("filename", "").lower()
        content_type = att.get("content_type", "").lower()
        entry = {"filename": filename, "content_type": content_type, "is_suspicious": False, "risk_reason": None}

        for ext in DANGEROUS_EXTENSIONS:
            if filename.endswith(ext):
                add_signal("DANGEROUS_ATTACHMENT_TYPE", f"File '{filename}' is a dangerous type ({ext})")
                entry["is_suspicious"] = True
                entry["risk_reason"] = f"dangerous file type {ext}"
                break

        for ext in OFFICE_MACRO_EXTENSIONS:
            if filename.endswith(ext):
                add_signal("OFFICE_WITH_MACROS", f"File '{filename}' may contain macros")
                entry["is_suspicious"] = True
                entry["risk_reason"] = "possible macro-enabled document"
                break

        for ext in ARCHIVE_EXTENSIONS:
            if filename.endswith(ext):
                add_signal("ARCHIVE_WITH_EXECUTABLE", f"Archive '{filename}' may contain executables")
                entry["is_suspicious"] = True
                entry["risk_reason"] = "archive file"
                break

        analyzed_attachments.append(entry)

    # --- SCORE CAPPING AND LEVEL ---
    score = min(score, 100)
    if score >= 75:
        level = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    # --- SUMMARY ---
    if not triggered_signals:
        summary = "No significant phishing indicators detected."
    elif level in ("critical", "high"):
        summary = f"High confidence phishing attempt. {len(triggered_signals)} suspicious signals detected."
    elif level == "medium":
        summary = f"Some suspicious indicators found. {len(triggered_signals)} signals detected — review carefully."
    else:
        summary = f"Low risk. {len(triggered_signals)} minor indicator(s) found."

    return {
        "risk_score": score,
        "risk_level": level,
        "signals": triggered_signals,
        "links": all_links,
        "attachments": analyzed_attachments,
        "summary": summary,
    }
