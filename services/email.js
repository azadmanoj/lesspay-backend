const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text,html) => {
  const transporter = nodemailer.createTransport({
    host: "smtpout.secureserver.net", 
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.SUPPORT_EMAIL, 
      pass: process.env.EMAIL_PASSWORD, 
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
