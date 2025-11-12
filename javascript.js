// ... existing JavaScript code ...

// --- M-Pesa Checkout Functionality ---
const BACKEND_URL = 'http://localhost:5000'; // Match your Node.js server port

function initiateMpesaCheckout(event) {
    event.preventDefault();
    
    const form = event.target;
    const amount = getCartTotal();
    const phone = form.mpesaPhone.value;
    const accountRef = form.accountReference.value;
    const checkoutButton = document.getElementById('checkoutButton');
    const mpesaStatus = document.getElementById('mpesaStatus');

    if (amount <= 0) {
        showToast("Cart is empty or total is zero.");
        return;
    }

    checkoutButton.disabled = true;
    checkoutButton.innerHTML = `<i data-lucide="loader" class="inline-block h-5 w-5 mr-2 animate-spin"></i> Processing...`;
    mpesaStatus.classList.remove('hidden');
    mpesaStatus.className = 'mt-4 text-center p-3 rounded-lg bg-blue-100 text-blue-800';
    mpesaStatus.textContent = "Requesting STK Push. Check your phone for the M-Pesa prompt...";

    const payload = {
        amount: amount, // KES
        phone: phone, 
        accountRef: accountRef,
        transactionDesc: "NIA Shea Butter Order"
    };

    fetch(`${BACKEND_URL}/mpesa/stkpush`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
    .then(response => response.json())
    .then(data => {
        checkoutButton.disabled = false;
        checkoutButton.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/en/thumb/1/15/M-Pesa_logo.svg/80px-M-Pesa_logo.svg.png" alt="M-Pesa Logo" class="h-6 w-auto mr-2 inline-block"> Pay Now with M-Pesa`;
        
        if (data.success) {
            mpesaStatus.className = 'mt-4 text-center p-3 rounded-lg bg-yellow-100 text-yellow-800 font-semibold';
            mpesaStatus.innerHTML = `✅ ${data.message} <br> **Order ID: ${accountRef}** <br> **Please enter your M-Pesa PIN on your phone.**`;
            // NOTE: The final status (paid/failed) is handled by the backend's callback endpoint.
            // A more advanced frontend would poll the backend for the final status using the CheckoutRequestID.
        } else {
            mpesaStatus.className = 'mt-4 text-center p-3 rounded-lg bg-red-100 text-red-800 font-semibold';
            mpesaStatus.textContent = `❌ M-Pesa Error: ${data.detail || data.message}. Please check your phone number and try again.`;
        }
    })
    .catch((error) => {
        console.error('Frontend Fetch Error:', error);
        checkoutButton.disabled = false;
        checkoutButton.innerHTML = `<img src="https://upload.wikimedia.org/wikipedia/en/thumb/1/15/M-Pesa_logo.svg/80px-M-Pesa_logo.svg.png" alt="M-Pesa Logo" class="h-6 w-auto mr-2 inline-block"> Pay Now with M-Pesa`;
        mpesaStatus.className = 'mt-4 text-center p-3 rounded-lg bg-red-100 text-red-800 font-semibold';
        mpesaStatus.textContent = `❌ Connection Error. Is the backend server running?`;
    });
}

// Update the renderCartPage function to add the event listener
function renderCartPage() {
    // ... existing code for renderCartPage up to innerHTML assignment ...
    
    mainContent.innerHTML = `
        `;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // --- New: M-Pesa Checkout Event Listener ---
    const mpesaForm = document.getElementById('mpesaCheckoutForm');
    if (mpesaForm) {
        mpesaForm.addEventListener('submit', initiateMpesaCheckout);
    }
}
