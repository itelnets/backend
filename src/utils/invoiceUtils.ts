import puppeteer from 'puppeteer';
import Order from '../models/Order';

export const generateInvoicePdfBuffer = async (orderId: string): Promise<Buffer> => {
    const order = await Order.findById(orderId)
        .populate('orderItems.product', 'name images price hsn batchNo expiredOn manufacturer')
        .populate('user', 'name email mobileNumber');

    if (!order) {
        throw new Error('Order not found');
    }

    const selectedOrder: any = order;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Invoice - ${selectedOrder._id}</title>
        </head>
        <body>
            <div style="padding: 40px 20px; font-family: 'Arial', sans-serif; font-size: 11px; color: #000; max-width: 800px; margin: auto;">
                
                <!-- Top Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                    <div>
                        <h1 style="margin: 0; font-size: 28px; font-weight: 800;">Pratham Herbs</h1>
                    </div>
                    <div style="text-align: right;">
                        <h2 style="margin: 0; font-size: 16px; font-weight: bold;">Tax Invoice/Bill of Supply/Cash Memo</h2>
                        <p style="margin: 2px 0 0 0; font-size: 12px;">(Original for Recipient)</p>
                    </div>
                </div>
                
                <!-- Addresses & Details -->
                <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                    <div style="width: 45%;">
                        <p style="margin: 0 0 4px 0; font-weight: bold;">Sold By :</p>
                        <p style="margin: 0 0 4px 0;">Pratham Herbs</p>
                        <p style="margin: 0 0 4px 0;">Varni Plaza, 128, Near Sudama Chowk</p>
                        <p style="margin: 0 0 4px 0;">Mota Varachha, Surat, Gujarat 394101</p>
                        <p style="margin: 0 0 4px 0;">IN</p>
                        <br/>
                        <p style="margin: 0 0 4px 0;"><strong>GST Registration No:</strong> 24KIBPK3086F1Z9</p>
                        
                        <br/><br/>
                        <p style="margin: 0 0 4px 0;"><strong>Order Number:</strong> ${selectedOrder.cashfreeOrderId || selectedOrder.razorpayOrderId || selectedOrder._id}</p>
                        <p style="margin: 0 0 4px 0;"><strong>Order Date:</strong> ${new Date(selectedOrder.createdAt).toLocaleDateString('en-GB').replace(/\//g, '.')}</p>
                    </div>
                    
                    <div style="width: 50%; text-align: right; word-wrap: break-word;">
                        <p style="margin: 0 0 4px 0; font-weight: bold;">Billing Address :</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.user?.name || 'Customer'}</p>
                        ${selectedOrder.shippingAddress?.addressLine1 ? `
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.addressLine1},</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.addressLine2 || ''}${selectedOrder.shippingAddress.addressLine2 ? ' - ' : ''}${selectedOrder.shippingAddress.postalCode || ''},</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.landmark ? selectedOrder.shippingAddress.landmark + ', ' : ''}${selectedOrder.shippingAddress.city || ''}, ${selectedOrder.shippingAddress.state || ''}, India</p>
                        ` : `
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.address || ''}</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.city || ''}, ${selectedOrder.shippingAddress?.postalCode || ''}</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.country || 'India'}</p>
                        `}
                        
                        <br/>
                        <p style="margin: 0 0 4px 0; font-weight: bold;">Shipping Address :</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.user?.name || 'Customer'}</p>
                        ${selectedOrder.shippingAddress?.addressLine1 ? `
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.addressLine1},</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.addressLine2 || ''}${selectedOrder.shippingAddress.addressLine2 ? ' - ' : ''}${selectedOrder.shippingAddress.postalCode || ''},</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress.landmark ? selectedOrder.shippingAddress.landmark + ', ' : ''}${selectedOrder.shippingAddress.city || ''}, ${selectedOrder.shippingAddress.state || ''}, India</p>
                        ` : `
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.address || ''}</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.city || ''}, ${selectedOrder.shippingAddress?.postalCode || ''}</p>
                        <p style="margin: 0 0 4px 0;">${selectedOrder.shippingAddress?.country || 'India'}</p>
                        `}
                        
                        <br/>
                        <p style="margin: 0 0 4px 0;"><strong>Invoice Number :</strong> IN-${selectedOrder._id.toString().substring(0, 8).toUpperCase()}</p>
                        <p style="margin: 0 0 4px 0;"><strong>Invoice Date :</strong> ${new Date(selectedOrder.createdAt).toLocaleDateString('en-GB').replace(/\//g, '.')}</p>
                    </div>
                </div>
                
                <!-- Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; border: 1px solid #000;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: center; font-weight: bold; width: 3%; vertical-align: middle;">Sl. No</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: left; font-weight: bold; width: 20%; vertical-align: middle;">Description</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: left; font-weight: bold; vertical-align: middle;">HSN</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: left; font-weight: bold; vertical-align: middle;">Batch</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: left; font-weight: bold; vertical-align: middle;">Exp</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: left; font-weight: bold; vertical-align: middle;">Mfr. Name</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">Unit Price</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: center; font-weight: bold; vertical-align: middle;">Qty</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">Net Amount</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: center; font-weight: bold; vertical-align: middle;">Tax Rate</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: center; font-weight: bold; vertical-align: middle;">Tax Type</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">Tax Amount</th>
                            <th style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">Total Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedOrder.orderItems.map((item: any, index: number) => {
        const itemPrice = item.price || 0;
        const netAmount = itemPrice * item.qty;
        const taxRate = 5;
        const taxAmount = netAmount * 0.05;
        const totalAmount = netAmount + taxAmount;

        const hsn = item.product?.hsn || '-';
        const batchNo = item.product?.batchNo || '-';
        const expiredOn = item.product?.expiredOn || '-';
        const manufacturer = item.product?.manufacturer || '-';

        return `
                            <tr>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">${index + 1}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">${item.name}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">${hsn}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">${batchNo}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">${expiredOn}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">${manufacturer}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${itemPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">${item.qty}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">${taxRate}%</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">IGST</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            `;
    }).join('')}
                        ${selectedOrder.shippingPrice > 0 ? `
                            <tr>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;"></td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">Shipping Charges</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${(selectedOrder.shippingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">1</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${(selectedOrder.shippingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: center; vertical-align: middle;">-</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹0.00</td>
                                <td style="border: 1px solid #000; border-bottom: none; border-top: none; padding: 14px 4px; text-align: right; vertical-align: middle;">₹${(selectedOrder.shippingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ` : ''}
                        <tr style="border-top: 1px solid #000;">
                            <td colspan="11" style="border: 1px solid #000; padding: 14px 4px; font-weight: bold; text-align: right; vertical-align: middle;">TOTAL:</td>
                            <td style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">₹${(selectedOrder.taxPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td style="border: 1px solid #000; padding: 14px 4px; text-align: right; font-weight: bold; vertical-align: middle;">₹${(selectedOrder.totalPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                        <tr>
                            <td colspan="13" style="border: 1px solid #000; padding: 60px 4px 15px 4px; text-align: right; vertical-align: bottom;">
                                <strong>For Pratham Herbs:</strong><br/><br/><br/>
                                <strong>Authorized Signatory</strong>
                            </td>
                        </tr>
                    </tbody>
                </table>
                
                <div style="margin-top: 5px; font-size: 10px;">
                    <p style="margin: 0;">Whether tax is payable under reverse charge - No</p>
                </div>
            </div>
        </body>
        </html>
    `;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

    await browser.close();

    return Buffer.from(pdfBuffer);
};
