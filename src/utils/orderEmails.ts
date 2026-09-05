import nodemailer from 'nodemailer';
import { generateInvoicePdfBuffer } from './invoiceUtils';

let cachedTransporter: any = null;

const getTransporter = () => {
    if (cachedTransporter) return cachedTransporter;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = Number(process.env.EMAIL_PORT);

    cachedTransporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        auth: {
            user: emailUser,
            pass: emailPass,
        },
    });

    return cachedTransporter;
};

const isProduction = () => process.env.NODE_ENV === 'production';

export const sendOrderConfirmationEmail = async (email: string, orderDetails: any): Promise<boolean> => {

    try {
        const invoiceBuffer = await generateInvoicePdfBuffer(orderDetails._id.toString());

        let customerName = 'Customer';
        if (orderDetails.user && typeof orderDetails.user === 'object' && orderDetails.user.name) {
            customerName = orderDetails.user.name;
        } else if (orderDetails.user) {
            const User = require('../models/User').default;
            const user = await User.findById(orderDetails.user);
            if (user && user.name) customerName = user.name;
        }

        const companyName = 'Pratham Herbs';
        const supportEmail = 'care@prathamherbs.com';
        const invoiceNumber = `IN-${orderDetails._id.toString().substring(0, 8).toUpperCase()}`;
        const orderDate = new Date(orderDetails.createdAt || new Date()).toLocaleDateString('en-GB').replace(/\//g, '-');
        const totalAmount = (orderDetails.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

        const htmlBody = `
            <div style="font-family: Arial, sans-serif; color: #374151; font-size: 14px; line-height: 1.5;">
                <p style="margin: 0 0 10px 0;">Dear ${customerName},</p>
                <p style="margin: 0 0 10px 0;">Thank you for your purchase from ${companyName}! We’re happy to confirm that your payment was successfully received and your order has been confirmed.</p>
                
                <p style="margin: 0 0 5px 0;"><strong>Order Details:</strong></p>
                <ul style="list-style-type: none; padding-left: 0; margin: 0 0 10px 0;">
                    <li style="margin-bottom: 3px;">• <strong>Order ID:</strong> ${orderDetails._id}</li>
                    <li style="margin-bottom: 3px;">• <strong>Invoice No.:</strong> ${invoiceNumber}</li>
                    <li style="margin-bottom: 3px;">• <strong>Order Date:</strong> ${orderDate}</li>
                    <li style="margin-bottom: 3px;">• <strong>Total Amount:</strong> ₹${totalAmount}</li>
                </ul>
                
                <p style="margin: 0 0 15px 0;">Your invoice is attached to this email for your records. We’ll keep you updated regarding your order status and delivery. If you have any questions, please contact us at <a href="mailto:${supportEmail}" style="color: #15803d; text-decoration: none;">${supportEmail}</a>.</p>
                
                <p style="margin: 0 0 15px 0;">Thank you for shopping with ${companyName}! Visit for more products: <a href="https://www.google.com" target="_blank" style="color: #15803d; text-decoration: none;">www.google.com</a></p>
                
                <p style="margin: 0;">Best regards,<br/><strong>${companyName}</strong><br/><a href="mailto:${supportEmail}" style="color: #15803d; text-decoration: none;">${supportEmail}</a></p>
            </div>
        `;

        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"Pratham Herbs" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Order Confirmation - Pratham Herbs',
            html: htmlBody,
            attachments: [
                {
                    filename: `Invoice-${orderDetails._id}.pdf`,
                    content: invoiceBuffer,
                    contentType: 'application/pdf',
                },
            ],
        });
        return true;
    } catch (error: any) {
        console.error('Order Confirmation Email error:', error.message);
        return false;
    }
};

