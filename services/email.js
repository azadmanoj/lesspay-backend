const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, text) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // You can use a different email service
    auth: {
      user: "manuazad6@gmail.com", // Add your email address here
      pass: "lzcvwttrtjaswbvj", // Add your email password here
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Email send failed");
  }
};

module.exports = { sendEmail };
