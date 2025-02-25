const axios = require('axios');

const sendSMS = async (phone, message) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`DEV SMS to ${phone}: ${message}`);
        return { success: true };
    }

    try {
        const response = await axios.post('https://api.smtp2go.com/v3/sms/send', {
            api_key: process.env.SMTP2GO_API_KEY,
            to: phone,
            sender: 'LessPay',
            message: message
        });

        if (response.data && response.data.data && response.data.data.succeeded) {
            return { success: true };
        } else {
            throw new Error(response.data.error || 'SMS sending failed');
        }
    } catch (error) {
        console.error('SMS sending error:', error);
        throw error;
    }
};

module.exports = { sendSMS };
