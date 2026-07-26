from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from models import Order
from autocomplete import product_trie
from pdf_generator import generate_invoice_pdf

app = FastAPI(title="Invoice Generator Engine API")

# Allow React app to talk to FastAPI (running on Vite's default 5173 or similar)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/autocomplete")
def autocomplete_product(query: str):
    """
    Returns product suggestions based on search query.
    """
    suggestions = product_trie.search_prefix(query, limit=5)
    return {"query": query, "results": [res["data"] for res in suggestions]}

@app.post("/api/generate-invoice")
def generate_invoice(order: Order):
    """
    Receives invoice data, calculates taxes dynamically, and generates a PDF.
    """
    try:
        pdf_bytes = generate_invoice_pdf(order)
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Invoice-{order.id}.pdf"'}
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
