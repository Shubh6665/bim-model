/**
 * Email Templates for BIM Model Platform
 */

export interface TicketEmailData {
  ticketCode: string;
  requester: {
    name: string;
    surname: string;
    contact: string;
  };
  location: {
    building: string;
    level: string;
    room: string;
    spaceCode: string;
  };
  intervention: {
    discipline: string;
    category: string;
    item: string;
    descriptionShort: string;
    descriptionDetailed: string;
  };
  createdAt: string;
  qrCodeDataUrl?: string;
}

export function generateTicketNotificationEmail(data: TicketEmailData): string {
  const { ticketCode, requester, location, intervention, createdAt, qrCodeDataUrl } = data;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Maintenance Ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); border-radius: 50%; padding: 16px; margin-bottom: 16px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">New Maintenance Ticket</h1>
              <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">Action Required</p>
            </td>
          </tr>
          
          <!-- Ticket Code -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb;">
              <div style="text-align: center;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Ticket Code</p>
                <p style="margin: 0; color: #111827; font-size: 32px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">${ticketCode}</p>
              </div>
            </td>
          </tr>
          
          <!-- QR Code -->
          ${qrCodeDataUrl ? `
          <tr>
            <td style="padding: 30px; text-align: center; background-color: #ffffff;">
              <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px; font-weight: 500;">Scan QR Code for Quick Access</p>
              <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 4px solid #e5e7eb; border-radius: 12px;" />
            </td>
          </tr>
          ` : ''}
          
          <!-- Requester Information -->
          <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600;">👤 Requester Information</h2>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="color: #6b7280; font-size: 14px; width: 120px;">Name:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${requester.name} ${requester.surname}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Contact:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${requester.contact}</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Location Information -->
          <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb; background-color: #f9fafb;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600;">📍 Location</h2>
              <table width="100%" cellpadding="8" cellspacing="0">
                ${location.building ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px; width: 120px;">Building:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${location.building}</td>
                </tr>
                ` : ''}
                ${location.level ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Level:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${location.level}</td>
                </tr>
                ` : ''}
                ${location.room ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Room:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${location.room}</td>
                </tr>
                ` : ''}
                ${location.spaceCode ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Space Code:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${location.spaceCode}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          
          <!-- Issue Details -->
          <tr>
            <td style="padding: 30px; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0 0 20px 0; color: #111827; font-size: 18px; font-weight: 600;">🔧 Issue Details</h2>
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="color: #6b7280; font-size: 14px; width: 120px;">Discipline:</td>
                  <td>
                    <span style="display: inline-block; background-color: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;">${intervention.discipline || 'Not specified'}</span>
                  </td>
                </tr>
                ${intervention.category ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Category:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${intervention.category}</td>
                </tr>
                ` : ''}
                ${intervention.item ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px;">Item:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${intervention.item}</td>
                </tr>
                ` : ''}
                ${intervention.descriptionShort ? `
                <tr>
                  <td style="color: #6b7280; font-size: 14px; vertical-align: top;">Description:</td>
                  <td style="color: #111827; font-size: 14px; font-weight: 500;">${intervention.descriptionShort}</td>
                </tr>
                ` : ''}
              </table>
              
              ${intervention.descriptionDetailed ? `
              <div style="margin-top: 20px; padding: 16px; background-color: #f9fafb; border-left: 4px solid #3b82f6; border-radius: 6px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Detailed Description</p>
                <p style="margin: 0; color: #111827; font-size: 14px; line-height: 1.6;">${intervention.descriptionDetailed}</p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- Timestamp -->
          <tr>
            <td style="padding: 30px; background-color: #f9fafb;">
              <p style="margin: 0; color: #6b7280; font-size: 13px; text-align: center;">
                <strong>Created:</strong> ${new Date(createdAt).toLocaleString('en-US', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </p>
            </td>
          </tr>
          
          <!-- Call to Action -->
          <tr>
            <td style="padding: 40px 30px; text-align: center; background-color: #ffffff;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
                 style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                View Ticket in Dashboard
              </a>
              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 13px;">
                Please review and assign this ticket to the appropriate technician
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px; background-color: #111827; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 13px;">
                BIM Model Platform - Maintenance Management System
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                This is an automated notification. Please do not reply to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
