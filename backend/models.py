from pydantic import BaseModel, Field
from typing import List, Optional

class DeliveryAddress(BaseModel):
    isGstBilling: bool = False
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    house: Optional[str] = ""
    area: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    pincode: Optional[str] = ""
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    billingState: Optional[str] = ""
    gstin: Optional[str] = ""
    legalName: Optional[str] = ""

class Item(BaseModel):
    id: str
    name: str
    hsn_code: str
    price: float  # inclusive of GST
    quantity: int
    gstRate: Optional[float] = 5.0 # fallback

class Order(BaseModel):
    id: str
    created_at: str
    delivery_address: DeliveryAddress
    items: List[Item]
    payment_method: str
    total_amount: float
    wallet_used_amount: float = 0.0
    coupon_discount_amount: float = 0.0
    coupon_code_used: Optional[str] = ""
    company_logo: Optional[str] = None
    signature: Optional[str] = None
