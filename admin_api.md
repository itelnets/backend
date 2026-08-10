# Admin API Documentation

All admin endpoints assume a base URL of `http://localhost:4000/api`. Most requests require an Admin Bearer token which should be passed as `Authorization: Bearer <ADMIN_TOKEN>`.

## 1. Authentication
### Admin Login
```bash
curl -X POST http://localhost:4000/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "adminpassword"}'
```

## 2. Users (Admin)
### Get All Users (with Pagination & Search)
```bash
curl -X GET "http://localhost:4000/api/users/admin/all?page=1&limit=20&search=john" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Toggle User Status (Activate/Deactivate)
```bash
curl -X PUT http://localhost:4000/api/users/admin/60d21b4667d0d8992e610c89/status \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isDeleted": true}'
```

## 3. Products (Admin)
### Create Product
```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Mega Whey Protein",
    "description": "High quality whey protein for muscle growth.",
    "price": 2500,
    "discount": 15,
    "images": ["image1.jpg", "image2.jpg"],
    "type": "Supplements",
    "categories": ["Protein", "Post-Workout"],
    "overview": "Detailed overview of the product...",
    "specifications": [
      { "key": "Flavor", "value": "Chocolate" },
      { "key": "Weight", "value": "1kg" }
    ],
    "suggestedUse": "Mix one scoop with 200ml of water.",
    "otherIngredients": "Whey Protein Isolate, Cocoa Powder, Sucralose.",
    "warnings": "Do not exceed recommended dosage.",
    "disclaimer": "These statements have not been evaluated by the FDA.",
    "isActive": true,
    "brand": "Optimum Nutrition",
    "manufacturer": "ON Labs Inc.",
    "inStock": "In Stock",
    "bestSeller": "Yes",
    "order": 1,
    "hsn": "21069099",
    "batchNo": "BATCH-12345",
    "expiredOn": "2028-12-31"
  }'
```

### Update Product
```bash
curl -X PUT http://localhost:4000/api/products/60d21b4667d0d8992e610c85 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Super Mega Whey Protein (Updated)",
    "description": "Updated high quality whey protein for muscle growth.",
    "price": 2400,
    "discount": 20,
    "images": ["image1.jpg", "image3.jpg"],
    "type": "Supplements",
    "categories": ["Protein", "Post-Workout", "Sale"],
    "overview": "Updated detailed overview of the product...",
    "specifications": [
      { "key": "Flavor", "value": "Vanilla" },
      { "key": "Weight", "value": "1kg" }
    ],
    "suggestedUse": "Mix one scoop with 250ml of water or milk.",
    "otherIngredients": "Whey Protein Isolate, Natural Vanilla Flavor, Sucralose.",
    "warnings": "Do not exceed recommended dosage. Keep out of reach of children.",
    "disclaimer": "These statements have not been evaluated by the FDA.",
    "isActive": true,
    "brand": "Optimum Nutrition",
    "manufacturer": "ON Labs Inc.",
    "inStock": "Out of Stock",
    "bestSeller": "No",
    "order": 2,
    "hsn": "21069099",
    "batchNo": "BATCH-99999",
    "expiredOn": "2029-01-01"
  }'
```

### Delete Product
```bash
curl -X DELETE http://localhost:4000/api/products/60d21b4667d0d8992e610c85 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Reorder Products
```bash
curl -X POST http://localhost:4000/api/products/reorder \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderedIds": ["60d21b4667d0d8992e610c85", "60d21b4667d0d8992e610c86"]}'
```

## 4. Orders (Admin)
### Get All Orders (with Pagination)
```bash
curl -X GET "http://localhost:4000/api/orders/admin/all?page=1&limit=20" \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## 5. Banners (Admin)
### Create Banner
```bash
curl -X POST http://localhost:4000/api/banners \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"imageKey": "summer_banner.jpg", "fileSize": 102400, "width": 1920, "height": 1080}'
```

### Update Banner
```bash
curl -X PATCH http://localhost:4000/api/banners/60d21b4667d0d8992e610c88 \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'
```

### Delete Banner
```bash
curl -X DELETE http://localhost:4000/api/banners/60d21b4667d0d8992e610c88 \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```

### Reorder Banners
```bash
curl -X POST http://localhost:4000/api/banners/reorder \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"order": ["60d21b4667d0d8992e610c88", "60d21b4667d0d8992e610c89"]}'
```

## 6. Upload (Admin)
### Upload File / Image
```bash
curl -X POST http://localhost:4000/api/upload \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "image=@/path/to/your/image.jpg"
```

## 7. Payments (Admin)
### Refund Payment
```bash
curl -X POST http://localhost:4000/api/payment/refund \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": "mongo_order_id", "amount": 500}'
```
