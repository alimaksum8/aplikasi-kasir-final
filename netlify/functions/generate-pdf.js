const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Helper function untuk format Rupiah
const formatRupiah = (number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);

// Fungsi untuk membuat HTML satu struk
const createReceiptHTML = (transaction, employees) => {
    const employee = employees.find(e => e.id == transaction.employeeId);
    const timestampString = typeof transaction.timestamp === 'string' ? transaction.timestamp : new Date(transaction.timestamp).toLocaleString('id-ID');

    return `
        <div class="receipt-container" style="font-family: 'Courier New', monospace; font-size: 10pt; width: 80mm; padding: 5mm; box-sizing: border-box; page-break-after: always;">
            <div style="text-align: center; margin-bottom: 10px;">
                <h3 style="margin: 0; font-size: 14pt;">Warung Serbaguna</h3>
                <p style="margin: 0; font-size: 8pt;">Jl. Merdeka No. 123</p>
                <p style="margin: 0; font-size: 8pt;">Terima Kasih</p>
            </div>
            <div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 5px 0; margin: 5px 0; font-size: 9pt;">
                <p style="margin: 2px 0;">ID: ${transaction.receiptId}</p>
                <p style="margin: 2px 0;">Waktu: ${timestampString}</p>
                <p style="margin: 2px 0;">Kasir: ${employee ? employee.name : 'N/A'}</p>
            </div>
            <table style="width: 100%; font-size: 9pt; border-collapse: collapse;">
                <tbody>
                    ${transaction.items.map(item => `
                        <tr>
                            <td style="padding: 2px 0; vertical-align: top; text-align: left;">${item.name} (${item.quantity}x)</td>
                            <td style="padding: 2px 0; vertical-align: top; text-align: right;">${formatRupiah(item.price * item.quantity)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; font-size: 9pt;">
                <div style="display: flex; justify-content: space-between; font-weight: bold;"><span>Total</span><span>${formatRupiah(transaction.total)}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Tunai</span><span>${formatRupiah(transaction.payment)}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>Kembali</span><span>${formatRupiah(transaction.change)}</span></div>
            </div>
            <div style="text-align: center; margin-top: 10px; font-size: 8pt;">
                <p>--- Layanan Pelanggan: 0812-3456-7890 ---</p>
            </div>
        </div>
    `;
};

exports.handler = async function (event, context) {
  let browser = null;
  try {
    const { transactions, employees } = JSON.parse(event.body);

    if (!transactions || !employees || transactions.length === 0) {
        return { statusCode: 400, body: 'Data transaksi tidak lengkap.' };
    }

    const allReceiptsHTML = transactions.map(trx => createReceiptHTML(trx, employees)).join('');
    const finalHTML = `<html><head><style>.receipt-container:last-child { page-break-after: auto; }</style></head><body>${allReceiptsHTML}</body></html>`;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setContent(finalHTML, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
        width: '80mm',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="struk.pdf"'
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal membuat PDF.", details: error.message }),
    };
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
