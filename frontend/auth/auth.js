document.addEventListener("DOMContentLoaded", () => {
    localStorage.removeItem("users");

    const emailInput = document.getElementById("loginEmail");
    const rememberCheck = document.getElementById("rememberMe");
    const rememberedEmail = localStorage.getItem("rememberEmail");

    if (emailInput && rememberedEmail) {
        emailInput.value = rememberedEmail;

        if (rememberCheck) {
            rememberCheck.checked = true;
        }
    }
});
