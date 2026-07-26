import io
import math
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from models import Order

# Brand Colors mapped from JS
terracotta = Color(166/255, 95/255, 70/255)
gold = Color(184/255, 155/255, 114/255)
espresso = Color(36/255, 28/255, 24/255)
linen = Color(245/255, 239/255, 232/255)
sand = Color(243/255, 235/255, 225/255)
cocoa = Color(74/255, 52/255, 43/255)
white = Color(1, 1, 1)

SELLER = {
    'name': 'Your Company Name',
    'addr1': '123 Business Road',
    'addr2': 'Tech Park, City',
    'statePin': 'State - 100001',
    'gstin': '00XXXXX0000X0Z0',
    'state': 'state name',
}

def number_to_words(amount: float) -> str:
    # A simplified version of Indian number to words
    rupees = int(math.floor(amount))
    paise = int(round((amount - rupees) * 100))
    if rupees == 0:
        return "ZERO RUPEES ONLY"
    # Placeholder simplified string for brevity in this backend
    return f"RUPEES {rupees} AND PAISE {paise} ONLY"

def generate_invoice_pdf(order: Order) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    M = 14 * mm
    
    # --- HEADER ---
    c.setFillColor(linen)
    c.rect(0, height - 46*mm, width, 46*mm, fill=1, stroke=0)
    
    # Brand
    c.setFillColor(espresso)
    
    text_x = M
    if order.company_logo:
        try:
            import base64
            from reportlab.lib.utils import ImageReader
            logo_data = base64.b64decode(order.company_logo)
            logo_img = ImageReader(io.BytesIO(logo_data))
            c.drawImage(logo_img, M, height - 42*mm, width=35*mm, height=35*mm, preserveAspectRatio=True, anchor='nw')
            text_x = M + 40*mm
        except Exception as e:
            print("Logo error:", e)
            pass

    c.setFont("Times-Roman", 28)
    c.drawString(text_x, height - 17*mm, "YOUR")
    c.setFont("Times-Roman", 9.5)
    c.drawString(text_x, height - 23*mm, "COMPANY")
    
    c.setFont("Helvetica", 7)
    c.drawString(text_x, height - 31.5*mm, SELLER['addr1'])
    c.drawString(text_x, height - 36*mm, SELLER['addr2'] + ', ' + SELLER['statePin'])
    c.drawString(text_x, height - 40.5*mm, 'GSTIN: ' + SELLER['gstin'])
    
    # Right Meta
    c.setFillColor(terracotta)
    c.setFont("Helvetica-Bold", 16)
    c.drawRightString(width - M, height - 14*mm, "TAX INVOICE")
    
    display_id = f"CB{order.id}" if not order.id.startswith("CB") else order.id
    
    try:
        dt = datetime.fromisoformat(order.created_at.replace("Z", "+00:00"))
        invoice_date = dt.strftime("%d %b %Y")
    except:
        invoice_date = "N/A"
        
    c.setFillColor(espresso)
    c.setFont("Helvetica", 7.5)
    c.drawRightString(width - M, height - 22*mm, f"Invoice No: INV-{display_id}")
    c.drawRightString(width - M, height - 27.5*mm, f"Invoice Date: {invoice_date}")
    c.drawRightString(width - M, height - 33*mm, f"Order ID: #{display_id}")
    
    # Gold divider
    c.setStrokeColor(gold)
    c.setLineWidth(0.4*mm)
    c.line(M, height - 47*mm, width - M, height - 47*mm)
    
    # --- BILL TO ---
    y = height - 55*mm
    c.setFillColor(terracotta)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(M, y, "BILL TO:")
    c.drawString(width/2 + 2*mm, y, "ORDER DETAILS:")
    
    y -= 5.5*mm
    c.setFillColor(espresso)
    c.setFont("Helvetica-Bold", 8)
    cust_name = f"{order.delivery_address.firstName} {order.delivery_address.lastName}".strip()
    c.drawString(M, y, cust_name or "N/A")
    c.setFont("Helvetica", 8)
    c.drawString(width/2 + 2*mm, y, f"Order ID:  #{display_id}")
    
    y -= 4.5*mm
    city_state = f"{order.delivery_address.city}, {order.delivery_address.state} - {order.delivery_address.pincode}"
    c.drawString(M, y, city_state)
    c.drawString(width/2 + 2*mm, y, f"Date:        {invoice_date}")
    
    y -= 4.5*mm
    if order.delivery_address.mobile:
        c.drawString(M, y, f"Phone: {order.delivery_address.mobile}")
    c.drawString(width/2 + 2*mm, y, f"Payment:   {order.payment_method}")

    # --- TAX CALCULATION ---
    cust_state = (order.delivery_address.state or "").strip().lower()
    is_intra_state = (cust_state == SELLER['state'])
    
    table_data = [['Sr.', 'Product Name', 'HSN Code', 'Unit Price', 'Qty', 'Taxable', 'GST %', 'GST Amt', 'Total']]
    
    total_taxable = 0.0
    total_gst = 0.0
    
    for i, item in enumerate(order.items):
        qty = item.quantity
        line_total = item.price * qty
        gst_rate = item.gstRate or 5.0
        taxable = line_total / (1 + gst_rate / 100)
        gst_amt = line_total - taxable
        unit_price = taxable / qty
        
        total_taxable += taxable
        total_gst += gst_amt
        
        table_data.append([
            str(i+1),
            item.name,
            item.hsn_code,
            f"Rs. {unit_price:.2f}",
            str(qty),
            f"Rs. {taxable:.2f}",
            f"{gst_rate}%",
            f"Rs. {gst_amt:.2f}",
            f"Rs. {line_total:.2f}"
        ])
    
    # --- TABLE ---
    col_widths = [7*mm, 52*mm, 20*mm, 23*mm, 10*mm, 24*mm, 11*mm, 20*mm, 15*mm]
    t = Table(table_data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), terracotta),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('ALIGN', (3,1), (3,-1), 'RIGHT'), # Unit Price
        ('ALIGN', (5,1), (5,-1), 'RIGHT'), # Taxable
        ('ALIGN', (7,1), (7,-1), 'RIGHT'), # GST Amt
        ('ALIGN', (8,1), (8,-1), 'RIGHT'), # Total
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 6.5),
        ('BOTTOMPADDING', (0,0), (-1,0), 3),
        ('BACKGROUND', (0,1), (-1,-1), white),
        ('TEXTCOLOR', (0,1), (-1,-1), espresso),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 7),
        ('GRID', (0,0), (-1,-1), 0.15, gold),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, sand]),
    ]))
    
    t.wrapOn(c, width, height)
    t.drawOn(c, M, y - 40*mm - len(order.items)*10*mm) # simplified positioning
    
    # Signature
    if order.signature:
        try:
            import base64
            from reportlab.lib.utils import ImageReader
            sig_data = base64.b64decode(order.signature)
            sig_img = ImageReader(io.BytesIO(sig_data))
            c.drawImage(sig_img, width - M - 40*mm, 20*mm, width=40*mm, height=25*mm, preserveAspectRatio=True, anchor='se')
            c.setFillColor(espresso)
            c.setFont("Helvetica", 8)
            c.drawRightString(width - M, 15*mm, "Authorized Signatory")
        except Exception as e:
            print("Signature error:", e)
            pass

    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
