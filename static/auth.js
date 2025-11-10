// authScript.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    form.addEventListener("submit", (e) => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Basic front-end validation
        if (!email || !password) {
            e.preventDefault();
            alert("Please enter both email and password.");
            return;
        }

        // Optional: Add simple format check for email
        const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!emailPattern.test(email)) {
            e.preventDefault();
            alert("Please enter a valid email address.");
        }
    });
});