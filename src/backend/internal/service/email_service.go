package service

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"

	"github.com/nodetl/nodetl/config"
)

// EmailService handles sending emails
type EmailService struct {
	host     string
	port     string
	username string
	password string
	from     string
	fromName string
	useTLS   bool
}

// NewEmailService creates a new email service
func NewEmailService(cfg *config.SMTPConfig) *EmailService {
	return &EmailService{
		host:     cfg.Host,
		port:     cfg.Port,
		username: cfg.Username,
		password: cfg.Password,
		from:     cfg.From,
		fromName: cfg.FromName,
		useTLS:   cfg.UseTLS,
	}
}

// IsConfigured returns true if SMTP is configured
func (s *EmailService) IsConfigured() bool {
	return s.host != "" && s.from != ""
}

// SendInvitation sends an invitation email
func (s *EmailService) SendInvitation(toEmail, toName, inviteLink string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("email service not configured")
	}

	subject := fmt.Sprintf("You've been invited to %s", s.fromName)
	
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>%s</h1>
        </div>
        <div class="content">
            <p>Hello %s,</p>
            <p>You've been invited to join <strong>%s</strong>.</p>
            <p>Click the button below to accept your invitation and set up your account:</p>
            <p style="text-align: center;">
                <a href="%s" class="button">Accept Invitation</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #0ea5e9;">%s</p>
            <p><strong>This invitation will expire in 7 days.</strong></p>
        </div>
        <div class="footer">
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
`, s.fromName, toName, s.fromName, inviteLink, inviteLink)

	return s.sendEmail(toEmail, subject, htmlBody)
}

// SendPasswordReset sends a password reset email
func (s *EmailService) SendPasswordReset(toEmail, toName, resetLink string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("email service not configured")
	}

	subject := fmt.Sprintf("Password Reset for %s", s.fromName)
	
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Reset</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .button { display: inline-block; padding: 12px 24px; background: #0ea5e9; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>%s</h1>
        </div>
        <div class="content">
            <p>Hello %s,</p>
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <p style="text-align: center;">
                <a href="%s" class="button">Reset Password</a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #0ea5e9;">%s</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
        </div>
        <div class="footer">
            <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
    </div>
</body>
</html>
`, s.fromName, toName, resetLink, resetLink)

	return s.sendEmail(toEmail, subject, htmlBody)
}

// sendEmail sends an email using SMTP
func (s *EmailService) sendEmail(to, subject, htmlBody string) error {
	from := s.from
	if s.fromName != "" {
		from = fmt.Sprintf("%s <%s>", s.fromName, s.from)
	}

	// Build message
	headers := make(map[string]string)
	headers["From"] = from
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	var msg strings.Builder
	for k, v := range headers {
		msg.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := fmt.Sprintf("%s:%s", s.host, s.port)

	// Use TLS if configured
	if s.useTLS {
		return s.sendWithTLS(addr, to, msg.String())
	}

	// Use plain SMTP
	var auth smtp.Auth
	if s.username != "" && s.password != "" {
		auth = smtp.PlainAuth("", s.username, s.password, s.host)
	}

	return smtp.SendMail(addr, auth, s.from, []string{to}, []byte(msg.String()))
}

// sendWithTLS sends email using TLS
func (s *EmailService) sendWithTLS(addr, to, msg string) error {
	tlsConfig := &tls.Config{
		ServerName: s.host,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("failed to create client: %w", err)
	}
	defer client.Close()

	// Auth if credentials provided
	if s.username != "" && s.password != "" {
		auth := smtp.PlainAuth("", s.username, s.password, s.host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("auth failed: %w", err)
		}
	}

	// Set sender
	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("failed to set sender: %w", err)
	}

	// Set recipient
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	// Send body
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("failed to open data: %w", err)
	}

	_, err = w.Write([]byte(msg))
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("failed to close writer: %w", err)
	}

	return client.Quit()
}