export const sendRefundEmail = async (email: string, orderDetails: any, status: string): Promise<boolean> => {

    try {
        let customerName = 'Customer';
        if (orderDetails.user && typeof orderDetails.user === 'object' && orderDetails.user.name) {
            customerName = orderDetails.user.name;
        } else if (orderDetails.user) {
            const User = require('../models/User').default;
            const user = await User.findById(orderDetails.user);
            if (user && user.name) customerName = user.name;
        }

        const companyName = 'Pratham Herbs';
        const supportEmail = 'care@prathamherbs.com';
        const orderDate = new Date(orderDetails.createdAt || new Date()).toLocaleDateString('en-GB').replace(/\//g, '-');
        const amountPaid = (orderDetails.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
        const refundAmount = amountPaid;
        const refundReason = orderDetails.refundReason || orderDetails.returnReason || 'Requested by customer';
        const paymentId = orderDetails.cashfreePaymentId || orderDetails.razorpayPaymentId || orderDetails.paymentResult?.id || 'N/A';

        const htmlBody = `
            <div style="font-family: Arial, sans-serif; color: #374151; font-size: 15px; line-height: 1.6;">
                <p>Dear ${customerName},</p>
                <p>We have received your refund request for your order.</p>
                
                <p><strong>Order Details:</strong></p>
                <ul style="list-style-type: none; padding-left: 0;">
                    <li>• <strong>Order ID:</strong> ${orderDetails._id}</li>
                    <li>• <strong>Payment ID:</strong> ${paymentId}</li>
                    <li>• <strong>Order Date:</strong> ${orderDate}</li>
                    <li>• <strong>Amount Paid:</strong> ₹${amountPaid}</li>
                    <li>• <strong>Refund Amount:</strong> ₹${refundAmount}</li>
                    <li>• <strong>Refund Reason:</strong> ${refundReason}</li>
                </ul>
                
                <p>Your refund request has been submitted successfully and is currently being processed.</p>
                <p>Once the refund is initiated, the amount will be credited back to your original payment method. The exact time may depend on your bank or payment provider.</p>
                <p>We will notify you once the refund has been processed.</p>
                
                <p>If you have any questions, please contact us at <a href="mailto:${supportEmail}" style="color: #15803d; text-decoration: none;">${supportEmail}</a>.</p>
                <p>Thank you for your patience. Visit for more products: <a href="https://www.google.com" target="_blank" style="color: #15803d; text-decoration: none;">www.google.com</a></p>
                <br/>
                <p style="margin: 0;">Best regards,</p>
                <p style="margin: 0;"><strong>${companyName}</strong></p>
                <p style="margin: 0;"><a href="mailto:${supportEmail}" style="color: #15803d; text-decoration: none;">${supportEmail}</a></p>
            </div>
        `;

        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"Pratham Herbs" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Refund Request Received - Pratham Herbs',
            html: htmlBody,
        });
        return true;
    } catch (error: any) {
        console.error('Refund Email error:', error.message);
        return false;
    }
};

export const sendReturnStatusEmail = async (email: string, orderDetails: any, status: string): Promise<boolean> => {

    try {
        const transporter = getTransporter();

        await transporter.sendMail({
            from: `"Pratham Herbs" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Return Request ${status.charAt(0).toUpperCase() + status.slice(1)} - Pratham Herbs`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                    <h2 style="color: ${status === 'approved' ? '#15803d' : '#ef4444'}; text-align: center; margin-bottom: 24px;">Return Request ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
                    <p>Dear Customer,</p>
                    <p>Your return request for order <strong>${orderDetails._id}</strong> has been ${status}.</p>
                    ${status === 'approved' ? '<p>We will arrange a pickup shortly and initiate your refund once the items are received and inspected.</p>' : ''}
                    
                    <p style="margin-top: 16px;">Visit for more products: <a href="https://www.google.com" target="_blank" style="color: #15803d; text-decoration: none;">www.google.com</a></p>
                    
                    <p style="margin-top: 24px; font-size: 13px; color: #6b7280;">Best regards,<br>Pratham Herbs Team</p>
                </div>
            `,
        });
        return true;
    } catch (error: any) {
        console.error('Return Status Email error:', error.message);
        return false;
    }
};
