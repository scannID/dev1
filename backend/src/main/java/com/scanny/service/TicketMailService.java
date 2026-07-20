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
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(mailFrom);
            helper.setTo(ticket.getHolderEmail());
            helper.setSubject("Your ticket — " + ticket.getEventName());
            helper.setText(
                """
                <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.55;color:#111827;max-width:560px">
                  <h2 style="margin:0 0 12px">You're in!</h2>
                  <p>Hi %s,</p>
                  <p>Payment confirmed for <strong>%s</strong> (%s — %s).</p>
                  <p style="margin:24px 0">
                    <a href="%s" style="background:#0f766e;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700;display:inline-block">
                      Open my ticket
                    </a>
                  </p>
                  <p style="font-size:13px;color:#6b7280">
                    This ticket is for <strong>%s</strong> only. Show the QR code at the gate.
                    Each ticket works once — sharing won't get a second person in after you've entered.
                  </p>
                  <p style="font-size:12px;color:#9ca3af">Ticket ID: %s · — Scanny</p>
                </div>
                """.formatted(
                    escape(ticket.getHolderName()),
                    escape(ticket.getEventName()),
                    escape(ticket.getTicketType()),
                    amount,
                    viewUrl,
                    escape(ticket.getHolderName()),
                    ticket.getId()
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
