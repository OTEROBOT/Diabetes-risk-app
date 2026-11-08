"""ส่งอีเมล: 1) Brevo HTTPS API (พอร์ต 443 ใช้ได้บน Render ทุกแพ็กเกจ)  2) SMTP (Brevo relay ฯลฯ — Render แพ็กเกจฟรีบล็อกพอร์ต 25/465/587)  3) ไม่ได้ตั้งค่า = พิมพ์ลง console (โหมดพัฒนา)"""
import os, json, smtplib, urllib.request, urllib.error
from email.message import EmailMessage

class MailError(Exception): pass

def mode():
    return "brevo_api" if os.environ.get("BREVO_API_KEY") else "smtp" if os.environ.get("SMTP_HOST") else "console"

def send_mail(to, subject, html, text=""):
    sender = os.environ.get("MAIL_FROM_EMAIL", "")
    name = os.environ.get("MAIL_FROM_NAME", "เว็บแอปทำนายความเสี่ยงโรคเบาหวาน")
    m = mode()
    if m == "console":
        print(f"\n[MAIL:console] to={to} subject={subject}\n{text or html}\n"); return m
    if not sender: raise MailError("ยังไม่ได้ตั้งค่า MAIL_FROM_EMAIL (ต้องเป็นอีเมลผู้ส่งที่ยืนยันแล้วใน Brevo)")
    try:
        if m == "brevo_api":
            body = json.dumps({"sender": {"email": sender, "name": name}, "to": [{"email": to}], "subject": subject, "htmlContent": html, "textContent": text or None}).encode()
            req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=body, method="POST",
                                         headers={"api-key": os.environ["BREVO_API_KEY"], "content-type": "application/json", "accept": "application/json"})
            urllib.request.urlopen(req, timeout=20).read()
        else:
            msg = EmailMessage(); msg["From"] = f"{name} <{sender}>"; msg["To"] = to; msg["Subject"] = subject
            msg.set_content(text or "กรุณาเปิดอีเมลนี้ด้วยโปรแกรมที่รองรับ HTML"); msg.add_alternative(html, subtype="html")
            with smtplib.SMTP(os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", 587)), timeout=20) as s:
                s.starttls(); s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"]); s.send_message(msg)
    except urllib.error.HTTPError as e:
        raise MailError(f"Brevo ตอบกลับ {e.code}: {e.read().decode('utf-8', 'ignore')[:200]}")
    except Exception as e:
        raise MailError(f"ส่งอีเมลไม่สำเร็จ: {e}")
    return m
