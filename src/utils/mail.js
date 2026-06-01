import Mailgen from 'mailgen';
import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "BuyNest",
      link: "https://buynestlink.com",
    },
  });

  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);

  const emailHtml = mailGenerator.generate(options.mailgenContent);

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_TRAP_SMTP_HOST,
    port: process.env.MAIL_TRAP_SMTP_PORT,
    auth: {
      user: process.env.MAIL_TRAP_SMTP_USER,
      pass: process.env.MAIL_TRAP_SMTP_PASS,
    },
  });

  const mail = {
    from: "mail.buynest@example.com",
    to: options.email,
    subject: options.subject,
    text: emailTextual,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    console.error(
      "Email service failed silently. Make sure that you have provided your MAILTRAP credentials in the .env file",
    );
    console.error("Error: ", error);
  }
};


const emailVerificationMailgenContent= (username, verificationLink) =>{
    return {
        body: {
            name: username,
            intro: "Welcome to our app! We're excited to have you on board.",
            action: {
                instructions: "To verify your email address, please click the button below:",
                button: {
                    color: "#0219e3", // Optional action button color
                    text: "Verify Email",
                    link: verificationLink
                }
            },
            outro: "If you did not request this email, please ignore it."
        }
    }
}

const passwordResetMailgenContent = (username, resetLink) =>{
    return {
        body: {
            name: username,
            intro: "You have requested to reset your password. Click the button below to proceed.",
            action: {
                instructions: "To reset your password, please click the button below:",
                button: {
                    color: "#d9534f", // Optional action button color
                    text: "Reset Password",
                    link: resetLink
                }
            },
            outro: "If you did not request this email, please report it."
                
        }}
};

export {emailVerificationMailgenContent, passwordResetMailgenContent, sendEmail};