# User API Documentation

All user endpoints assume a base URL of `http://localhost:4000/api`. Some requests require a Bearer token which should be passed as `Authorization: Bearer <USER_TOKEN>`.

## 1. Authentication
### Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com", "password": "password123", "mobileNumber": "+911234567890"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "otp": "123456"}'
```

### Login User
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com", "password": "password123"}'
```

### Forgot Password
```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "john@example.com"}'
```

### Reset Password
```bash
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "your_reset_token_here", "newPassword": "newpassword123"}'
```

## 2. User Profile
### Get Profile
```bash
curl -X GET http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Update Profile
```bash
curl -X PUT http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Updated", "mobileNumber": "+919876543210", "latitude": 21.1702, "longitude": 72.8311}'
```

### Delete Profile
```bash
curl -X DELETE http://localhost:4000/api/users/profile \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Request Email Change
```bash
curl -X POST http://localhost:4000/api/users/change-email-request \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"newEmail": "newemail@example.com"}'
```

### Verify Email Change
```bash
curl -X POST http://localhost:4000/api/users/change-email-verify \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"otp": "123456"}'
```

## 3. Products
### Get Products (with Pagination & Filters)
```bash
curl -X GET "http://localhost:4000/api/products?page=1&limit=20&search=xyz&sort=price_asc&inStock=true&brand=ExampleBrand&minPrice=100&maxPrice=500&ratings=4,5&type=categoryType&categories=subCategory1,subCategory2" \
  -H "Content-Type: application/json"
```

### Get Product by ID
```bash
curl -X GET http://localhost:4000/api/products/60d21b4667d0d8992e610c85
```

### Get Product Filters (Aggregations)
```bash
curl -X GET "http://localhost:4000/api/products/filters?type=categoryType"
```

### Add Product Review
```bash
curl -X POST http://localhost:4000/api/products/60d21b4667d0d8992e610c85/reviews \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"rating": 5, "comment": "Great product!"}'
```

## 4. Cart
### Get Cart
```bash
curl -X GET http://localhost:4000/api/cart \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Add / Update Cart Item
```bash
curl -X POST http://localhost:4000/api/cart \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "60d21b4667d0d8992e610c85", "quantity": 2}'
```

### Remove from Cart
```bash
curl -X DELETE http://localhost:4000/api/cart/60d21b4667d0d8992e610c85 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

## 5. Wishlist
### Get Wishlist
```bash
curl -X GET http://localhost:4000/api/wishlist \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Add / Update Wishlist Item
```bash
curl -X POST http://localhost:4000/api/wishlist \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"productId": "60d21b4667d0d8992e610c85"}'
```

### Remove from Wishlist
```bash
curl -X DELETE http://localhost:4000/api/wishlist/60d21b4667d0d8992e610c85 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

## 6. Addresses
### Get All Addresses
```bash
curl -X GET http://localhost:4000/api/addresses \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Create Address
```bash
curl -X POST http://localhost:4000/api/addresses \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fullName": "John Doe", "phone": "+911234567890", "addressLine1": "419-522, Some Building", "addressLine2": "Near Station", "landmark": "Behind City Mall", "city": "Surat", "state": "Gujarat", "zip": "394101", "isDefault": true}'
```

### Update Address
```bash
curl -X PUT http://localhost:4000/api/addresses/60d21b4667d0d8992e610c86 \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"addressLine1": "New Street Name", "isDefault": true}'
```

### Delete Address
```bash
curl -X DELETE http://localhost:4000/api/addresses/60d21b4667d0d8992e610c86 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

## 7. Orders
### Get My Orders (with Pagination & Status Filter)
# Supported status values: All, Success, Pending, Failed, Refunded, Captured
```bash
curl -X GET "http://localhost:4000/api/orders/myorders?page=1&limit=10&status=Success" \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Get Order Details
```bash
curl -X GET http://localhost:4000/api/orders/60d21b4667d0d8992e610c87 \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Download Order Invoice
```bash
curl -X GET http://localhost:4000/api/orders/60d21b4667d0d8992e610c87/invoice \
  -H "Authorization: Bearer <USER_TOKEN>"
```

### Request Order Return
```bash
curl -X POST http://localhost:4000/api/orders/60d21b4667d0d8992e610c87/request-return \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Defective item"}'
```

## 8. Payment
### Create Payment Order
```bash
curl -X POST http://localhost:4000/api/payment/create-order \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderItems": [
      {
        "product": "60d21b4667d0d8992e610c85",
        "name": "Super Mega Whey Protein",
        "qty": 1,
        "image": "image1.jpg",
        "price": 2500
      }
    ],
    "shippingAddress": {
      "address": "419-522",
      "city": "Surat",
      "postalCode": "394101",
      "country": "India"
    },
    "itemsPrice": 2500,
    "taxPrice": 0,
    "shippingPrice": 50,
    "totalPrice": 2550
  }'
```

### Verify Payment
```bash
curl -X POST http://localhost:4000/api/payment/verify \
  -H "Authorization: Bearer <USER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "6a7951def872f414f1d79ae2",
    "razorpayOrderId": "order_TNvv9jT41CqDtN",
    "razorpayPaymentId": "pay_TNvwxyz123",
    "razorpaySignature": "signature_xyz"
  }'
```

## 9. Banners
### Get All Banners
```bash
curl -X GET http://localhost:4000/api/banners
```
