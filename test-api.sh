#!/bin/bash

# Test signup
echo "Testing Signup API..."
signup_response=$(curl -s -X POST http://localhost:5000/api/auth/signup \
-H "Content-Type: application/json" \
-d '{
    "phoneNumber": "9876543210",
    "password": "test123456"
}')
echo $signup_response
echo -e "\n"

# Test OTP verification (replace OTP with the one logged in console)
echo "Testing OTP Verification..."
verify_response=$(curl -s -X POST http://localhost:5000/api/auth/verify-otp \
-H "Content-Type: application/json" \
-d '{
    "phoneNumber": "9876543210",
    "otp": "REPLACE_WITH_OTP"
}')
echo $verify_response
echo -e "\n"

# Test resend OTP
echo "Testing Resend OTP..."
resend_response=$(curl -s -X POST http://localhost:5000/api/auth/resend-otp \
-H "Content-Type: application/json" \
-d '{
    "phoneNumber": "9876543210"
}')
echo $resend_response
echo -e "\n"

# Test login
echo "Testing Login API..."
login_response=$(curl -s -X POST http://localhost:5000/api/auth/login \
-H "Content-Type: application/json" \
-d '{
    "phoneNumber": "9876543210",
    "password": "test123456"
}')
echo $login_response
echo -e "\n"
