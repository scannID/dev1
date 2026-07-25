package com.scanny.service;

import com.scanny.entity.Ticket;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import java.util.Locale;

@Service
public class TicketMailService {

    private static final Logger logger = LoggerFactory.getLogger(TicketMailService.class);

    private final JavaMailSender mailSender;

    @Value("${scanny.mail.from:noreply@scanny.app}")
    private String mailFrom;

    public TicketMailService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    public void sendAttendeeTicket(Ticket ticket, String viewUrl) {
        if (mailSender == null) {
            logger.warn("Mail sender not configured; skipping ticket email for {}", ticket.getId());
            return;
        }
        try {
            String amount = String.format(Locale.US, "%,d %s", ticket.getPrice(), ticket.getCurrency());
            String eventDate = ticket.getEventDate() != null
                ? ticket.getEventDate().toString().replace('T', ' ')
                : "See ticket";
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(ticket.getHolderEmail());
            helper.setSubject("Your Scanny ticket — " + ticket.getEventName());
            helper.setText(
                """
                <div style="font-family:Outfit,Segoe UI,Arial,sans-serif;line-height:1.55;color:#111827;max-width:560px;margin:0 auto;padding:8px">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#e86a17">Scanny</p>
                  <h2 style="margin:0 0 12px;font-size:24px;letter-spacing:-0.02em">Your ticket is ready</h2>
                  <p style="margin:0 0 16px">Hi %s,</p>
                  <p style="margin:0 0 16px">Payment confirmed. Here is your entry pass for <strong>%s</strong>.</p>
                  <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:0 0 20px">
                    <p style="margin:0 0 8px;font-size:13px;color:#6b7280">Event</p>
                    <p style="margin:0 0 12px;font-size:18px;font-weight:700">%s</p>
                    <p style="margin:0;font-size:13px;color:#6b7280">
                      Class: <strong style="color:#111827">%s</strong><br/>
                      Date: <strong style="color:#111827">%s</strong><br/>
                      Amount: <strong style="color:#111827">%s</strong><br/>
                      Ticket ID: <strong style="color:#111827">%s</strong>
                    </p>
                  </div>
                  <p style="margin:0 0 24px">
                    <a href="%s" style="background:#e86a17;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:700;display:inline-block">
                      Open ticket &amp; QR
                    </a>
                  </p>
                  <p style="font-size:13px;color:#6b7280;margin:0 0 8px">
                    Show the QR code at entry. Keep this email — it is your proof of purchase.
                  </p>
                  <p style="font-size:12px;color:#9ca3af;margin:0">— Scanny</p>
                </div>
                """.formatted(
                    escape(ticket.getHolderName()),
                    escape(ticket.getEventName()),
                    escape(ticket.getEventName()),
                    escape(ticket.getTicketType()),
                    escape(eventDate),
                    amount,
                    ticket.getId(),
                    viewUrl
                ),
                true
            );
            mailSender.send(message);
            logger.info("Sent attendee ticket email for {} to {}", ticket.getId(), ticket.getHolderEmail());
        } catch (MessagingException | MailException e) {
            logger.error("Failed to send ticket email for {}", ticket.getId(), e);
        }
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;");
    }
}
