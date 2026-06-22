# Backend API

E-commerce backend API built with Express.js, TypeScript, MongoDB, and Firebase Authentication.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory:
```
PORT=4000
JWT_SECRET=your-secret-key-change-this-in-production
MONGODB_URI=mongodb://localhost:27017/ecommerce
NODE_ENV=development

# Firebase Configuration (choose one method)
# Method 1: Service Account JSON (recommended)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}

# Method 2: Individual credentials
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

3. **Firebase Setup:**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select an existing one
   - Enable Phone Authentication in Authentication > Sign-in method
   - Go to Project Settings > Service Accounts
   - Generate a new private key and download the JSON file
   - Copy the JSON content to `FIREBASE_SERVICE_ACCOUNT` in `.env` (as a single-line JSON string)
   - OR extract `project_id`, `client_email`, and `private_key` for Method 2

4. Make sure MongoDB is running on your system.

5. Run the development server:
```bash
npm run dev
```

The server will start on `http://localhost:4000`

## API Endpoints

### Authentication

#### POST `/api/auth/register`
Register a new user. This stores user data temporarily. The frontend should use Firebase Client SDK to send OTP.

**Request Body:**
```json
{
  "name": "John Doe",
  "mobileNumber": "+1234567890",
  "password": "password123",
  "role": "customer"
}
```

**Response:**
```json
{
  "message": "OTP sent to your mobile number!",
  "mobileNumber": "+1234567890"
}
```

**Note:** After calling this endpoint, the frontend should:
1. Use Firebase Client SDK to send OTP: `signInWithPhoneNumber(phoneNumber, recaptchaVerifier)`
2. Verify the OTP with Firebase: `confirmationResult.confirm(code)`
3. Get the ID token from Firebase: `user.getIdToken()`
4. Send the ID token to `/api/auth/verify-otp`

#### POST `/api/auth/verify-otp`
Verify Firebase ID token and complete registration.

**Request Body:**
```json
{
  "mobileNumber": "+1234567890",
  "idToken": "firebase-id-token-from-client"
}
```

**Response:**
```json
{
  "message": "Registration successful!",
  "token": "jwt-token-here",
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "mobileNumber": "+1234567890",
    "role": "customer",
    "isVerified": true
  },
  "role": "customer"
}
```

## Frontend Integration

The frontend needs to integrate Firebase Client SDK for phone authentication:

1. Install Firebase Client SDK:
```bash
npm install firebase
```

2. Initialize Firebase in your frontend:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
```

3. Update the register flow:
   - After backend `/auth/register` call succeeds
   - Use `signInWithPhoneNumber()` to send OTP
   - Verify OTP with `confirmationResult.confirm(code)`
   - Get ID token with `user.getIdToken()`
   - Send ID token to backend `/auth/verify-otp`

## Development Notes

- Firebase handles OTP generation, sending, and verification
- Backend verifies the Firebase ID token to ensure OTP was correctly verified
- JWT tokens expire after 7 days
- Phone numbers must include country code (e.g., +1234567890)
