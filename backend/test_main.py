from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_autocomplete():
    response = client.get("/api/autocomplete?query=test")
    assert response.status_code == 200
    data = response.json()
    assert "query" in data
    assert "results" in data

def test_generate_invoice():
    payload = {
        "id": "TEST-123",
        "created_at": "2026-07-27T00:00:00.000Z",
        "delivery_address": {
            "firstName": "John",
            "lastName": "Doe",
            "city": "Noida",
            "state": "Uttar Pradesh",
            "pincode": "201301",
            "isGstBilling": False
        },
        "items": [
            {
                "id": "P1",
                "name": "Test Item",
                "hsn_code": "1234",
                "price": 100.0,
                "quantity": 2
            }
        ],
        "payment_method": "UPI",
        "total_amount": 200.0
    }
    response = client.post("/api/generate-invoice", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "attachment; filename=\"Invoice-TEST-123.pdf\"" in response.headers["content-disposition"]
