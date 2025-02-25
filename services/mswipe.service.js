const axios = require("axios");

class MswipeService {
  constructor() {
    this.baseUrl = process.env.MSWIPE_BASE_URL;
    this.credentials = {
      userId: process.env.MSWIPE_USER_ID,
      clientId: process.env.MSWIPE_CLIENT_ID,
      password: process.env.MSWIPE_PASSWORD,
      custCode: process.env.MSWIPE_CUST_CODE,
    };
  }

  async generateToken() {
    try {
      const response = await axios.post(`${this.baseUrl}/CreatePBLAuthToken`, {
        userId: this.credentials.userId,
        clientId: this.credentials.clientId,
        password: this.credentials.password,
        applId: "api",
        channelId: "pbl",
      });

      if (response.data.status === "true") {
        return response.data.token;
      }
      throw new Error(response.data.msg);
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  async generatePaymentLink(paymentData, sessionToken) {
    try {
      const response = await axios.post(`${this.baseUrl}/MswipePayment`, {
        amount: paymentData.amount.toString(),
        mobileno: paymentData.phone,
        custcode: this.credentials.custCode,
        user_id: this.credentials.userId,
        sessiontoken: sessionToken,
        versionno: "VER4.0.0",
        email_id: paymentData.email,
        invoice_id: paymentData.orderId,
        request_id: paymentData.requestId,
        ApplicationId: "api",
        ChannelId: "pbl",
        ClientId: this.credentials.clientId,
      });

      if (response.data.status === "True") {
        return {
          txnId: response.data.txn_id,
          paymentLink: response.data.smslink,
          status: "created",
        };
      }
      throw new Error(response.data.responsemessage);
    } catch (error) {
      throw new Error(`Payment link generation failed: ${error.message}`);
    }
  }

  async checkTransactionStatus(transId) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/getPBLTransactionDetails`,
        {
          id: transId,
        }
      );

      if (response.data.Status === "True") {
        return response.data.Data[0];
      }
      throw new Error("Transaction status check failed");
    } catch (error) {
      throw new Error(`Transaction status check failed: ${error.message}`);
    }
  }
}

module.exports = new MswipeService();
