const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text,html) => {
  const transporter = nodemailer.createTransport({
    host: "smtpout.secureserver.net", // GoDaddy SMTP server
    port: 465, // Use 465 for SSL or 587 for TLS
    secure: true, // Use SSL
    auth: {
      user: process.env.SUPPORT_EMAIL, // Your GoDaddy email address
      pass: process.env.EMAIL_PASSWORD, // Your GoDaddy email password
    },
  });

  const mailOptions = {
    from: process.env.SUPPORT_EMAIL,
    to,
    subject,
    text,
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email send failed");
  }
};

module.exports = { sendEmail };
